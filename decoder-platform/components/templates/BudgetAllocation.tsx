'use client';

import { useState, useMemo, useCallback } from 'react';
import { DashboardVm, computeAllocations } from '@/lib/dashboard/derive';
import GlassCard from '@/components/atoms/GlassCard';
import SelectDropdown from '@/components/atoms/SelectDropdown';
import BudgetInputField from '@/components/molecules/BudgetInputField';
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

  const allocations = useMemo(
    () => computeAllocations(vm.markets, vm.metrics, weights, enabledNames, totalBudget),
    [vm.markets, vm.metrics, weights, enabledNames, totalBudget]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Budget Allocation
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Interactive market analysis and budget optimization
        </p>
      </div>

      {/* Bubble Chart Section */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-800 mb-4">
          Market Analysis Bubble Chart
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SelectDropdown
            label="X-Axis"
            options={vm.axisOptions}
            value={xAxis}
            onChange={setXAxis}
          />
          <SelectDropdown
            label="Y-Axis"
            options={vm.axisOptions}
            value={yAxis}
            onChange={setYAxis}
          />
          <SelectDropdown
            label="Bubble Size"
            options={vm.bubbleOptions}
            value={bubbleSize}
            onChange={setBubbleSize}
          />
        </div>

        <BubbleChart
          markets={enabledMarkets}
          metrics={vm.metrics}
          allocations={allocations}
          xAxis={xAxis}
          yAxis={yAxis}
          bubbleSize={bubbleSize}
          currency={vm.currency}
        />
      </GlassCard>

      {/* Budget Calculator + Model Weights + Treemap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col gap-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Budget Allocation Calculator
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {enabledMarkets.length} active{' '}
              {enabledMarkets.length === 1 ? 'market' : 'markets'} • toggle
              markets below to reallocate
            </p>
            <BudgetInputField
              value={totalBudget}
              onChange={setTotalBudget}
              currency={vm.currency}
            />
          </GlassCard>

          <ModelWeightsPanel
            metrics={vm.metrics}
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

      {/* Budget Table */}
      <BudgetTable
        markets={vm.markets}
        metrics={vm.metrics}
        totalBudget={totalBudget}
        allocations={allocations}
        currency={vm.currency}
        enabledNames={enabledNames}
        onToggleMarket={toggleMarket}
      />
    </div>
  );
}
