'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardVm } from './derive';
import { defaultPlan, restorePlan, toStored, type Plan } from './plan';

const key = (slug: string) => `decoder-plan:${slug}`;

/**
 * The dashboard's plan, kept for the browser tab's session so it survives
 * switching tabs, opening country pages and reloading. The server render uses
 * the defaults; the stored plan is applied right after mount.
 */
export function usePlan(vm: DashboardVm) {
  const [plan, setPlan] = useState<Plan>(() => defaultPlan(vm));
  // Saving waits until the stored plan has been read, so the defaults of the
  // first render can never overwrite it (effects run twice in dev).
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key(vm.slug));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore of browser-only state after hydration
      if (raw) setPlan(restorePlan(JSON.parse(raw), vm));
    } catch {
      /* storage blocked or corrupt: keep the defaults */
    }
    setRestored(true);
  }, [vm]);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(key(vm.slug), JSON.stringify(toStored(plan)));
    } catch {
      /* storage full or blocked: the plan still holds for this page */
    }
  }, [plan, restored, vm.slug]);

  const update = useCallback((patch: Partial<Plan>) => setPlan((p) => ({ ...p, ...patch })), []);
  const toggleMarket = useCallback(
    (name: string) =>
      setPlan((p) => {
        const enabled = new Set(p.enabled);
        if (enabled.has(name)) enabled.delete(name);
        else enabled.add(name);
        return { ...p, enabled };
      }),
    []
  );
  const reset = useCallback(() => setPlan(defaultPlan(vm)), [vm]);

  return { plan, update, toggleMarket, reset };
}
