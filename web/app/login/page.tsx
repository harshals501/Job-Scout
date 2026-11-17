import { hasEnv } from '@/lib/supabase';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main className="login stack">
      <div>
        <h1>Job Scout</h1>
        <p className="muted">A daily shortlist of roles worth your time, with drafts ready to edit.</p>
      </div>
      {hasEnv ? (
        <LoginForm />
      ) : (
        <p className="notice">
          The dashboard is not connected to a database yet. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.
        </p>
      )}
    </main>
  );
}
