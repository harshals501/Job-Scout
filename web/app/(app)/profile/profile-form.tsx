'use client';

import { useActionState } from 'react';
import { saveProfile, type SaveState } from '../actions';
import { JOB_TYPES, OUTPUTS, REGIONS } from '@/lib/labels';
import type { Profile } from '@/lib/supabase';

const joined = (v?: string[]) => (v ?? []).join('\n');

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, {});
  const p = profile.preferences ?? {};
  const isNew = !p.regions;
  const has = (list: string[] | undefined, v: string, fallback: boolean) => (list ? list.includes(v) : fallback);

  return (
    <form action={action} className="stack">
      <section className="card stack">
        <h2>About you</h2>
        <div className="grid2">
          <label>
            Full name
            <input type="text" name="full_name" defaultValue={profile.full_name ?? ''} required />
          </label>
          <label>
            Where you live
            <input type="text" name="home_location" defaultValue={p.home_location ?? ''} placeholder="Pune, India (UTC+5:30)" required />
          </label>
        </div>
        <label>
          Headline
          <input type="text" name="headline" defaultValue={profile.headline ?? ''} placeholder="AI Product Manager · UX Leadership" />
        </label>
        <label>
          Resume
          <span className="hint">Paste the full text of your resume. Plain text is fine.</span>
          <textarea name="resume_text" rows={14} defaultValue={profile.resume_text} required />
        </label>
        <label>
          Positioning and voice
          <span className="hint">
            Optional but valuable: your best proof points, gaps you want handled honestly, and how you like to sound in emails.
          </span>
          <textarea name="positioning_md" rows={8} defaultValue={profile.positioning_md} />
        </label>
      </section>

      <section className="card stack">
        <h2>What to look for</h2>
        <div className="grid2">
          <label>
            Target job titles
            <span className="hint">One per line.</span>
            <textarea name="target_titles" rows={5} defaultValue={joined(p.target_titles)} required />
          </label>
          <label>
            Adjacent titles you would consider
            <span className="hint">One per line. Optional.</span>
            <textarea name="adjacent_titles" rows={5} defaultValue={joined(p.adjacent_titles)} />
          </label>
        </div>
        <div className="grid2">
          <fieldset>
            <legend>Regions you can work for</legend>
            {REGIONS.map(([v, label]) => (
              <label key={v} className="check">
                <input type="checkbox" name="regions" value={v} defaultChecked={has(p.regions, v, v === 'worldwide')} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Job types</legend>
            {JOB_TYPES.map(([v, label]) => (
              <label key={v} className="check">
                <input type="checkbox" name="job_types" value={v} defaultChecked={has(p.job_types, v, v === 'full_time')} />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="grid2">
          <label>
            Deal-breakers
            <span className="hint">One per line. A job that hits any of these is filtered out.</span>
            <textarea name="deal_breakers" rows={4} defaultValue={joined(p.deal_breakers)} />
          </label>
          <label>
            Preferred domains
            <span className="hint">One per line, for example fintech or healthcare.</span>
            <textarea name="preferred_domains" rows={4} defaultValue={joined(p.preferred_domains)} />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>What to prepare</h2>
        <fieldset>
          <legend>For each shortlisted job, draft</legend>
          {OUTPUTS.map(([v, label]) => (
            <label key={v} className="check">
              <input type="checkbox" name="outputs" value={v} defaultChecked={has(p.outputs, v, true)} />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="grid2">
          <label>
            Jobs on the daily shortlist
            <span className="hint">1 to 5.</span>
            <input type="number" name="shortlist_size" min={1} max={5} step={1} defaultValue={p.shortlist_size ?? 5} />
          </label>
          <label>
            Minimum fit score
            <span className="hint">3 to 5. Higher means fewer, stronger matches.</span>
            <input type="number" name="min_score" min={3} max={5} step={0.1} defaultValue={p.min_score ?? 3.5} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" name="paused" defaultChecked={profile.paused} />
          Pause daily runs
        </label>
      </section>

      {state.error && (
        <p className="notice bad" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="notice ok" role="status">
          Profile saved. Changes apply from the next daily run.
        </p>
      )}
      <div>
        <button className="btn primary" disabled={pending}>
          {pending ? 'Saving…' : isNew ? 'Save profile' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
