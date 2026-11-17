import { getShortlist } from '@/lib/data';

function scoreClass(score: number) {
  if (score >= 4) return '';
  if (score >= 3) return 'mid';
  return 'low';
}

export default async function Page() {
  const data = await getShortlist();

  return (
    <div className="shell">
      <section className="hero">
        <span className="kicker">AI Product Management · Remote</span>
        <h1>Job Scout</h1>
        <p className="sub">A daily shortlist of roles worth your time, scored against your profile, with the context ready to write the email.</p>
        {data && <p className="meta-line">Last run {data.run_date}</p>}
      </section>

      {!data ? (
        <div className="empty">
          <div className="glyph">◎</div>
          <h3>No shortlist yet</h3>
          <p>Once the daily run finishes, jobs that clear the bar will show up here.</p>
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><b>{data.scanned}</b><span>Scanned</span></div>
            <div className="stat"><b>{data.shortlisted}</b><span>Shortlisted</span></div>
            <div className="stat"><b>{data.run_date}</b><span>Last run</span></div>
          </div>

          {data.jobs.length === 0 ? (
            <div className="empty">
              <div className="glyph">◎</div>
              <h3>Nothing cleared the bar today</h3>
              <p>{data.scanned} roles were scanned, but none scored high enough to shortlist. Check back tomorrow.</p>
            </div>
          ) : (
            <ul className="jobs">
              {data.jobs.map((job) => (
                <li className="job" key={job.url}>
                  <div className="job-top">
                    <div>
                      <h2>{job.role}</h2>
                      <div className="company">{job.company}</div>
                    </div>
                    <div className="job-actions">
                      <span className={`score ${scoreClass(job.fit_score)}`} title="Fit score">{job.fit_score.toFixed(1)}</span>
                      <a className="btn" href={job.url} target="_blank" rel="noreferrer">
                        Open posting ↗
                      </a>
                    </div>
                  </div>

                  {(job.email_context || job.cover_note) && (
                    <div className="drafts">
                      {job.email_context && (
                        <details className="panel">
                          <summary>Email context</summary>
                          <p className="body">{job.email_context}</p>
                        </details>
                      )}
                      {job.cover_note && (
                        <details className="panel">
                          <summary>Cover note</summary>
                          <p className="body">{job.cover_note}</p>
                        </details>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <footer className="foot">Updated automatically after each daily run.</footer>
    </div>
  );
}

export const revalidate = 0;
