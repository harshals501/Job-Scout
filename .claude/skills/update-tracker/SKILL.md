---
name: update-tracker
description: Save a job scout run by writing the run file, validating it, and publishing the shortlist to the UI. Use once per profile at the end of a run.
---

# Save the run

## 1. Write the run file

Path: `runs/<YYYY-MM-DD>/<profile_id>.json` (UTC date). Include every scored
candidate, not only the shortlist, so nothing is rescored tomorrow.

```json
{
  "profile_id": "local",
  "run_date": "2026-11-16",
  "scanned": 37,
  "notes": "greenhouse:acme failed (404).",
  "results": [
    {
      "job": {
        "url": "https://…",
        "source": "ashby:notion",
        "company": "Notion",
        "title": "Product Manager, AI",
        "location": "Remote",
        "remote_scope": "worldwide",
        "employment_type": "full_time",
        "salary": null,
        "posted_at": "2026-11-14",
        "description": "First 1,500 characters of the posting."
      },
      "verdict": "shortlist",
      "gate_failed": null,
      "fit_score": 4.2,
      "email_context": "Subject idea, the one real hook, who to address it to.",
      "cover_note": "Two or three sentences grounded in the resume."
    }
  ]
}
```

Field rules:

- `verdict`: `shortlist`, `pass` or `skip`.
- `gate_failed`: `geography`, `job_type`, `role_family`, `deal_breaker` or null.
  For `skip`, `fit_score` may be omitted.
- `remote_scope`: `worldwide`, `emea`, `us_overlap`, `india`, `unclear` or `restricted`.
- `employment_type`: `full_time`, `contract`, `fractional`, `part_time` or `unknown`.
- `email_context` and `cover_note` are present only when `verdict` is `shortlist`.
- Trim `description` to 1,500 characters.

## 2. Validate

```bash
node scripts/db.mjs validate runs/<date>/<profile_id>.json
```

Fix every reported problem and validate again before publishing.

## 3. Publish the shortlist to the UI

Write `data/latest.json` — just the shortlisted jobs, the only thing the UI shows:

```json
{
  "run_date": "2026-11-16",
  "scanned": 37,
  "shortlisted": 3,
  "jobs": [
    {
      "url": "https://…",
      "company": "Notion",
      "role": "Product Manager, AI",
      "fit_score": 4.2,
      "email_context": "…",
      "cover_note": "…"
    }
  ]
}
```

Build it from this run's `shortlist` results only (map `job.title` to `role`).

## 4. Commit and push

```bash
git add runs/ data/latest.json
git commit -m "Run <date>: <n> shortlisted"
git push
```

The UI reads `data/latest.json` straight from GitHub — pushing is what publishes
it. Nothing else to run.
