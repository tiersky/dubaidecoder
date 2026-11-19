'use client';

import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { DashboardVm, computeAllocations } from '@/lib/dashboard/derive';
import { computeAllocation, type AllocationRequest } from '@/lib/model/allocation';
import { nextIncrement, simulateAllocation } from '@/lib/model/uncertainty';
import ModelExplainer from '@/components/organisms/ModelExplainer';
import GlassCard from '@/components/atoms/GlassCard';
import SelectDropdown from '@/components/atoms/SelectDropdown';
import BudgetInputField from '@/components/molecules/BudgetInputField';
import ChartCard from '@/components/molecules/ChartCard';
import BubbleChart from '@/components/organisms/BubbleChart';
import BudgetTreemap from '@/components/organisms/BudgetTreemap';
import ModelWeightsPanel from '@/components/organisms/ModelWeightsPanel';
import BudgetTable from '@/components/organisms/BudgetTable';

interface BudgetAllocationProps {
  vm: DashboardVm;
}

export default function BudgetAllocation({ vm }: BudgetAllocationProps) {
  const [xAxis, setXAxis] = useState(vm.defaults.xAxis);
  const [yAxis, setYAxis] = useState(vm.defaults.yAxis);
  const [bubbleSize, setBubbleSize] = useState(vm.defaults.bubbleSize);
  const [totalBudget, setTotalBudget] = useState(vm.defaultBudget);
  const [modelWeightsEnabled, setModelWeightsEnabled] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>({
    ...vm.defaultWeights,
  });
  const [enabledNames, setEnabledNames] = useState<Set<string>>(
    () => new Set(vm.markets.filter((m) => m.enabled).map((m) => m.name))
  );

  const toggleMarket = useCallback((name: string) => {
    setEnabledNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const enabledMarkets = useMemo(
    () => vm.markets.filter((m) => enabledNames.has(m.name)),
    [vm.markets, enabledNames]
  );

  // Toggling a market changes the allocation country list: v2 statistics are
  // recomputed as if it had never been in the list.
  const universe = useMemo(
    () => (vm.universe ?? vm.markets.map((m) => m.name)).filter((n) => enabledNames.has(n)),
    [vm.universe, vm.markets, enabledNames]
  );
  const v2 = vm.model !== 'workbook';
  const allocations = useMemo(
    () =>
      computeAllocations(vm.markets, vm.metrics, weights, enabledNames, totalBudget, vm.allocation, {
        model: vm.model,
        ...(v2 && { universe }),
        controls: vm.marketControls,
        planning: vm.planning,
        concentration: vm.concentration,
      }),
    [vm, weights, enabledNames, totalBudget, universe, v2]
  );

  const request: AllocationRequest = useMemo(
    () => ({
      model: vm.model,
      metrics: vm.metrics.map((m) => ({ ...m, weight: weights[m.key] ?? 0 })),
      markets: vm.markets,
      budget: totalBudget,
      funded: enabledNames,
      ...(v2 && { universe: new Set(universe) }),
      allocation: vm.allocation,
      controls: vm.marketControls,
      planning: vm.planning,
      concentration: vm.concentration,
    }),
    [vm, weights, totalBudget, enabledNames, universe, v2]
  );
  // The simulation trails slider drags instead of blocking them.
  const deferred = useDeferredValue(request);
  const uncertainty = useMemo(() => (v2 && deferred.budget > 0 ? simulateAllocation(deferred, 400) : null), [deferred, v2]);
  const step = useMemo(() => {
    const raw = totalBudget * 0.05;
    const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
    return Math.max(mag, Math.round(raw / mag) * mag);
  }, [totalBudget]);
  const next = useMemo(() => (deferred.budget > 0 ? nextIncrement(deferred, step) : []), [deferred, step]);
  const warnings = useMemo(() => (v2 ? computeAllocation(deferred).warnings : []), [deferred, v2]);
  const recommended = useMemo(() => new Set(vm.recommendedMarkets), [vm.recommendedMarkets]);

  return (
    <div className="space-y-5">
      <div className="px-1">
        <h1 className="display text-[28px] font-semibold text-ink sm:text-[32px]">Budget Allocation</h1>
        <p className="mt-1.5 text-[14px] text-ink-2">Interactive market analysis and budget optimization</p>
      </div>

      <ModelExplainer
        model={vm.model}
        currency={vm.currency}
        totalBudget={totalBudget}
        ranges={uncertainty?.ranges}
        next={next}
        step={step}
        warnings={warnings}
      />

      <ChartCard
        title="Market analysis"
        subtitle="Compare active markets on any two indicators"
        height="h-[440px]"
        actions={
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
            <SelectDropdown label="X-axis" options={vm.axisOptions} value={xAxis} onChange={setXAxis} />
            <SelectDropdown label="Y-axis" options={vm.axisOptions} value={yAxis} onChange={setYAxis} />
            <SelectDropdown label="Bubble size" options={vm.bubbleOptions} value={bubbleSize} onChange={setBubbleSize} />
          </div>
        }
      >
        <BubbleChart
          markets={enabledMarkets}
          metrics={vm.metrics}
          allocations={allocations}
          xAxis={xAxis}
          yAxis={yAxis}
          bubbleSize={bubbleSize}
          currency={vm.currency}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-5">
          <GlassCard padding="p-5 sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-[15px] font-semibold text-ink">Budget calculator</h2>
              <span className="text-xs text-ink-2">
                <span className="num">{enabledMarkets.length}</span> active{' '}
                {enabledMarkets.length === 1 ? 'market' : 'markets'}
              </span>
            </div>
            <BudgetInputField value={totalBudget} onChange={setTotalBudget} currency={vm.currency} />
            {vm.allocation && (
              <p className="mt-3 rounded-[10px] bg-accent/[0.07] px-3 py-2 text-xs text-ink">
                This version uses a fixed budget split. Model weights change the scores, not the budget.
              </p>
            )}
          </GlassCard>

          <ModelWeightsPanel
            className="flex-1"
            // In v2 the tier is a priority multiplier, not a weighted factor.
            metrics={v2 ? vm.metrics.filter((m) => m.role !== 'priority') : vm.metrics}
            weights={weights}
            onChange={setWeights}
            enabled={modelWeightsEnabled}
            onToggle={() => {
              if (modelWeightsEnabled) {
                setWeights({ ...vm.defaultWeights });
              }
              setModelWeightsEnabled(!modelWeightsEnabled);
            }}
          />
        </div>

        <BudgetTreemap allocations={allocations} currency={vm.currency} />
      </div>

      <BudgetTable
        markets={vm.markets}
        metrics={vm.metrics}
        totalBudget={totalBudget}
        allocations={allocations}
        currency={vm.currency}
        enabledNames={enabledNames}
        onToggleMarket={toggleMarket}
        model={vm.model}
        ranges={uncertainty?.ranges}
        recommended={recommended}
        controls={vm.marketControls}
      />

    </div>
  );
}
