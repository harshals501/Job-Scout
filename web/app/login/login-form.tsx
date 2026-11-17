'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from './actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  if (state.sent) {
    return (
      <p className="notice ok" role="status">
        Check your inbox for a sign-in link. Open it in this browser.
      </p>
    );
  }

  return (
    <form action={action} className="card stack">
      <label>
        Email
        <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
      </label>
      {state.error && (
        <p className="notice bad" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn primary" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
