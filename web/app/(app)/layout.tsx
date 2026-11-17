import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProfile, hasEnv } from '@/lib/supabase';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasEnv) redirect('/login');
  const { user, profile } = await getProfile();
  if (!user) redirect('/login');

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Job Scout
        </Link>
        <nav aria-label="Main">
          <Link href="/">Jobs</Link>
          <Link href="/profile">Profile</Link>
        </nav>
        <span className="who">{profile?.full_name || user.email}</span>
        <form action="/auth/signout" method="post">
          <button className="btn">Sign out</button>
        </form>
      </header>
      <main className="stack">{children}</main>
    </div>
  );
}
