#!/usr/bin/env node
// Local-mode helper. This script never talks to a database over the network —
// that happens on Vercel (see web/app/api/sync/route.ts), not from the agent.
//
//   node scripts/db.mjs profiles            copy seed/ into work/local/
//   node scripts/db.mjs validate <runfile>  check a run file

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- validation ----------

const VERDICTS = ['shortlist', 'pass', 'skip'];
const GATES = ['geography', 'job_type', 'role_family', 'deal_breaker'];
const SCOPES = ['worldwide', 'emea', 'us_overlap', 'india', 'unclear', 'restricted'];
const TYPES = ['full_time', 'contract', 'fractional', 'part_time', 'unknown'];

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
      if (r.email_context || r.cover_note) errs.push(`${at}: a skipped job must not have draft content.`);
      return;
    }
    if (r.gate_failed) errs.push(`${at}: gate_failed is set but verdict is "${r.verdict}".`);
    if (j.remote_scope === 'restricted') errs.push(`${at}: remote_scope is restricted, so the geography gate should have failed.`);

    if (r.verdict !== 'skip') {
      if (typeof r.fit_score !== 'number' || r.fit_score < 1 || r.fit_score > 5) {
        errs.push(`${at}: fit_score must be a number from 1 to 5.`);
      }
    }
    if (r.verdict === 'shortlist') {
      if (!r.email_context && !r.cover_note) errs.push(`${at}: a shortlisted job needs email_context and/or cover_note.`);
      const text = `${r.email_context ?? ''} ${r.cover_note ?? ''}`;
      if (/\[[A-Z][^\]]{0,30}\]|\{\{.+?\}\}/.test(text)) errs.push(`${at}: draft contains a placeholder such as [Name].`);
    }
    if (r.verdict === 'pass' && (r.email_context || r.cover_note)) errs.push(`${at}: only shortlisted jobs get draft content.`);
  });
  return errs;
}

// ---------- commands ----------

async function cmdProfiles() {
  const seed = (f) => readFile(path.join(ROOT, 'seed', f), 'utf8');
  const dir = path.join(ROOT, 'work', 'local');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'profile.md'), await seed('profile.md'));
  await writeFile(path.join(dir, 'positioning.md'), await seed('positioning.md'));
  await writeFile(path.join(dir, 'preferences.json'), await seed('preferences.json'));
  await mkdir(path.join(ROOT, 'work'), { recursive: true });
  await writeFile(path.join(ROOT, 'work', 'profiles.json'), JSON.stringify([{ id: 'local', full_name: 'Local profile' }], null, 2));
  console.log('1 profile(s) ready: Local profile (local).');
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
  console.log('Commit and push this file to runs/ — the Vercel cron job picks it up from there and syncs the shortlist to Airtable.');
}

const [cmd, a1] = process.argv.slice(2);
const commands = {
  profiles: cmdProfiles,
  validate: () => cmdValidate(a1),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!commands[cmd]) {
    console.error('Usage: node scripts/db.mjs <profiles|validate> [arg]');
    process.exit(1);
  }
  commands[cmd]().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
