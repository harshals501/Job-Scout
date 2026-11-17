'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getProfile, type Preferences } from '@/lib/supabase';
import { STATUSES } from '@/lib/labels';

export type SaveState = { ok?: boolean; error?: string };

export async function updateStatus(matchId: string, status: string): Promise<SaveState> {
  if (!STATUSES.some(([s]) => s === status)) return { error: 'Unknown status.' };
  const supabase = await createClient();
  const { error } = await supabase.from('matches').update({ status }).eq('id', matchId);
  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath(`/jobs/${matchId}`);
  return { ok: true };
}

export async function saveDraft(
  matchId: string,
  fields: { outreach_subject?: string; outreach_body?: string; cover_note?: string },
): Promise<SaveState> {
  const allowed: Record<string, string> = {};
  for (const k of ['outreach_subject', 'outreach_body', 'cover_note'] as const) {
    if (typeof fields[k] === 'string') allowed[k] = fields[k]!.slice(0, 8000);
  }
  const supabase = await createClient();
  const { error } = await supabase.from('drafts').update(allowed).eq('match_id', matchId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${matchId}`);
  return { ok: true };
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const { supabase, profile } = await getProfile();
  if (!profile) return { error: 'You are signed out. Sign in again.' };

  const resume = String(formData.get('resume_text') ?? '').trim();
  if (resume.length < 200) return { error: 'Paste your full resume text. It looks too short to match against.' };

  const regions = formData.getAll('regions').map(String);
  const jobTypes = formData.getAll('job_types').map(String);
  const outputs = formData.getAll('outputs').map(String);
  if (!regions.length) return { error: 'Choose at least one region.' };
  if (!jobTypes.length) return { error: 'Choose at least one job type.' };
  if (!outputs.length) return { error: 'Choose at least one thing for the scout to draft.' };

  const targets = lines(formData.get('target_titles'));
  if (!targets.length) return { error: 'Add at least one target job title.' };

  const clamp = (v: FormDataEntryValue | null, lo: number, hi: number, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };

  // Keep any advanced keys already stored (for example custom title filters).
  const preferences: Preferences = {
    ...profile.preferences,
    home_location: String(formData.get('home_location') ?? '').trim().slice(0, 120),
    target_titles: targets,
    adjacent_titles: lines(formData.get('adjacent_titles')),
    regions,
    job_types: jobTypes,
    deal_breakers: lines(formData.get('deal_breakers')),
    preferred_domains: lines(formData.get('preferred_domains')),
    outputs,
    shortlist_size: Math.round(clamp(formData.get('shortlist_size'), 1, 5, 5)),
    min_score: clamp(formData.get('min_score'), 3, 5, 3.5),
  };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: String(formData.get('full_name') ?? '').trim().slice(0, 120),
      headline: String(formData.get('headline') ?? '').trim().slice(0, 200),
      resume_text: resume.slice(0, 30000),
      positioning_md: String(formData.get('positioning_md') ?? '').trim().slice(0, 10000),
      paused: formData.get('paused') === 'on',
      preferences,
    })
    .eq('id', profile.id);

  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}
