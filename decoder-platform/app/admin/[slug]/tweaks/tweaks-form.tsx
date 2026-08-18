'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { VersionConfig } from '@/lib/config/types';
import { applyTweaksAction } from '../../actions';
import type { AdminActionState } from '../../actions';

const initialState: AdminActionState = {};

export function TweaksForm({ slug, config }: { slug: string; config: VersionConfig }) {
  const [state, formAction, pending] = useActionState(applyTweaksAction, initialState);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="slug" value={slug} />

      <div className="glass-card p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Quick tweaks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Adjust budget, currency, weights and enabled markets for &quot;{slug}&quot; and publish a
          new revision instantly — the underlying workbook stays the same.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="defaultBudget" className="block text-xs font-medium text-slate-600">
              Default budget
            </label>
            <input
              id="defaultBudget"
              name="defaultBudget"
              type="number"
              step="any"
              defaultValue={config.defaultBudget}
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-xs font-medium text-slate-600">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              type="text"
              maxLength={3}
              defaultValue={config.currency}
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800 uppercase"
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-800">Metric weights</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Weight</th>
              </tr>
            </thead>
            <tbody>
              {config.metrics.map((m) => (
                <tr key={m.key} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">{m.label}</td>
                  <td className="py-2 pr-3">
                    <input
                      name={`weight:${m.key}`}
                      type="number"
                      step="any"
                      defaultValue={m.weight}
                      className="glass-input w-24 rounded-lg px-2 py-1 text-sm text-slate-800"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-800">Markets</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {config.markets.map((mk) => (
            <label
              key={mk.name}
              className="glass-input flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              <input type="checkbox" name={`market:${mk.name}`} defaultChecked={mk.enabled} />
              {mk.name}
            </label>
          ))}
        </div>
      </div>

      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-8">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Publishing…' : 'Publish tweaks (new revision)'}
        </button>
        <Link
          href="/admin/upload"
          className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
        >
          Need to change data or metrics? Upload a new workbook.
        </Link>
      </div>
    </form>
  );
}
