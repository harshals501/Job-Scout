// Offline checks: the fetcher against fixtures, and the run-file validator.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import { validateRun } from '../scripts/db.mjs';
import { cleanText } from '../scripts/fetch-jobs.mjs';

const id = 'selftest';
rmSync(`work/${id}`, { recursive: true, force: true });
mkdirSync(`work/${id}`, { recursive: true });
writeFileSync(`work/${id}/seen.json`, JSON.stringify(['https://example.com/seen/1']));

let out = '';
try {
  out = execFileSync('node', ['scripts/fetch-jobs.mjs', '--profile', id, '--fixtures', 'test/fixtures'], { encoding: 'utf8' });
} catch (e) {
  out = e.stdout;
}
const c = JSON.parse(readFileSync(`work/${id}/candidates.json`, 'utf8'));
const urls = c.map((j) => j.url).sort();
assert.deepEqual(urls, ['https://example.com/ashby/1', 'https://example.com/gh/1', 'https://example.com/remotive/1'], 'filter, freshness, seen and dedupe');
assert.equal(c.find((j) => j.url.endsWith('gh/1')).description.includes('<'), false, 'HTML stripped');
assert.match(out, /Errors: .*lever:mistral failed/, 'failed sources are reported, not fatal');
assert.equal(cleanText('&lt;p&gt;A &amp;amp; B&lt;/p&gt;'), 'A & B');

const job = (n, extra = {}) => ({ url: `https://example.com/j/${n}`, company: 'Co', title: 'PM, AI', remote_scope: 'worldwide', employment_type: 'full_time', ...extra });
const good = {
  profile_id: 'p', run_date: '2026-11-16',
  results: [
    { job: job(1), verdict: 'shortlist', fit_score: 4.2, email_context: 'Hello, a real note.', cover_note: 'A real cover note.' },
    { job: job(2), verdict: 'pass', fit_score: 3.1 },
    { job: job(3, { remote_scope: 'restricted' }), verdict: 'skip', gate_failed: 'geography' },
  ],
};
assert.deepEqual(validateRun(good), []);

const bad = structuredClone(good);
bad.results[0].fit_score = 6;
bad.results[0].email_context = 'Hi [Name], hello';
bad.results[1].cover_note = 'x';
bad.results[2].gate_failed = null;
const errs = validateRun(bad);
assert.equal(errs.length, 4, errs.join('\n'));

rmSync(`work/${id}`, { recursive: true, force: true });
console.log('All checks passed.');
