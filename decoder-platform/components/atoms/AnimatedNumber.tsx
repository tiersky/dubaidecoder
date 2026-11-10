'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  /** ms; tweens are interruptible and always start from the on-screen value. */
  duration?: number;
  className?: string;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Tweens a number from whatever is currently on screen to `value`. Writes
 * textContent directly (no React re-render per frame). React's own text
 * child never changes after mount, so it never fights the tween.
 */
export default function AnimatedNumber({
  value,
  format,
  duration = 480,
  className = '',
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  // Frozen after mount on purpose: React never rewrites the text node.
  const [initialText] = useState(() => format(value));
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    const to = value;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || from === to || !Number.isFinite(from) || !Number.isFinite(to)) {
      shown.current = to;
      el.textContent = formatRef.current(to);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * easeOutExpo(t);
      shown.current = v;
      el.textContent = formatRef.current(t >= 1 ? to : v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  // Re-render when the formatter changes (e.g. currency) without a tween.
  useEffect(() => {
    if (ref.current) ref.current.textContent = format(shown.current);
  }, [format]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {initialText}
    </span>
  );
}
