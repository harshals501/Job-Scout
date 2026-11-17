#!/usr/bin/env node
// Pulls job postings from company career boards and remote job feeds, filters
// them by title and AI relevance, removes jobs this profile has already seen,
// and writes work/<profile_id>/candidates.json.
//
// Usage: node scripts/fetch-jobs.mjs --profile <id> [--max 40] [--fixtures <dir>]

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const profileId = arg('profile', 'local');
const fixturesDir = arg('fixtures');

const readJson = async (p, fallback) => (existsSync(p) ? JSON.parse(await readFile(p, 'utf8')) : fallback);

// ---------- text helpers ----------

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&rsquo;': "'", '&ndash;': '-', '&mdash;': '-' };

export function cleanText(html) {
  if (!html) return '';
  let s = String(html).replace(/&(lt|gt|amp|quot|#39|nbsp|rsquo|ndash|mdash);/g, (m) => ENTITIES[m] ?? ' ');
  s = s.replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&(lt|gt|amp|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? ' ');
  return s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 6000);
}

const toDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyTerm = (terms) => new RegExp(`(^|[^a-z0-9])(${terms.map(escapeRe).join('|')})([^a-z0-9]|$)`, 'i');

// ---------- sources ----------

async function getJson(url, fixtureName) {
  if (fixturesDir) {
    const p = path.join(fixturesDir, `${fixtureName}.json`);
    if (!existsSync(p)) throw new Error('no fixture');
    return JSON.parse(await readFile(p, 'utf8'));
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'job-scout/1.0 (personal job search)', Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sources = {
  async greenhouse(slug) {
    const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, `greenhouse-${slug}`);
    return (data.jobs ?? []).map((j) => ({
      url: j.absolute_url,
      company: j.company_name ?? slug,
      title: j.title,
      location: j.location?.name ?? '',
      employment_type: null,
      salary: null,
      posted_at: toDate(j.first_published ?? j.updated_at),
      description: cleanText(j.content),
    }));
  },
  async lever(slug) {
    const data = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`, `lever-${slug}`);
    return (Array.isArray(data) ? data : []).map((j) => ({
      url: j.hostedUrl,
      company: slug,
      title: j.text,
      location: [j.categories?.location, j.workplaceType].filter(Boolean).join(' · '),
      employment_type: j.categories?.commitment ?? null,
      salary: j.salaryRange ? `${j.salaryRange.min}-${j.salaryRange.max} ${j.salaryRange.currency ?? ''}`.trim() : null,
      posted_at: toDate(j.createdAt),
      description: cleanText([j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}: ${l.content}`), j.additionalPlain].filter(Boolean).join('\n')),
    }));
  },
  async ashby(slug) {
    const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, `ashby-${slug}`);
    return (data.jobs ?? []).map((j) => ({
      url: j.jobUrl,
      company: slug,
      title: j.title,
      location: [j.location, j.isRemote ? 'Remote' : null].filter(Boolean).join(' · '),
      employment_type: j.employmentType ?? null,
      salary: j.compensation?.compensationTierSummary ?? null,
      posted_at: toDate(j.publishedAt),
      description: cleanText(j.descriptionPlain ?? j.descriptionHtml),
    }));
  },
  async remotive() {
    const data = await getJson('https://remotive.com/api/remote-jobs?category=product', 'remotive');
    return (data.jobs ?? []).map((j) => ({
      url: j.url,
      company: j.company_name,
      title: j.title,
      location: j.candidate_required_location ?? 'Remote',
      employment_type: j.job_type ?? null,
      salary: j.salary || null,
      posted_at: toDate(j.publication_date),
      description: cleanText(j.description),
    }));
  },
  async remoteok() {
    const data = await getJson('https://remoteok.com/api', 'remoteok');
    return (Array.isArray(data) ? data : []).filter((j) => j.position).map((j) => ({
      url: j.url,
      company: j.company,
      title: j.position,
      location: j.location || 'Remote',
      employment_type: null,
      salary: j.salary_min ? `${j.salary_min}-${j.salary_max} USD` : null,
      posted_at: toDate(j.date),
      description: cleanText(j.description),
    }));
  },
  async jobicy() {
    const data = await getJson('https://jobicy.com/api/v2/remote-jobs?count=50&tag=product', 'jobicy');
    return (data.jobs ?? []).map((j) => ({
      url: j.url,
      company: j.companyName,
      title: j.jobTitle,
      location: j.jobGeo ?? 'Remote',
      employment_type: Array.isArray(j.jobType) ? j.jobType.join(', ') : j.jobType ?? null,
      salary: j.annualSalaryMin ? `${j.annualSalaryMin}-${j.annualSalaryMax} ${j.salaryCurrency ?? ''}`.trim() : null,
      posted_at: toDate(j.pubDate),
      description: cleanText(j.jobDescription ?? j.jobExcerpt),
    }));
  },
  async himalayas() {
    const data = await getJson('https://himalayas.app/jobs/api?limit=100', 'himalayas');
    return (data.jobs ?? []).map((j) => ({
      url: j.applicationLink ?? j.guid,
      company: j.companyName,
      title: j.title,
      location: (j.locationRestrictions ?? []).join(', ') || 'Worldwide',
      employment_type: j.employmentType ?? null,
      salary: j.minSalary ? `${j.minSalary}-${j.maxSalary} ${j.currency ?? 'USD'}` : null,
      posted_at: toDate(j.pubDate),
      description: cleanText(j.description),
    }));
  },
};

// ---------- main ----------

async function loadPreferences() {
  const fromWork = path.join(ROOT, 'work', profileId, 'preferences.json');
  if (existsSync(fromWork)) return readJson(fromWork, {});
  return readJson(path.join(ROOT, 'seed', 'preferences.json'), {});
}

async function loadSeen() {
  const seen = new Set(await readJson(path.join(ROOT, 'work', profileId, 'seen.json'), []));
  const runsDir = path.join(ROOT, 'runs');
  if (existsSync(runsDir)) {
    for (const day of await readdir(runsDir)) {
      const f = path.join(runsDir, day, `${profileId}.json`);
      if (!existsSync(f)) continue;
      const run = await readJson(f, {});
      for (const r of run.results ?? []) if (r.job?.url) seen.add(r.job.url);
    }
  }
  return seen;
}

async function main() {
  const config = await readJson(path.join(ROOT, 'config', 'sources.json'), {});
  const prefs = await loadPreferences();
  const d = config.defaults ?? {};
  const include = anyTerm(prefs.title_include ?? d.title_include ?? ['product manager']);
  const exclude = anyTerm(prefs.title_exclude ?? d.title_exclude ?? ['intern']);
  const aiTerms = anyTerm(d.ai_terms ?? ['ai']);
  const maxAge = d.max_age_days ?? 21;
  const max = Number(arg('max', prefs.max_candidates ?? d.max_candidates ?? 40));

  const tasks = [];
  for (const [kind, slugs] of Object.entries(config.boards ?? {})) {
    for (const slug of slugs) tasks.push({ name: `${kind}:${slug}`, run: () => sources[kind](slug) });
  }
  for (const [feed, on] of Object.entries(config.feeds ?? {})) {
    if (on && sources[feed]) tasks.push({ name: feed, run: () => sources[feed]() });
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const all = [];
  const report = [];
  const errors = [];
  settled.forEach((s, i) => {
    const name = tasks[i].name;
    if (s.status === 'fulfilled') {
      report.push(`${name}: ${s.value.length}`);
      for (const j of s.value) all.push({ ...j, source: name });
    } else {
      errors.push(`${name} failed (${s.reason?.message ?? s.reason})`);
    }
  });

  const seen = await loadSeen();
  const cutoff = new Date(Date.now() - maxAge * 86400000).toISOString().slice(0, 10);
  const byUrl = new Map();
  const counts = { fetched: all.length, title: 0, ai: 0, fresh: 0, unseen: 0 };

  for (const j of all) {
    if (!j.url || !j.title) continue;
    if (!include.test(j.title) || exclude.test(j.title)) continue;
    counts.title++;
    if (!aiTerms.test(j.title) && !aiTerms.test(j.description)) continue;
    counts.ai++;
    if (j.posted_at && j.posted_at < cutoff) continue;
    counts.fresh++;
    if (seen.has(j.url) || byUrl.has(j.url)) continue;
    counts.unseen++;
    const hay = `${j.location} ${j.description.slice(0, 1500)}`;
    byUrl.set(j.url, {
      ...j,
      remote_hint: /worldwide|anywhere|global/i.test(hay) ? 'worldwide?' : /emea|europe/i.test(hay) ? 'emea?' : /remote/i.test(hay) ? 'remote, region unclear' : 'no remote signal',
    });
  }

  const candidates = [...byUrl.values()]
    .sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''))
    .slice(0, max);

  const outDir = path.join(ROOT, 'work', profileId);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'candidates.json'), JSON.stringify(candidates, null, 2));

  console.log(`Sources: ${report.join(', ') || 'none succeeded'}`);
  if (errors.length) console.log(`Errors: ${errors.join('; ')}`);
  console.log(
    `Fetched ${counts.fetched} · title match ${counts.title} · AI-relevant ${counts.ai} · recent ${counts.fresh} · new ${counts.unseen} · kept ${candidates.length}`,
  );
  console.log(`Wrote work/${profileId}/candidates.json`);
  if (tasks.length && errors.length === tasks.length) process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
