#!/usr/bin/env node
// The only door between the engine and Supabase.
//
//   node scripts/db.mjs profiles            load active profiles into work/
//   node scripts/db.mjs validate <runfile>  check a run file
//   node scripts/db.mjs sync <runfile>      validate, then upsert into Supabase
//   node scripts/db.mjs seed <email>        load seed/ into that user's profile and approve it
//   node scripts/db.mjs approve <email>     approve a friend's profile for daily runs
//
// Without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY it runs in local mode.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL = !URL_ || !KEY;

async function rest(method, pathAndQuery, body, prefer) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} failed: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const UPSERT = 'resolution=merge-duplicates,return=representation';

// ---------- validation ----------

const VERDICTS = ['shortlist', 'pass', 'skip'];
const GATES = ['geography', 'job_type', 'role_family', 'deal_breaker'];
const SCOPES = ['worldwide', 'emea', 'us_overlap', 'india', 'unclear', 'restricted'];
const TYPES = ['full_time', 'contract', 'fractional', 'part_time', 'unknown'];
const DIMS = ['role_fit', 'ai_depth', 'seniority_fit', 'domain_fit', 'reachability', 'company_quality'];
const WEIGHTS = { role_fit: 0.3, ai_depth: 0.2, seniority_fit: 0.15, domain_fit: 0.15, reachability: 0.1, company_quality: 0.1 };
const gradeFor = (s) => (s >= 4.5 ? 'A' : s >= 4 ? 'B' : s >= 3.5 ? 'C' : s >= 3 ? 'D' : 'F');

export function validateRun(run) {
  const errs = [];
  if (!run || typeof run !== 'object') return ['Run file is not a JSON object.'];
  if (!run.profile_id) errs.push('profile_id is missing.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(run.run_date ?? '')) errs.push('run_date must be YYYY-MM-DD.');
  if (!Array.isArray(run.results)) return [...errs, 'results must be an array.'];

  const urls = new Set();
  run.results.forEach((r, i) => {
    const at = `results[${i}]${r?.job?.title ? ` (${r.job.title})` : ''}`;
    const j = r?.job ?? {};
    if (!/^https?:\/\//.test(j.url ?? '')) errs.push(`${at}: job.url is missing or not a URL.`);
    else if (urls.has(j.url)) errs.push(`${at}: duplicate job.url.`);
    else urls.add(j.url);
    if (!j.company || !j.title) errs.push(`${at}: job.company and job.title are required.`);
    if (j.remote_scope && !SCOPES.includes(j.remote_scope)) errs.push(`${at}: remote_scope "${j.remote_scope}" is not one of ${SCOPES.join(', ')}.`);
    if (j.employment_type && !TYPES.includes(j.employment_type)) errs.push(`${at}: employment_type "${j.employment_type}" is not one of ${TYPES.join(', ')}.`);
    if (!VERDICTS.includes(r.verdict)) errs.push(`${at}: verdict must be one of ${VERDICTS.join(', ')}.`);

    if (r.verdict === 'skip') {
      if (!GATES.includes(r.gate_failed)) errs.push(`${at}: a skipped job needs gate_failed, one of ${GATES.join(', ')}.`);
      if (r.draft) errs.push(`${at}: a skipped job must not have a draft.`);
      return;
    }
    if (r.gate_failed) errs.push(`${at}: gate_failed is set but verdict is "${r.verdict}".`);
    if (j.remote_scope === 'restricted') errs.push(`${at}: remote_scope is restricted, so the geography gate should have failed.`);

    const dims = r.dimensions ?? {};
    let sum = 0;
    let ok = true;
    for (const d of DIMS) {
      const s = dims[d]?.score;
      if (!Number.isInteger(s) || s < 1 || s > 5) {
        errs.push(`${at}: dimensions.${d}.score must be a whole number from 1 to 5.`);
        ok = false;
      } else sum += s * WEIGHTS[d];
    }
    if (ok) {
      const expected = Math.round(sum * 10) / 10;
      if (typeof r.score !== 'number' || Math.abs(r.score - expected) > 0.051) errs.push(`${at}: score is ${r.score} but the weighted dimensions give ${expected}.`);
      else if (r.grade !== gradeFor(r.score)) errs.push(`${at}: grade should be ${gradeFor(r.score)} for score ${r.score}.`);
    }
    if (r.verdict === 'shortlist' && !r.draft) errs.push(`${at}: a shortlisted job needs a draft.`);
    if (r.verdict === 'pass' && r.draft) errs.push(`${at}: only shortlisted jobs get a draft.`);
    if (r.draft) {
      const text = `${r.draft.outreach_body ?? ''} ${r.draft.cover_note ?? ''}`;
      if (/\[[A-Z][^\]]{0,30}\]|\{\{.+?\}\}/.test(text)) errs.push(`${at}: draft contains a placeholder such as [Name].`);
      if (!r.draft.outreach_body && !r.draft.cover_note) errs.push(`${at}: draft has neither an outreach email nor a cover note.`);
    }
  });
  return errs;
}

// ---------- commands ----------

async function writeProfileFiles(p) {
  const dir = path.join(ROOT, 'work', p.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'profile.md'), p.resume_text ?? '');
  await writeFile(path.join(dir, 'positioning.md'), p.positioning_md ?? '');
  await writeFile(path.join(dir, 'preferences.json'), JSON.stringify(p.preferences ?? {}, null, 2));
}

async function cmdProfiles() {
  let profiles;
  if (LOCAL) {
    const seed = (f) => readFile(path.join(ROOT, 'seed', f), 'utf8');
    profiles = [{ id: 'local', full_name: 'Local profile', resume_text: await seed('profile.md'), positioning_md: await seed('positioning.md'), preferences: JSON.parse(await seed('preferences.json')) }];
    console.log('Local mode: using seed/ as the only profile (id "local").');
  } else {
    const rows = await rest('GET', 'profiles?approved=eq.true&paused=eq.false&select=id,full_name,headline,resume_text,positioning_md,preferences');
    profiles = rows.filter((p) => (p.resume_text ?? '').trim().length > 200);
    const skipped = rows.length - profiles.length;
    if (skipped) console.log(`Skipped ${skipped} approved profile(s) with no resume yet.`);
    for (const p of profiles) {
      const seen = [];
      for (let from = 0; ; from += 1000) {
        const page = await rest('GET', `matches?profile_id=eq.${p.id}&select=jobs(url)&order=id&offset=${from}&limit=1000`);
        for (const m of page) if (m.jobs?.url) seen.push(m.jobs.url);
        if (page.length < 1000) break;
      }
      await mkdir(path.join(ROOT, 'work', p.id), { recursive: true });
      await writeFile(path.join(ROOT, 'work', p.id, 'seen.json'), JSON.stringify(seen));
    }
  }
  for (const p of profiles) await writeProfileFiles(p);
  await mkdir(path.join(ROOT, 'work'), { recursive: true });
  await writeFile(path.join(ROOT, 'work', 'profiles.json'), JSON.stringify(profiles.map(({ id, full_name }) => ({ id, full_name })), null, 2));
  console.log(`${profiles.length} profile(s) ready: ${profiles.map((p) => `${p.full_name ?? 'unnamed'} (${p.id})`).join(', ') || 'none'}`);
}

async function loadRun(file) {
  if (!file || !existsSync(file)) throw new Error(`Run file not found: ${file}`);
  let run;
  try {
    run = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    throw new Error(`Run file is not valid JSON: ${e.message}`);
  }
  const errs = validateRun(run);
  if (errs.length) {
    console.error(`${errs.length} problem(s) in ${file}:`);
    for (const e of errs) console.error(` - ${e}`);
    process.exit(1);
  }
  return run;
}

async function cmdValidate(file) {
  const run = await loadRun(file);
  const n = (v) => run.results.filter((r) => r.verdict === v).length;
  console.log(`Valid. ${run.results.length} results: ${n('shortlist')} shortlisted, ${n('pass')} passed, ${n('skip')} skipped.`);
}

async function cmdSync(file) {
  const run = await loadRun(file);
  if (LOCAL) return console.log('Local mode: run file is valid and stays in runs/. Nothing synced.');
  if (run.profile_id === 'local') throw new Error('This run file is from local mode (profile_id "local") and cannot be synced.');

  const results = run.results;
  let jobIdByUrl = new Map();
  if (results.length) {
    const jobs = await rest('POST', 'jobs?on_conflict=url&select=id,url', results.map(({ job: j }) => ({
      url: j.url, source: j.source ?? null, company: j.company, title: j.title, location: j.location ?? null,
      remote_scope: j.remote_scope ?? null, employment_type: j.employment_type ?? null, salary: j.salary ?? null,
      posted_at: j.posted_at ?? null, description: (j.description ?? '').slice(0, 1500),
    })), UPSERT);
    jobIdByUrl = new Map(jobs.map((j) => [j.url, j.id]));

    // status is deliberately not sent, so a status set in the dashboard survives.
    const matches = await rest('POST', 'matches?on_conflict=profile_id,job_id&select=id,job_id', results.map((r) => ({
      profile_id: run.profile_id, job_id: jobIdByUrl.get(r.job.url), run_date: run.run_date, verdict: r.verdict,
      gate_failed: r.gate_failed ?? null, score: r.score ?? null, grade: r.grade ?? null,
      dimensions: r.dimensions ?? null, summary: r.summary ?? null, flags: r.flags ?? [],
    })), UPSERT);
    const matchIdByJob = new Map(matches.map((m) => [m.job_id, m.id]));

    const drafts = results.filter((r) => r.draft).map((r) => ({
      match_id: matchIdByJob.get(jobIdByUrl.get(r.job.url)),
      company_brief: r.draft.company_brief ?? null, hook: r.draft.hook ?? null, hook_source: r.draft.hook_source ?? null,
      contact_hint: r.draft.contact_hint ?? null, outreach_subject: r.draft.outreach_subject ?? null,
      outreach_body: r.draft.outreach_body ?? null, cover_note: r.draft.cover_note ?? null,
      resume_tweaks: r.draft.resume_tweaks ?? [], screening_questions: r.draft.screening_questions ?? [],
    }));
    if (drafts.length) await rest('POST', 'drafts?on_conflict=match_id', drafts, 'resolution=merge-duplicates,return=minimal');
  }

  await rest('POST', 'runs?on_conflict=profile_id,run_date', [{
    profile_id: run.profile_id, run_date: run.run_date, scanned: run.scanned ?? results.length, scored: results.length,
    shortlisted: results.filter((r) => r.verdict === 'shortlist').length, notes: run.notes ?? null,
  }], 'resolution=merge-duplicates,return=minimal');

  console.log(`Synced ${results.length} results for profile ${run.profile_id} on ${run.run_date}.`);
}

async function patchProfile(email, body, label) {
  if (LOCAL) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  if (!email) throw new Error('Give the email address the person signs in with.');
  const rows = await rest('PATCH', `profiles?email=eq.${encodeURIComponent(email)}&select=id`, body, 'return=representation');
  if (!rows.length) throw new Error(`No profile for ${email}. They need to sign in to the dashboard once first.`);
  console.log(`${label} ${email} (profile ${rows[0].id}).`);
}

async function cmdSeed(email) {
  const seed = (f) => readFile(path.join(ROOT, 'seed', f), 'utf8');
  const resume = await seed('profile.md');
  const lines = resume.split('\n').filter((l) => l.trim());
  await patchProfile(email, {
    full_name: lines[0]?.replace(/^#\s*/, '') ?? null,
    headline: lines[1] ?? null,
    resume_text: resume,
    positioning_md: await seed('positioning.md'),
    preferences: JSON.parse(await seed('preferences.json')),
    approved: true,
  }, 'Seeded and approved');
}

const [cmd, a1] = process.argv.slice(2);
const commands = {
  profiles: cmdProfiles,
  validate: () => cmdValidate(a1),
  sync: () => cmdSync(a1),
  seed: () => cmdSeed(a1),
  approve: () => patchProfile(a1, { approved: true }, 'Approved'),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!commands[cmd]) {
    console.error('Usage: node scripts/db.mjs <profiles|validate|sync|seed|approve> [arg]');
    process.exit(1);
  }
  commands[cmd]().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
