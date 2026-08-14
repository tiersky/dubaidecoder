'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from './actions';

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Country Decoder</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          Sign in to view your dashboard
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>

          {state?.error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
