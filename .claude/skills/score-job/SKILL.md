---
name: score-job
description: Score one job posting against the profile using hard gates and a single fit score, producing a verdict. Use for every candidate in a job scout run.
---

# Score a job

Read `profile.md`, `positioning.md` and `preferences.json` once, then score each
candidate. Judge from the posting text only. Do not browse at this stage.

## Step 1: Gates

A job that fails any gate gets `verdict: "skip"`, the failed gate's name in
`gate_failed`, and no draft content. Still record it so it is never rescored.

| Gate | Fails when |
|---|---|
| `geography` | A person living at the profile's `home_location` could not be hired. See the table below. |
| `job_type` | The employment type is not in the profile's `job_types`. |
| `role_family` | The work is not product management, AI product experience, or one of the profile's `adjacent_titles`. |
| `deal_breaker` | Any item in the profile's `deal_breakers` applies. |

### Geography: set `remote_scope`, then apply the gate

| `remote_scope` | Meaning | Passes if profile `regions` includes |
|---|---|---|
| `worldwide` | "Anywhere", "global", "work from any country" | `worldwide` |
| `emea` | Remote across Europe or EMEA with no single-country residency or work-permit requirement | `emea` |
| `us_overlap` | US or Americas company that states it hires internationally or via contractors, needing partial time-zone overlap | `us_overlap` |
| `india` | Remote for India-based candidates | `india` |
| `unclear` | Says "remote" with no region and no eligibility statement | passes |
| `restricted` | Named country or countries only, on-site, hybrid, or requires local work authorisation | never |

"Remote (US)", "Remote, Germany" or "must be authorised to work in X" is `restricted`
unless the posting explicitly says it hires abroad.

## Step 2: Fit score

Judge holistically, weighing (heaviest first): how closely the responsibilities
match what the profile has actually done, how central AI/LLM product work is to
the role, whether the seniority and scope fit, domain fit, whether the profile
clears every stated must-have, and whether the posting itself looks credible
(clear company, real compensation, not an agency repost).

Be honest about must-haves — `positioning.md` lists the profile's known gaps. A
missing must-have pulls the score down; don't argue around it.

Give one number, `fit_score`, 1 to 5, one decimal place. Do not write out the
sub-scores or reasoning — just the number.

## Step 3: Verdict

- `verdict: "shortlist"`: passed all gates, `fit_score` at least the profile's
  `min_score`, and within the top `shortlist_size` of the run.
- `verdict: "pass"`: passed all gates but not shortlisted. No draft content.
- `verdict: "skip"`: failed a gate.
