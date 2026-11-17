// The only data source: data/latest.json, committed to the repo by the agent's
// daily run and fetched straight from GitHub. No database, no API key.

const REPO = 'harshals501/Job-Scout';
const BRANCH = 'main';

export type ShortlistJob = {
  url: string;
  company: string;
  role: string;
  fit_score: number;
  email_context?: string;
  cover_note?: string;
};

export type Shortlist = {
  run_date: string;
  scanned: number;
  shortlisted: number;
  jobs: ShortlistJob[];
};

export async function getShortlist(): Promise<Shortlist | null> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/latest.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  try {
    return (await res.json()) as Shortlist;
  } catch {
    return null;
  }
}
