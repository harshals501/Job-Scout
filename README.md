# Job Scout

A daily job-search engine for one profile. It finds new remote roles, scores
them, drafts a short email context and cover note for the best few, and
publishes the shortlist to a page on Vercel. No database — the shortlist is
just a JSON file committed to this repo.

## How it fits together

1. **`seed/`** holds the profile: `profile.md` (resume), `positioning.md`
   (angle, honest gaps), `preferences.json` (target titles, regions, job
   types, deal breakers, shortlist size, minimum score).
2. **The agent** (`.claude/agents/job-scout.md`) runs daily: scans job sources
   (`scripts/fetch-jobs.mjs`), scores each candidate (`score-job` skill),
   researches and drafts for the shortlist (`research-company`,
   `draft-shortlist`), then saves (`update-tracker`): writes
   `runs/<date>/local.json` (everything scored, for dedup) and
   `data/latest.json` (just the shortlist — what the page shows), commits,
   and pushes.
3. **The page** (`web/`, a one-page Next.js app) fetches `data/latest.json`
   straight from GitHub on every visit and renders it. Deploy it on Vercel
   with zero environment variables — it needs none.

## Running it by hand

```bash
node scripts/db.mjs profiles          # copies seed/ into work/local/
node scripts/fetch-jobs.mjs --profile local
# ...score, research, draft, then:
node scripts/db.mjs validate runs/<date>/local.json
git add runs/ data/latest.json && git commit -m "Run <date>" && git push
```

Or just: `claude --agent job-scout` and let it do all of the above.

## Setting it to run daily

Schedule the `job-scout` agent (a cloud scheduled task, or your own cron
calling `claude --agent job-scout` in this repo). Each run is a fresh session
with no memory — all state lives in `seed/`, `runs/`, and `data/latest.json`.

## Editing the profile

Edit `seed/profile.md`, `seed/positioning.md`, or `seed/preferences.json`
directly, then push — the next run picks up the change. There's no dashboard
for this on purpose: it's a resume, not something to re-tune per job.

## Tuning job sources

`config/sources.json` — company career board slugs (Greenhouse, Lever,
Ashby), which remote job feeds to use, and the default title filters.
