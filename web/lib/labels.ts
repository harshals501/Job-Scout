export const STATUSES = [
  ['new', 'New'],
  ['saved', 'Saved'],
  ['contacted', 'Contacted'],
  ['applied', 'Applied'],
  ['interviewing', 'Interviewing'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
  ['archived', 'Archived'],
] as const;

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES);

export const REGIONS = [
  ['worldwide', 'Worldwide remote'],
  ['emea', 'Europe / EMEA remote'],
  ['us_overlap', 'US remote, overlap hours'],
  ['india', 'India remote'],
] as const;

export const JOB_TYPES = [
  ['full_time', 'Full-time'],
  ['contract', 'Contract'],
  ['fractional', 'Fractional'],
  ['part_time', 'Part-time'],
] as const;

export const OUTPUTS = [
  ['outreach', 'Outreach email'],
  ['application', 'Cover note and resume tweaks'],
] as const;

export const SCOPE_LABEL: Record<string, string> = {
  worldwide: 'Worldwide',
  emea: 'EMEA',
  us_overlap: 'US, overlap hours',
  india: 'India',
  unclear: 'Remote, region unclear',
  restricted: 'Restricted',
};

export const TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  contract: 'Contract',
  fractional: 'Fractional',
  part_time: 'Part-time',
  unknown: 'Type not stated',
};

export const GATE_LABEL: Record<string, string> = {
  geography: 'Not open to your regions',
  job_type: 'Job type out of scope',
  role_family: 'Different kind of role',
  deal_breaker: 'Hit a deal-breaker',
};

export const DIMENSIONS = [
  ['role_fit', 'Role fit', 30],
  ['ai_depth', 'AI depth', 20],
  ['seniority_fit', 'Seniority', 15],
  ['domain_fit', 'Domain', 15],
  ['reachability', 'Reachability', 10],
  ['company_quality', 'Company', 10],
] as const;

export const FLAG_LABEL: Record<string, string> = {
  confirm_eligibility: 'Confirm location eligibility',
  title_gap: 'Asks for PM title experience',
  salary_not_stated: 'Salary not stated',
  agency_posting: 'Agency posting',
};

export const formatDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
