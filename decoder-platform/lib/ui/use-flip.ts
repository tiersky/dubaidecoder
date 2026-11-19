'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

function currentTranslateY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  return new DOMMatrixReadOnly(t).m42;
}

/**
 * FLIP reordering for a list whose children carry `data-flip="<id>"`.
 * When `orderKey` changes, each row glides from where it was on screen to its
 * new place. Interrupting mid-glide continues from the current visual
 * position, so dragging a slider never makes rows jump.
 */
export function useFlip(container: RefObject<HTMLElement | null>, orderKey: string, duration = 420) {
  const prev = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((node) => {
      const id = node.dataset.flip as string;
      const top = node.offsetTop;
      next.set(id, top);
      const before = prev.current.get(id);
      if (before === undefined || reduce) return;
      const visualBefore = before + currentTranslateY(node);
      node.getAnimations().forEach((a) => a.cancel());
      const delta = visualBefore - top;
      if (Math.abs(delta) < 0.5) return;
      node.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration,
        easing: EASE,
      });
    });
    prev.current = next;
  }, [container, orderKey, duration]);
}
