"use client";

import { useState, useMemo } from "react";
import { Country, DEFAULT_MODEL_WEIGHTS, ModelWeights } from "@/types";
import { axisOptions, bubbleSizeOptions } from "@/data/axes";
import { computeAllocations } from "@/lib/utils";
import GlassCard from "@/components/atoms/GlassCard";
import SelectDropdown from "@/components/atoms/SelectDropdown";
import BudgetInputField from "@/components/molecules/BudgetInputField";
import BubbleChart from "@/components/organisms/BubbleChart";
import BudgetPieChart from "@/components/organisms/BudgetPieChart";
import ModelWeightsPanel from "@/components/organisms/ModelWeightsPanel";
import BudgetTable from "@/components/organisms/BudgetTable";

interface BudgetAllocationProps {
  allCountries: Country[];
}

export default function BudgetAllocation({
  allCountries,
}: BudgetAllocationProps) {
  const [xAxis, setXAxis] = useState("luxurySpendPerCapita");
  const [yAxis, setYAxis] = useState("googleTravelIntent");
  const [bubbleSize, setBubbleSize] = useState("budgetSplit");
  const [totalBudget, setTotalBudget] = useState(10000000);
  const [modelWeightsEnabled, setModelWeightsEnabled] = useState(false);
  const [modelWeights, setModelWeights] = useState<ModelWeights>({
    ...DEFAULT_MODEL_WEIGHTS,
  });

  const allocations = useMemo(
    () => computeAllocations(allCountries, modelWeights, totalBudget),
    [allCountries, modelWeights, totalBudget]
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

        {/* Axis Controls */}
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

        {/* Chart */}
        <BubbleChart
          allCountries={allCountries}
          xAxis={xAxis}
          yAxis={yAxis}
          bubbleSize={bubbleSize}
        />
      </GlassCard>

      {/* Model Weights */}
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

      {/* Budget Calculator + Pie Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Budget Allocation Calculator
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Based on Weighted Score analysis
            </p>
            <BudgetInputField value={totalBudget} onChange={setTotalBudget} />
          </GlassCard>
        </div>
        <BudgetPieChart allocations={allocations} />
      </div>

      {/* Budget Table */}
      <BudgetTable
        allCountries={allCountries}
        totalBudget={totalBudget}
        allocations={allocations}
      />
    </div>
  );
}
