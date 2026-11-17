---
name: update-tracker
description: Save a job scout run by writing the run file, validating it and syncing it to the database. Use once per profile at the end of a run.
---

# Save the run

## 1. Write the run file

Path: `runs/<YYYY-MM-DD>/<profile_id>.json` (UTC date). Include every scored
candidate, not only the shortlist, so nothing is rescored tomorrow.

```json
{
  "profile_id": "uuid-or-local",
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
      "score": 4.2,
      "grade": "B",
      "dimensions": {
        "role_fit": { "score": 4, "reason": "…" },
        "ai_depth": { "score": 5, "reason": "…" },
        "seniority_fit": { "score": 4, "reason": "…" },
        "domain_fit": { "score": 4, "reason": "…" },
        "reachability": { "score": 3, "reason": "…" },
        "company_quality": { "score": 5, "reason": "…" }
      },
      "summary": "Two sentences at most.",
      "flags": ["title_gap"],
      "draft": {
        "company_brief": "…",
        "hook": "…",
        "hook_source": "https://…",
        "contact_hint": "Head of Product, via LinkedIn",
        "outreach_subject": "…",
        "outreach_body": "…",
        "cover_note": "…",
        "resume_tweaks": [
          { "section": "Experience: SpringCT", "change": "reorder", "detail": "…", "why": "…" }
        ],
        "screening_questions": []
      }
    }
  ]
}
```

Field rules:

- `verdict`: `shortlist`, `pass` or `skip`.
- `gate_failed`: `geography`, `job_type`, `role_family`, `deal_breaker` or null.
  For `skip`, `score`, `grade` and `dimensions` may be null.
- `remote_scope`: `worldwide`, `emea`, `us_overlap`, `india`, `unclear` or `restricted`.
- `employment_type`: `full_time`, `contract`, `fractional`, `part_time` or `unknown`.
- `draft` is present only when `verdict` is `shortlist`. Leave out the outreach or
  application fields the profile's `outputs` did not ask for.
- Trim `description` to 1,500 characters.

## 2. Validate

```bash
node scripts/db.mjs validate runs/<date>/<profile_id>.json
```

Fix every reported problem and validate again before syncing.

## 3. Sync

```bash
node scripts/db.mjs sync runs/<date>/<profile_id>.json
```

In local mode this only confirms the file is valid and leaves it in `runs/`.
Syncing never changes a job's status that the person has already set in the dashboard.
