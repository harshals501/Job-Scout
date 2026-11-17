import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProfile, type Draft, type Match } from '@/lib/supabase';
import { DIMENSIONS, FLAG_LABEL, GATE_LABEL, SCOPE_LABEL, TYPE_LABEL, formatDate } from '@/lib/labels';
import StatusSelect from './status-select';
import DraftEditor from './draft-editor';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase } = await getProfile();
  const { data } = await supabase.from('matches').select('*, jobs(*), drafts(*)').eq('id', id).maybeSingle();
  if (!data) notFound();

  const m = data as unknown as Match;
  const job = m.jobs;
  const draft: Draft | null = Array.isArray(m.drafts) ? m.drafts[0] ?? null : m.drafts ?? null;
  const safeUrl = /^https?:\/\//.test(job.url) ? job.url : '#';
  const safeHook = draft?.hook_source && /^https?:\/\//.test(draft.hook_source) ? draft.hook_source : null;

  return (
    <>
      <Link href="/" className="small muted">
        ← All jobs
      </Link>

      <header className="row spread">
        <div>
          <h1>{job.title}</h1>
          <p className="muted">
            {[job.company, job.location, SCOPE_LABEL[job.remote_scope ?? ''], TYPE_LABEL[job.employment_type ?? ''], job.salary]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="row">
          <StatusSelect matchId={m.id} status={m.status} />
          <a className="btn primary" href={safeUrl} target="_blank" rel="noopener noreferrer">
            View posting
          </a>
        </div>
      </header>

      <section className="card stack">
        <div className="row spread">
          <h2>
            {m.verdict === 'skip'
              ? `Filtered out: ${GATE_LABEL[m.gate_failed ?? ''] ?? 'did not pass a gate'}`
              : `Fit: ${Number(m.score).toFixed(1)} / 5 (grade ${m.grade})`}
          </h2>
          <span className="small muted">Found {formatDate(m.run_date)}</span>
        </div>
        {m.summary && <p>{m.summary}</p>}
        {m.flags?.length > 0 && (
          <div className="row">
            {m.flags.map((f) => (
              <span key={f} className="chip warn">
                {FLAG_LABEL[f] ?? f.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
        )}
        {m.dimensions && (
          <div className="dims">
            {DIMENSIONS.map(([key, label, weight]) => {
              const d = m.dimensions?.[key];
              if (!d) return null;
              return (
                <div className="dim" key={key}>
                  <span>
                    {label} <span className="muted small">{weight}%</span>
                  </span>
                  <span className="bar" role="img" aria-label={`${d.score} out of 5`}>
                    <i style={{ width: `${d.score * 20}%` }} />
                  </span>
                  <span className="muted">{d.reason}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {draft && (
        <>
          {(draft.company_brief || draft.hook || draft.contact_hint) && (
            <section className="card stack">
              <h2>Company notes</h2>
              {draft.company_brief && <p>{draft.company_brief}</p>}
              {draft.hook && (
                <p>
                  <span className="muted">Recent: </span>
                  {draft.hook}{' '}
                  {safeHook && (
                    <a href={safeHook} target="_blank" rel="noopener noreferrer" className="small">
                      source
                    </a>
                  )}
                </p>
              )}
              {draft.contact_hint && (
                <p>
                  <span className="muted">Who to contact: </span>
                  {draft.contact_hint}
                </p>
              )}
            </section>
          )}

          {draft.outreach_body !== null && (
            <DraftEditor
              matchId={m.id}
              kind="outreach"
              title="Outreach email"
              hint="A draft for you to edit and send yourself. Check every fact before sending."
              subject={draft.outreach_subject ?? ''}
              body={draft.outreach_body ?? ''}
            />
          )}

          {draft.cover_note !== null && (
            <DraftEditor
              matchId={m.id}
              kind="cover"
              title="Cover note"
              hint="For the application form."
              body={draft.cover_note ?? ''}
            />
          )}

          {draft.resume_tweaks?.length > 0 && (
            <section className="card stack">
              <h2>Resume tweaks for this role</h2>
              <ol className="tweaks">
                {draft.resume_tweaks.map((t, i) => (
                  <li key={i}>
                    <strong>{t.section}</strong> <span className="chip">{t.change}</span>
                    <div>{t.detail}</div>
                    {t.why && <div className="small muted">Why: {t.why}</div>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {draft.screening_questions?.length > 0 && (
            <section className="card stack">
              <h2>Screening questions</h2>
              <ol className="tweaks">
                {draft.screening_questions.map((q, i) =>
                  typeof q === 'string' ? (
                    <li key={i}>{q}</li>
                  ) : (
                    <li key={i}>
                      <strong>{q.question}</strong>
                      <div>{q.answer}</div>
                    </li>
                  ),
                )}
              </ol>
            </section>
          )}
        </>
      )}

      {job.description && (
        <section className="card stack">
          <h2>From the posting</h2>
          <p className="pre muted small">{job.description}</p>
        </section>
      )}
    </>
  );
}
