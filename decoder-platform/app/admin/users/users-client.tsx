'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { PlatformUser } from '@/lib/users/admin';
import {
  createViewerAction,
  createAdminAction,
  resetPasswordAction,
  setUserSlugsAction,
  setUserActiveAction,
} from '../actions';
import type { UserActionState } from '../actions';

const initialState: UserActionState = {};

function ShowOnceBox({ state }: { state: UserActionState }) {
  if (!state.createdPassword) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Password for <span className="font-semibold">{state.forEmail}</span>:{' '}
      <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">{state.createdPassword}</code>{' '}
      — copy it now, it won&apos;t be shown again.
    </div>
  );
}

function RoleBadge({ role }: { role: PlatformUser['role'] }) {
  const label = role ?? 'no role';
  const cls =
    role === 'admin'
      ? 'bg-indigo-100 text-indigo-700'
      : role === 'viewer'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-500';
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
  );
}

function CreateViewerForm({ publishedSlugs }: { publishedSlugs: string[] }) {
  const [state, formAction, pending] = useActionState(createViewerAction, initialState);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <form action={formAction} className="glass-card space-y-6 p-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create viewer</h2>
        <p className="mt-1 text-sm text-slate-500">
          Viewers can sign in and see only the projects checked below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-600">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-600">
            Password (leave blank to generate)
          </label>
          <input
            id="password"
            name="password"
            type="text"
            className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
          />
        </div>
      </div>

      <div>
        <p className="block text-xs font-medium text-slate-600">Projects</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {publishedSlugs.map((slug) => (
            <label
              key={slug}
              className="glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                name="slugs"
                value={slug}
                checked={selected.has(slug)}
                onChange={() => toggle(slug)}
              />
              {slug}
            </label>
          ))}
          {publishedSlugs.length === 0 && (
            <p className="text-sm text-slate-500">No published projects yet.</p>
          )}
        </div>
        {selected.size === 0 && (
          <label className="glass-input mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-800">
            <input type="checkbox" name="confirmNoSlugs" />
            Create with no projects selected anyway (they&apos;ll see nothing until slugs are added).
          </label>
        )}
      </div>

      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <ShowOnceBox state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create viewer'}
      </button>
    </form>
  );
}

function CreateAdminForm() {
  const [state, formAction, pending] = useActionState(createAdminAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={formAction} className="glass-card space-y-6 border-l-4 border-l-amber-400 p-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Create admin</h2>
        <p className="mt-1 text-sm text-amber-800">
          Admins get full access to every project, this admin area, and user management. Existing
          admins can only be changed via the server script.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-email" className="block text-xs font-medium text-slate-600">
            Email
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            required
            className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="block text-xs font-medium text-slate-600">
            Password (leave blank to generate)
          </label>
          <input
            id="admin-password"
            name="password"
            type="text"
            className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
          />
        </div>
      </div>

      <label className="glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-800">
        <input
          type="checkbox"
          name="confirmAdmin"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I understand this account will have full admin access.
      </label>

      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <ShowOnceBox state={state} />

      <button
        type="submit"
        disabled={pending || !confirmed}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create admin'}
      </button>
    </form>
  );
}

function ResetPasswordAction({ user }: { user: PlatformUser }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="email" value={user.email ?? ''} />
      <button
        type="submit"
        disabled={pending}
        className="glass-input glass-card-hover rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Resetting…' : 'Reset password'}
      </button>
      {state?.error && (
        <p role="alert" aria-live="polite" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state?.createdPassword && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          New password: <code className="rounded bg-amber-100 px-1 font-mono">{state.createdPassword}</code>{' '}
          — copy it now, it won&apos;t be shown again.
        </div>
      )}
    </form>
  );
}

function EditSlugsAction({ user, publishedSlugs }: { user: PlatformUser; publishedSlugs: string[] }) {
  const [state, formAction, pending] = useActionState(setUserSlugsAction, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-wrap gap-2">
        {publishedSlugs.map((slug) => (
          <label
            key={slug}
            className="glass-input flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-800"
          >
            <input type="checkbox" name="slugs" value={slug} defaultChecked={user.slugs.includes(slug)} />
            {slug}
          </label>
        ))}
        {publishedSlugs.length === 0 && (
          <p className="text-xs text-slate-500">No published projects yet.</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="glass-input glass-card-hover rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save projects'}
      </button>
      {state?.error && (
        <p role="alert" aria-live="polite" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ActiveToggleAction({ user }: { user: PlatformUser }) {
  const [state, formAction, pending] = useActionState(setUserActiveAction, initialState);
  const [confirmed, setConfirmed] = useState(false);

  if (user.banned) {
    return (
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="active" value="true" />
        <button
          type="submit"
          disabled={pending}
          className="glass-input glass-card-hover rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Reactivating…' : 'Reactivate'}
        </button>
        {state?.error && (
          <p role="alert" aria-live="polite" className="text-xs text-red-600">
            {state.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="active" value="false" />
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Confirm deactivation
      </label>
      <button
        type="submit"
        disabled={pending || !confirmed}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Deactivating…' : 'Deactivate'}
      </button>
      {state?.error && (
        <p role="alert" aria-live="polite" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

function UserRow({ user, publishedSlugs }: { user: PlatformUser; publishedSlugs: string[] }) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-3 pr-3 text-slate-800">{user.email ?? '—'}</td>
      <td className="py-3 pr-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="py-3 pr-3 text-xs text-slate-500">
        {user.role === 'viewer' ? (user.slugs.length > 0 ? user.slugs.join(', ') : '(none)') : '—'}
      </td>
      <td className="py-3 pr-3 text-xs text-slate-500">
        {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'Never'}
      </td>
      <td className="py-3 pr-3 text-xs">
        <span
          className={`rounded px-2 py-0.5 font-medium ${
            user.banned ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {user.banned ? 'deactivated' : 'active'}
        </span>
      </td>
      <td className="py-3 pr-3">
        {user.role === 'admin' ? (
          <p className="text-xs text-slate-400">managed via script</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ResetPasswordAction user={user} />
            <EditSlugsAction user={user} publishedSlugs={publishedSlugs} />
            <ActiveToggleAction user={user} />
          </div>
        )}
      </td>
    </tr>
  );
}

export function UsersClient({
  users,
  publishedSlugs,
}: {
  users: PlatformUser[];
  publishedSlugs: string[];
}) {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="glass-card flex items-center justify-between p-8">
          <h1 className="text-2xl font-semibold text-slate-800">Users</h1>
          <Link
            href="/admin"
            className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
          >
            Back to admin
          </Link>
        </div>

        <CreateViewerForm publishedSlugs={publishedSlugs} />
        <CreateAdminForm />

        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-slate-800">All users</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Projects</th>
                  <th className="py-2 pr-3">Last sign-in</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} publishedSlugs={publishedSlugs} />
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-slate-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
