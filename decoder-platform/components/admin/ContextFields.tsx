import type { VersionContext } from '@/lib/config/types';

const INDUSTRIES = [
  'Tourism & destination marketing',
  'Real estate development',
  'Hospitality & hotels',
  'Aviation',
  'Retail & malls',
  'Events & entertainment',
  'Education',
  'Healthcare & medical tourism',
];

/** Industry + brief inputs shared by the confirm and tweaks forms. */
export default function ContextFields({ context }: { context?: VersionContext }) {
  return (
    <div className="sm:col-span-2 grid grid-cols-1 gap-4">
      <div>
        <label htmlFor="industry" className="block text-xs font-medium text-slate-600">
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          list="industry-options"
          maxLength={120}
          defaultValue={context?.industry ?? ''}
          placeholder="e.g. Real estate development"
          className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
        />
        <datalist id="industry-options">
          {INDUSTRIES.map((i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="brief" className="block text-xs font-medium text-slate-600">
          Brief for AI analysis <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="brief"
          name="brief"
          rows={3}
          maxLength={2000}
          defaultValue={context?.brief ?? ''}
          placeholder="What is being marketed, to whom, and the campaign goal. e.g. Luxury waterfront villas on Palm Jebel Ali for international HNW buyers."
          className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm text-slate-800"
        />
        <p className="mt-1 text-xs text-slate-500">
          Industry and brief shape the AI analysis on each country page. Changing them refreshes it.
        </p>
      </div>
    </div>
  );
}
