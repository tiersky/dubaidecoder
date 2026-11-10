'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface SegmentedControlProps {
  items: Array<{ id: string; label: string; shortLabel?: string }>;
  value: string;
  onChange: (id: string) => void;
  label: string;
}

export default function SegmentedControl({ items, value, onChange, label }: SegmentedControlProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = itemRefs.current[value];
    if (!el) return;
    setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Enable the glide only after the first placement, so the thumb never
  // animates in from x=0 on load. Re-measure when fonts swap in.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    const root = rootRef.current;
    const ro = root ? new ResizeObserver(() => measure()) : null;
    if (root && ro) ro.observe(root);
    return () => {
      cancelAnimationFrame(id);
      ro?.disconnect();
    };
  }, [measure]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = items.findIndex((i) => i.id === value);
    const next = items[(idx + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    onChange(next.id);
    itemRefs.current[next.id]?.focus();
  };

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={label}
      className="segmented"
      data-ready={ready}
      onKeyDown={onKeyDown}
    >
      {thumb && (
        <span
          aria-hidden
          className="segmented-thumb"
          style={{ width: thumb.w, transform: `translateX(${thumb.x - 3}px)`, left: 3 }}
        />
      )}
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              itemRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className="segmented-item"
          >
            {item.shortLabel ? (
              <>
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </>
            ) : (
              item.label
            )}
          </button>
        );
      })}
    </div>
  );
}
