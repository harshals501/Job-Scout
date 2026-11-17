import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const hasEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Server-side client bound to the signed-in user's session cookies.
// Row-level security in the database limits every query to that user's rows.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  return { supabase, user, profile: profile as Profile | null };
}

export type Preferences = {
  home_location?: string;
  target_titles?: string[];
  adjacent_titles?: string[];
  regions?: string[];
  job_types?: string[];
  deal_breakers?: string[];
  preferred_domains?: string[];
  shortlist_size?: number;
  min_score?: number;
  outputs?: string[];
  [key: string]: unknown;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  headline: string | null;
  resume_text: string;
  positioning_md: string;
  preferences: Preferences;
  approved: boolean;
  paused: boolean;
};

export type Job = {
  url: string;
  source: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  remote_scope: string | null;
  employment_type: string | null;
  salary: string | null;
  posted_at: string | null;
  description: string | null;
};

export type Dimension = { score: number; reason?: string };

export type Draft = {
  company_brief: string | null;
  hook: string | null;
  hook_source: string | null;
  contact_hint: string | null;
  outreach_subject: string | null;
  outreach_body: string | null;
  cover_note: string | null;
  resume_tweaks: { section?: string; change?: string; detail?: string; why?: string }[];
  screening_questions: { question?: string; answer?: string }[] | string[];
};

export type Match = {
  id: string;
  run_date: string;
  verdict: 'shortlist' | 'pass' | 'skip';
  gate_failed: string | null;
  score: number | null;
  grade: string | null;
  dimensions: Record<string, Dimension> | null;
  summary: string | null;
  flags: string[];
  status: string;
  jobs: Job;
  drafts?: Draft | Draft[] | null;
};
