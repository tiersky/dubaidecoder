'use client';

interface PagerProps {
  page: number; // 0-based
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  noun?: string;
}

/** "11–20 of 28" with previous / next. Renders nothing when one page fits. */
export default function Pager({ page, pageSize, total, onPage, noun = 'markets' }: PagerProps) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      <p className="num text-[12px] text-ink-2">
        {from}–{to} of {total} {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <PagerButton label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)} d="M15 18l-6-6 6-6" />
        <span className="num min-w-[3.5rem] text-center text-[12px] font-medium text-ink">
          {page + 1} / {pages}
        </span>
        <PagerButton label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} d="M9 6l6 6-6 6" />
      </div>
    </nav>
  );
}

function PagerButton({ label, disabled, onClick, d }: { label: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-ink transition-colors duration-200 hover:bg-black/[0.09] disabled:pointer-events-none disabled:opacity-35"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d={d} />
      </svg>
    </button>
  );
}
