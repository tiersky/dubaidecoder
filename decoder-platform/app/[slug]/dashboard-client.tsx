'use client';

import { useCallback, useMemo, useState } from 'react';
import { DashboardVm, MarketVm, computeAllocations } from '@/lib/dashboard/derive';
import DashboardLayout from '@/components/templates/DashboardLayout';
import Sidebar from '@/components/organisms/Sidebar';
import GlobalOverview from '@/components/templates/GlobalOverview';
import CountryDetail from '@/components/templates/CountryDetail';
import BudgetAllocation from '@/components/templates/BudgetAllocation';

type TabId = 'global' | 'budget';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'global', label: 'Global Overview' },
  { id: 'budget', label: 'Budget Allocation' },
];

interface DashboardClientProps {
  vm: DashboardVm;
}

export default function DashboardClient({ vm }: DashboardClientProps) {
  const [currentTab, setCurrentTab] = useState<TabId>('global');
  const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);

  const selectMarket = useCallback((name: string | null) => {
    setSelectedMarketName(name);
    setCurrentTab((tab) => (tab === 'budget' ? 'global' : tab));
  }, []);

  const handleSelectFromMap = useCallback(
    (market: MarketVm) => selectMarket(market.name),
    [selectMarket]
  );

  const handleBack = useCallback(() => {
    setSelectedMarketName(null);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab as TabId);
    if (tab === 'budget') {
      setSelectedMarketName(null);
    }
  }, []);

  const defaultEnabledNames = useMemo(
    () => new Set(vm.markets.filter((m) => m.enabled).map((m) => m.name)),
    [vm.markets]
  );

  const overviewAllocations = useMemo(
    () =>
      computeAllocations(
        vm.markets,
        vm.metrics,
        vm.defaultWeights,
        defaultEnabledNames,
        vm.defaultBudget
      ),
    [vm.markets, vm.metrics, vm.defaultWeights, defaultEnabledNames, vm.defaultBudget]
  );

  const selectedMarket = selectedMarketName
    ? (vm.markets.find((m) => m.name === selectedMarketName) ?? null)
    : null;

  return (
    <DashboardLayout
      title={vm.name}
      tabs={TABS}
      currentTab={currentTab}
      onTabChange={handleTabChange}
      sidebar={
        <Sidebar markets={vm.markets} selected={selectedMarketName} onSelect={selectMarket} />
      }
    >
      {currentTab === 'global' && !selectedMarket && (
        <GlobalOverview
          markets={vm.markets}
          currency={vm.currency}
          allocations={overviewAllocations}
          onSelectCountry={handleSelectFromMap}
        />
      )}

      {currentTab === 'global' && selectedMarket && (
        <CountryDetail
          key={selectedMarket.name}
          market={selectedMarket}
          metrics={vm.metrics}
          onBack={handleBack}
        />
      )}

      {currentTab === 'budget' && <BudgetAllocation vm={vm} />}
    </DashboardLayout>
  );
}
