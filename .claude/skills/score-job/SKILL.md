---
name: score-job
description: Score one job posting against one profile using hard gates and six weighted dimensions, producing a 1-5 score, a grade and a verdict. Use for every candidate in a job scout run.
---

# Score a job

Read the profile's `profile.md`, `positioning.md` and `preferences.json` once, then
score each candidate. Judge from the posting text only. Do not browse at this stage.

## Step 1: Gates

A job that fails any gate gets `verdict: "skip"`, the failed gate's name in
`gate_failed`, and no draft. Still record it so it is never rescored.

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
| `unclear` | Says "remote" with no region and no eligibility statement | passes, add the flag `confirm_eligibility` |
| `restricted` | Named country or countries only, on-site, hybrid, or requires local work authorisation | never |

"Remote (US)", "Remote, Germany" or "must be authorised to work in X" is `restricted`
unless the posting explicitly says it hires abroad.

## Step 2: Dimensions

Score each from 1 to 5 in whole numbers. Write one short reason for each.

| Dimension | Weight | 5 means | 1 means |
|---|---|---|---|
| `role_fit` | 30% | Responsibilities match what the profile has actually done | Mostly work the profile has never done |
| `ai_depth` | 20% | AI or LLM product is the core of the job | AI is a buzzword in the posting |
| `seniority_fit` | 15% | Level matches the profile's years and scope | Far too junior or requires scope the profile lacks |
| `domain_fit` | 15% | Domain is in `preferred_domains` or strongly evidenced in the profile | Unfamiliar domain needing deep prior expertise |
| `reachability` | 10% | Profile clears every stated must-have | A hard must-have is missing, such as "5+ years as a Product Manager" at a company that will screen on titles |
| `company_quality` | 10% | Remote-first, clear compensation, credible product | Vague posting, agency reposting, no real company detail |

Be honest about `reachability`. The profile's `positioning.md` lists its known gaps.
A must-have the profile misses is a low score, not something to argue around.

## Step 3: Score, grade, verdict

```
score = 0.30*role_fit + 0.20*ai_depth + 0.15*seniority_fit
      + 0.15*domain_fit + 0.10*reachability + 0.10*company_quality
```

Round to one decimal.

| Grade | Score |
|---|---|
| A | 4.5 and above |
| B | 4.0 to 4.4 |
| C | 3.5 to 3.9 |
| D | 3.0 to 3.4 |
| F | below 3.0 |

- `verdict: "shortlist"`: passed all gates, score at least the profile's `min_score`,
  and within the top `shortlist_size` of the run.
- `verdict: "pass"`: passed all gates but not shortlisted. No draft.
- `verdict: "skip"`: failed a gate.

## Step 4: Summary

Write a `summary` of two sentences at most: why this role fits or does not, naming
the single strongest match and the single biggest risk. Add `flags` such as
`confirm_eligibility`, `title_gap`, `salary_not_stated`, `agency_posting`.
