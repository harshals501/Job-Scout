import Link from 'next/link';
import { getProfile, type Match } from '@/lib/supabase';
import { GATE_LABEL, SCOPE_LABEL, STATUS_LABEL, TYPE_LABEL, formatDate } from '@/lib/labels';

const VIEWS = [
  ['shortlist', 'Shortlist'],
  ['tracking', 'Tracking'],
  ['passed', 'Scored, not shortlisted'],
  ['skipped', 'Filtered out'],
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view = VIEWS.some(([v]) => v === rawView) ? rawView! : 'shortlist';
  const { supabase, profile } = await getProfile();

  if (!profile) {
    return <p className="notice">Your profile is still being created. Refresh in a moment.</p>;
  }

  let query = supabase
    .from('matches')
    .select('id, run_date, verdict, gate_failed, score, grade, summary, flags, status, jobs(url, company, title, location, remote_scope, employment_type, salary)')
    .eq('profile_id', profile.id)
    .order('run_date', { ascending: false })
    .order('score', { ascending: false, nullsFirst: false })
    .limit(100);

  if (view === 'shortlist') query = query.eq('verdict', 'shortlist').in('status', ['new', 'saved']);
  if (view === 'tracking') query = query.in('status', ['contacted', 'applied', 'interviewing', 'offer', 'rejected']);
  if (view === 'passed') query = query.eq('verdict', 'pass');
  if (view === 'skipped') query = query.eq('verdict', 'skip');

  const [{ data: rows, error }, { data: lastRun }, { count: tracking }] = await Promise.all([
    query,
    supabase.from('runs').select('run_date, scanned, scored, shortlisted, notes').eq('profile_id', profile.id).order('run_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).in('status', ['contacted', 'applied', 'interviewing', 'offer']),
  ]);
  const matches = (rows ?? []) as unknown as Match[];
  const needsResume = profile.resume_text.trim().length < 200;

  return (
    <>
      {needsResume && (
        <p className="notice">
          Add your resume on the <Link href="/profile">profile page</Link> so the scout has something to match against.
        </p>
      )}
      {!needsResume && !profile.approved && (
        <p className="notice">Your profile is saved. Daily runs start once the owner approves your account.</p>
      )}
      {profile.paused && <p className="notice">Daily runs are paused. Turn them back on from your profile.</p>}

      <section className="stats" aria-label="Latest run">
        <div className="stat">
          <b>{lastRun ? formatDate(lastRun.run_date) : '–'}</b>
          <span>Last run</span>
        </div>
        <div className="stat">
          <b>{lastRun?.scored ?? 0}</b>
          <span>New roles scored</span>
        </div>
        <div className="stat">
          <b>{lastRun?.shortlisted ?? 0}</b>
          <span>Shortlisted</span>
        </div>
        <div className="stat">
          <b>{tracking ?? 0}</b>
          <span>In progress</span>
        </div>
      </section>

      <nav className="tabs" aria-label="Views">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={v === 'shortlist' ? '/' : `/?view=${v}`} aria-current={v === view ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {error && <p className="notice bad">Could not load jobs: {error.message}</p>}

      {!error && matches.length === 0 && (
        <p className="muted">
          {view === 'shortlist'
            ? 'Nothing on the shortlist right now. New roles appear here after the next daily run.'
            : 'Nothing here yet.'}
        </p>
      )}

      <ul className="jobs">
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={`/jobs/${m.id}`} className="card job">
              <span className={`grade ${m.grade ? (m.grade <= 'B' ? '' : 'low') : 'none'}`} aria-label={m.grade ? `Grade ${m.grade}` : 'Not scored'}>
                {m.grade ?? '–'}
              </span>
              <div>
                <h2>{m.jobs.title}</h2>
                <p className="meta">
                  {[m.jobs.company, SCOPE_LABEL[m.jobs.remote_scope ?? ''] ?? m.jobs.location, TYPE_LABEL[m.jobs.employment_type ?? ''], m.jobs.salary]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="summary">{m.verdict === 'skip' ? GATE_LABEL[m.gate_failed ?? ''] ?? 'Filtered out' : m.summary}</p>
              </div>
              <div className="side">
                {m.score !== null && <span className="small muted">{Number(m.score).toFixed(1)} / 5</span>}
                <span className={`chip ${m.status === 'new' ? '' : 'on'}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                <span className="small muted">{formatDate(m.run_date)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {lastRun?.notes && <p className="small muted">Run notes: {lastRun.notes}</p>}
    </>
  );
}
