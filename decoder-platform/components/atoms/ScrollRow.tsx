'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A single horizontal row that scrolls when its items overflow (any number
 * of markets). Arrow buttons appear only on the side that has more, and page
 * by the visible width; edges fade so a cut-off chip reads as "more".
 */
export default function ScrollRow({ label, children, className = '' }: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'} 0, #000 ${edges.start ? '40px' : '0'}, #000 calc(100% - ${
    edges.end ? '40px' : '0px'
  }), ${edges.end ? 'transparent' : '#000'} 100%)`;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        onScroll={measure}
        className="no-scrollbar flex items-center gap-2 overflow-x-auto overscroll-x-contain py-0.5"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
      {edges.start && <PageButton dir={-1} onClick={() => page(-1)} />}
      {edges.end && <PageButton dir={1} onClick={() => page(1)} />}
    </div>
  );
}

function PageButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? 'Show more' : 'Show previous'}
      className={`press absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_0_0_0.5px_rgba(0,0,0,0.1),0_2px_8px_rgba(15,23,42,0.14)] ${
        dir === 1 ? 'right-0' : 'left-0'
      }`}
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d={dir === 1 ? 'M9 6l6 6-6 6' : 'M15 18l-6-6 6-6'} />
      </svg>
    </button>
  );
}
