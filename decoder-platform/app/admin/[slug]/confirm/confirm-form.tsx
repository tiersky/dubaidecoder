'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import type { DraftRecord } from '@/lib/versions/store';
import type { VerificationCheck } from '@/lib/parser/verify';
import { saveDraftEditsAction, publishDraftAction } from '../../actions';
import type { AdminActionState } from '../../actions';

const initialState: AdminActionState = {};

export function ConfirmForm({ draft }: { draft: DraftRecord }) {
  const [saveState, saveAction, savePending] = useActionState(saveDraftEditsAction, initialState);
  const [publishState, publishAction, publishPending] = useActionState(
    publishDraftAction,
    initialState
  );

  // Track which button was clicked last so the error banner reflects the
  // most recent submission, not whichever action last happened to have an
  // error set — useActionState state persists per hook across submits, so
  // a stale save error would otherwise outlive a later, differently-failing
  // publish attempt (or vice versa).
  const [lastIntent, setLastIntent] = useState<'save' | 'publish' | null>(null);

  const { config, verify } = draft;
  const state = lastIntent === 'publish' ? publishState : saveState;
  const pending = savePending || publishPending;

  const worstChecks: VerificationCheck[] = verify
    ? [...verify.checks].sort((a, b) => b.delta - a.delta).slice(0, 20)
    : [];

  return (
    <form className="space-y-8">
      <input type="hidden" name="slug" value={draft.slug} />

      <div className="glass-card p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Confirm draft</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and edit before publishing &quot;{draft.slug}&quot;.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={config.name}
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="slug-display" className="block text-xs font-medium text-slate-600">
              Slug
            </label>
            <input
              id="slug-display"
              type="text"
              value={draft.slug}
              readOnly
              disabled
              className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-500"
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
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-800">Metrics</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="py-2 pr-3">Label</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2 pr-3">Direction</th>
                <th className="py-2 pr-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {config.metrics.map((m) => (
                <tr key={m.key} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <input
                      name={`label:${m.key}`}
                      type="text"
                      defaultValue={m.label}
                      className="glass-input w-full rounded-lg px-2 py-1 text-sm text-slate-800"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      name={`weight:${m.key}`}
                      type="number"
                      step="any"
                      defaultValue={m.weight}
                      className="glass-input w-24 rounded-lg px-2 py-1 text-sm text-slate-800"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      name={`direction:${m.key}`}
                      defaultValue={m.direction}
                      className="glass-input rounded-lg px-2 py-1 text-sm text-slate-800"
                    >
                      <option value="higher">higher</option>
                      <option value="lower">lower</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{m.source ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Direction was auto-guessed — a wrong direction silently poisons scores.
        </p>
      </div>

      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-800">Markets</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {config.markets.map((mk) => (
            <label
              key={mk.name}
              className="glass-input flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              <span className="flex items-center gap-2">
                <input type="checkbox" name={`market:${mk.name}`} defaultChecked={mk.enabled} />
                {mk.name}
              </span>
              {mk.iso2 === null ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  no map pin
                </span>
              ) : (
                <span className="text-xs text-slate-400">{mk.iso2}</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-slate-800">Verify against workbook</h2>
        {!verify && <p className="mt-3 text-sm text-slate-500">No verification data available.</p>}
        {verify && verify.ok && (
          <p className="mt-3 text-sm text-emerald-700">
            matches workbook ✓ ({verify.checks.length} checks)
          </p>
        )}
        {verify && !verify.ok && (
          <div className="mt-3 space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
              {verify.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left font-medium text-slate-500">
                    <th className="py-2 pr-3">Market</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">Metric</th>
                    <th className="py-2 pr-3">Computed</th>
                    <th className="py-2 pr-3">Workbook</th>
                    <th className="py-2 pr-3">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {worstChecks.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 text-slate-700">
                      <td className="py-1.5 pr-3">{c.market}</td>
                      <td className="py-1.5 pr-3">{c.kind}</td>
                      <td className="py-1.5 pr-3">{c.metricKey ?? '—'}</td>
                      <td className="py-1.5 pr-3">{c.computed.toFixed(4)}</td>
                      <td className="py-1.5 pr-3">{c.workbook.toFixed(4)}</td>
                      <td className="py-1.5 pr-3">{c.delta.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Diffs are expected after you edit weights — the comparison is against the workbook
              as uploaded.
            </p>
          </div>
        )}
      </div>

      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-8">
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            formAction={saveAction}
            onClick={() => setLastIntent('save')}
            disabled={pending}
            className="glass-input glass-card-hover rounded-lg px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="submit"
            formAction={publishAction}
            onClick={() => setLastIntent('publish')}
            disabled={pending}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishPending ? 'Publishing…' : 'Publish'}
          </button>
        </div>
        <Link
          href={`/admin/${draft.slug}/preview`}
          className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
        >
          Preview dashboard
        </Link>
      </div>
    </form>
  );
}
