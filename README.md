# Job Scout

A daily job-search engine that runs in Claude Code, saves to Supabase, and shows
results in a Next.js dashboard on Vercel. It finds new remote roles, scores them
against each person's profile, and drafts an outreach email, cover note and resume
tweaks for the best few. It never sends or submits anything.

```
GitHub repo ──> daily Claude Code routine ──> Supabase ──> Vercel dashboard
(agent, skills,     (scan, score, draft)      (jobs, scores,   (review, edit,
 config)                                       drafts)          track status)
```

## What has and has not been tested

| Part | State |
|---|---|
| Job fetcher filters, dedupe, HTML cleanup | Tested offline against fixtures (`npm test`) |
| Run-file validator | Tested offline (`npm test`) |
| Dashboard | Compiles with `next build`; layout checked against sample markup |
| Live job-site APIs | Not tested. The build environment could not reach them |
| Supabase schema and sync | Not run against a live project |
| Sign-in flow | Not run against a live project |
| Company slugs in `config/sources.json` | Starter list, unverified |

Expect to fix a few things on the first live run. Step 4 below is where they surface.

## Setup

### 1. Repository

Create a private GitHub repository and push this folder to it.

### 2. Supabase

1. Create a project.
2. Open the SQL editor, paste `supabase/schema.sql`, run it.
3. Authentication → URL configuration: set the site URL to your Vercel domain and add
   `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
4. Note the project URL, the anon (publishable) key and the service role (secret) key.

Supabase's built-in email sender is meant for testing and allows only a few sign-in
emails per hour. Add your own SMTP provider before inviting more than a couple of people.

### 3. Vercel

1. Import the repository. Set the root directory to `web`.
2. Add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy, open the site, and sign in with your email once. This creates your profile row.

Never add the service role key to Vercel. The dashboard does not need it.

### 4. Load your profile and do a manual run

```bash
export SUPABASE_URL=https://YOUR-PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...        # keep this out of git
node scripts/db.mjs seed you@example.com    # loads seed/ into your profile and approves it
claude --agent job-scout                    # then type: Run the job scout
```

To try it with no database at all, skip the two exports. Results then stay in `runs/`.

After the first run, read the report for failed sources and fix the slugs in
`config/sources.json`. Read a few scores and drafts critically and adjust
`.claude/skills/score-job/SKILL.md` and `seed/positioning.md` until the shortlist
matches your own judgement. Do this for a week before scheduling.

### 5. Schedule it

Create a cloud routine in Claude Code pointing at this repository, scheduled daily.

- **Prompt:** `Run the job-scout agent for all active profiles, then give me the report.`
- **Environment variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Network access:** the routine must be allowed to reach your Supabase host and the job sites:
  `boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, `remotive.com`,
  `remoteok.com`, `jobicy.com`, `himalayas.app`.

If the routine cannot be given network access to these hosts, the fallback is to run
`scripts/fetch-jobs.mjs` somewhere that can (a GitHub Action, for example) and commit
the candidates for the routine to score.

### 6. Adding friends and family

1. They sign in on the dashboard and fill in the profile page.
2. You run `node scripts/db.mjs approve their@email.com`.
3. The next daily run includes them. They can pause themselves from their profile.

Every approved profile adds to your Claude usage each day. Check your plan's terms
before running this for other people.

## Day to day

| Task | Where |
|---|---|
| Add or remove companies and feeds | `config/sources.json` |
| Change which titles are picked up | `defaults.title_include` / `title_exclude` in the same file |
| Change how jobs are scored | `.claude/skills/score-job/SKILL.md` (keep the weights in `scripts/db.mjs` in step) |
| Change how emails sound | Positioning and voice on the profile page |
| Run the offline checks | `npm test` |

## Privacy

- Each person sees only their own jobs, scores and drafts. Row-level security enforces this in the database.
- Resumes live in the database, not in git. `seed/` holds only the owner's profile; delete it after seeding if you prefer.
- The service role key bypasses all of the above. Store it only in the routine's environment.
