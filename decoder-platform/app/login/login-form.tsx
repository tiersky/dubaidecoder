'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from './actions';

const initialState: LoginState = {};

const field =
  'glass-input w-full rounded-[12px] px-3.5 py-[11px] text-[15px] text-ink';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>

      {state?.error && (
        <p
          role="alert"
          aria-live="polite"
          className="materialize rounded-[10px] bg-[#ff3b30]/[0.08] px-3 py-2 text-[13px] text-[#c4261d]"
        >
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-3 text-[15px]">
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
