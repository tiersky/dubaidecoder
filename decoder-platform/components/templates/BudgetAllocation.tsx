'use client';

import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import type { AllocationRow, DashboardVm } from '@/lib/dashboard/derive';
import type { AllocationRequest, AllocationResult } from '@/lib/model/allocation';
import type { usePlan } from '@/lib/dashboard/use-plan';
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
  /** The dashboard's shared plan: budget, weights and the markets in the allocation. */
  plan: ReturnType<typeof usePlan>;
  request: AllocationRequest;
  result: AllocationResult;
  allocations: AllocationRow[];
}

export default function BudgetAllocation({ vm, plan: { plan, update, toggleMarket }, request, result, allocations }: BudgetAllocationProps) {
  const [xAxis, setXAxis] = useState(vm.defaults.xAxis);
  const [yAxis, setYAxis] = useState(vm.defaults.yAxis);
  const [bubbleSize, setBubbleSize] = useState(vm.defaults.bubbleSize);
  const { budget: totalBudget, weights, weightsOn: modelWeightsEnabled, enabled: enabledNames } = plan;
  const setTotalBudget = useCallback((budget: number) => update({ budget }), [update]);
  const setWeights = useCallback((w: Record<string, number>) => update({ weights: w }), [update]);

  const enabledMarkets = useMemo(
    () => vm.markets.filter((m) => enabledNames.has(m.name)),
    [vm.markets, enabledNames]
  );

  const v2 = vm.model !== 'workbook';
  const warnings = v2 ? result.warnings : [];
  // The simulation trails slider drags instead of blocking them.
  const deferred = useDeferredValue(request);
  const uncertainty = useMemo(() => (v2 && deferred.budget > 0 ? simulateAllocation(deferred, deferred.markets.length > 25 ? 200 : 400) : null), [deferred, v2]);
  const step = useMemo(() => {
    const raw = totalBudget * 0.05;
    const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
    return Math.max(mag, Math.round(raw / mag) * mag);
  }, [totalBudget]);
  const next = useMemo(() => (deferred.budget > 0 ? nextIncrement(deferred, step) : []), [deferred, step]);
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
            onToggle={() =>
              update(modelWeightsEnabled ? { weightsOn: false, weights: { ...vm.defaultWeights } } : { weightsOn: true })
            }
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
