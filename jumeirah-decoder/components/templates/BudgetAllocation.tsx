"use client";

import { useState, useMemo, useCallback } from "react";
import { Country, DEFAULT_MODEL_WEIGHTS, ModelWeights } from "@/types";
import { axisOptions, bubbleSizeOptions } from "@/data/axes";
import { computeAllocations } from "@/lib/utils";
import GlassCard from "@/components/atoms/GlassCard";
import SelectDropdown from "@/components/atoms/SelectDropdown";
import BudgetInputField from "@/components/molecules/BudgetInputField";
import BubbleChart from "@/components/organisms/BubbleChart";
import BudgetTreemap from "@/components/organisms/BudgetTreemap";
import ModelWeightsPanel from "@/components/organisms/ModelWeightsPanel";
import BudgetTable from "@/components/organisms/BudgetTable";

interface BudgetAllocationProps {
  allCountries: Country[];
}

// UAE is the home market and carries zero target-market metrics; off by default.
const DEFAULT_DISABLED = new Set(["ae"]);

export default function BudgetAllocation({
  allCountries,
}: BudgetAllocationProps) {
  const [xAxis, setXAxis] = useState("internationalTravellers");
  const [yAxis, setYAxis] = useState("googleTravelIntent");
  const [bubbleSize, setBubbleSize] = useState("budgetSplit");
  const [totalBudget, setTotalBudget] = useState(10000000);
  const [modelWeightsEnabled, setModelWeightsEnabled] = useState(false);
  const [modelWeights, setModelWeights] = useState<ModelWeights>({
    ...DEFAULT_MODEL_WEIGHTS,
  });
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(
    () =>
      new Set(
        allCountries
          .map((c) => c.code)
          .filter((code) => !DEFAULT_DISABLED.has(code))
      )
  );

  const toggleCountry = useCallback((code: string) => {
    setEnabledCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const enabledCountries = useMemo(
    () => allCountries.filter((c) => enabledCodes.has(c.code)),
    [allCountries, enabledCodes]
  );

  const allocations = useMemo(
    () => computeAllocations(enabledCountries, modelWeights, totalBudget),
    [enabledCountries, modelWeights, totalBudget]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Budget Allocation
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Interactive market analysis and budget optimization
        </p>
      </div>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-800 mb-4">
          Market Analysis Bubble Chart
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SelectDropdown
            label="X-Axis"
            options={axisOptions}
            value={xAxis}
            onChange={setXAxis}
          />
          <SelectDropdown
            label="Y-Axis"
            options={axisOptions}
            value={yAxis}
            onChange={setYAxis}
          />
          <SelectDropdown
            label="Bubble Size"
            options={bubbleSizeOptions}
            value={bubbleSize}
            onChange={setBubbleSize}
          />
        </div>

        <BubbleChart
          allCountries={enabledCountries}
          xAxis={xAxis}
          yAxis={yAxis}
          bubbleSize={bubbleSize}
        />
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col gap-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Budget Allocation Calculator
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {enabledCountries.length} active{" "}
              {enabledCountries.length === 1 ? "market" : "markets"} • toggle
              countries below to reallocate
            </p>
            <BudgetInputField value={totalBudget} onChange={setTotalBudget} />
          </GlassCard>

          <ModelWeightsPanel
            weights={modelWeights}
            onChange={setModelWeights}
            enabled={modelWeightsEnabled}
            onToggle={() => {
              if (modelWeightsEnabled) {
                setModelWeights({ ...DEFAULT_MODEL_WEIGHTS });
              }
              setModelWeightsEnabled(!modelWeightsEnabled);
            }}
          />
        </div>
        <BudgetTreemap allocations={allocations} />
      </div>

      <BudgetTable
        allCountries={allCountries}
        totalBudget={totalBudget}
        allocations={allocations}
        enabledCodes={enabledCodes}
        onToggleCountry={toggleCountry}
      />
    </div>
  );
}
