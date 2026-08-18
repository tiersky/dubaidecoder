'use client';

import { useActionState, useState } from 'react';
import { uploadWorkbookAction } from '../actions';
import type { AdminActionState } from '../actions';

const initialState: AdminActionState = {};

export function UploadForm({ existingSlugs }: { existingSlugs: string[] }) {
  const [state, formAction, pending] = useActionState(uploadWorkbookAction, initialState);
  const [target, setTarget] = useState<'new' | 'existing'>('new');

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Target</legend>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="target"
            value="new"
            checked={target === 'new'}
            onChange={() => setTarget('new')}
          />
          New version
        </label>

        {target === 'new' && (
          <div className="ml-6 space-y-3">
            <div>
              <label htmlFor="slug" className="block text-xs font-medium text-slate-600">
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                placeholder="egypt-decoder"
                className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-600">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Egypt Decoder"
                className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="target"
            value="existing"
            checked={target === 'existing'}
            onChange={() => setTarget('existing')}
          />
          Update existing
        </label>

        {target === 'existing' && (
          <div className="ml-6 space-y-2">
            <select
              name="existingSlug"
              className="glass-input w-full rounded-lg px-3 py-2 text-sm text-slate-800"
            >
              {existingSlugs.length === 0 && <option value="">No published versions</option>}
              {existingSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Uploading replaces any pending draft for that slug.
            </p>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-slate-700">
          Workbook
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx"
          className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
        />
      </div>

      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      {state?.nearMisses && state.nearMisses.length > 0 && (
        <div className="text-sm text-slate-600">
          <p className="font-medium">Where detection almost matched:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.nearMisses.map((m, i) => (
              <li key={i}>
                Sheet &quot;{m.sheetName}&quot; row {m.row}: {m.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
