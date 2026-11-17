import { getShortlist } from '@/lib/data';

function gradeClass(score: number) {
  if (score >= 4) return '';
  if (score >= 3) return 'low';
  return 'none';
}

export default async function Page() {
  const data = await getShortlist();

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">Job Scout</a>
        {data && <span className="who small">Last run {data.run_date}</span>}
      </header>

      {!data ? (
        <div className="notice">No shortlist yet. It shows up here after the first daily run.</div>
      ) : (
        <div className="stack">
          <div className="stats">
            <div className="stat"><b>{data.scanned}</b><span>Scanned</span></div>
            <div className="stat"><b>{data.shortlisted}</b><span>Shortlisted</span></div>
            <div className="stat"><b>{data.run_date}</b><span>Last run</span></div>
          </div>

          {data.jobs.length === 0 ? (
            <div className="notice">Nothing cleared the bar in the last run.</div>
          ) : (
            <ul className="jobs">
              {data.jobs.map((job) => (
                <li className="card" key={job.url}>
                  <div className="row spread">
                    <div>
                      <h2>{job.role}</h2>
                      <div className="meta">{job.company}</div>
                    </div>
                    <div className="row">
                      <span className={`grade ${gradeClass(job.fit_score)}`}>{job.fit_score.toFixed(1)}</span>
                      <a className="btn" href={job.url} target="_blank" rel="noreferrer">Open posting</a>
                    </div>
                  </div>

                  {job.email_context && (
                    <details style={{ marginTop: 12 }}>
                      <summary className="small muted" style={{ cursor: 'pointer' }}>Email context</summary>
                      <p className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{job.email_context}</p>
                    </details>
                  )}

                  {job.cover_note && (
                    <details style={{ marginTop: 8 }}>
                      <summary className="small muted" style={{ cursor: 'pointer' }}>Cover note</summary>
                      <p className="small" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{job.cover_note}</p>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export const revalidate = 0;
