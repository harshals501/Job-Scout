import { getProfile } from '@/lib/supabase';
import ProfileForm from './profile-form';

export default async function ProfilePage() {
  const { profile } = await getProfile();
  if (!profile) return <p className="notice">Your profile is still being created. Refresh in a moment.</p>;

  return (
    <>
      <div>
        <h1>Your profile</h1>
        <p className="muted">
          The scout matches jobs against exactly what is written here, and drafts only from these facts.
          {profile.approved ? ' Daily runs are on.' : ' Daily runs start once the owner approves your account.'}
        </p>
      </div>
      <ProfileForm profile={profile} />
    </>
  );
}
