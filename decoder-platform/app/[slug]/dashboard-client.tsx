'use client';

import { useCallback, useMemo, useState } from 'react';
import { DashboardVm, MarketVm, toAllocationRows } from '@/lib/dashboard/derive';
import { computeAllocation } from '@/lib/model/allocation';
import { planRequest } from '@/lib/dashboard/plan';
import { usePlan } from '@/lib/dashboard/use-plan';
import DashboardLayout from '@/components/templates/DashboardLayout';
import Sidebar from '@/components/organisms/Sidebar';
import GlobalOverview from '@/components/templates/GlobalOverview';
import CountryDetail from '@/components/templates/CountryDetail';
import BudgetAllocation from '@/components/templates/BudgetAllocation';
import CultureExplorer from '@/components/templates/CultureExplorer';
import { cultureMarkets, marketForCultureName } from '@/lib/dashboard/culture-markets';

type TabId = 'global' | 'budget' | 'culture';

const TABS: Array<{ id: TabId; label: string; shortLabel: string }> = [
  { id: 'global', label: 'Global Overview', shortLabel: 'Overview' },
  { id: 'budget', label: 'Budget Allocation', shortLabel: 'Budget' },
  { id: 'culture', label: 'Culture', shortLabel: 'Culture' },
];

interface DashboardClientProps {
  vm: DashboardVm;
  /** AI market analysis on country pages. Off for unpublished draft previews. */
  ai?: { canRegenerate: boolean };
}

export default function DashboardClient({ vm, ai }: DashboardClientProps) {
  const [currentTab, setCurrentTab] = useState<TabId>('global');
  const [selectedMarketName, setSelectedMarketName] = useState<string | null>(null);

  const selectMarket = useCallback((name: string | null) => {
    setSelectedMarketName(name);
    setCurrentTab('global');
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
    if (tab !== 'global') {
      setSelectedMarketName(null);
    }
  }, []);

  // One plan (budget, weights, markets in the allocation) for every tab and
  // country page, kept for the session so navigating never resets it.
  const planState = usePlan(vm);
  const { plan } = planState;
  const request = useMemo(() => planRequest(vm, plan), [vm, plan]);
  const result = useMemo(() => computeAllocation(request), [request]);
  const allocations = useMemo(() => toAllocationRows(result.rows, vm.markets), [result, vm.markets]);
  // Markets taken out of the allocation drop out of the overview's charts too.
  const activeMarkets = useMemo(() => vm.markets.filter((m) => plan.enabled.has(m.name)), [vm.markets, plan.enabled]);

  const selectedMarket = selectedMarketName
    ? (vm.markets.find((m) => m.name === selectedMarketName) ?? null)
    : null;

  return (
    <DashboardLayout
      title={vm.name}
      tabs={TABS}
      currentTab={currentTab}
      onTabChange={handleTabChange}
      viewKey={`${currentTab}:${currentTab === 'global' ? (selectedMarket?.name ?? '') : ''}`}
      sidebar={(close) => (
        <Sidebar
          markets={vm.markets}
          selected={currentTab === 'global' ? selectedMarketName : null}
          onSelect={selectMarket}
          onNavigate={close}
        />
      )}
    >
      {currentTab === 'global' && !selectedMarket && (
        <GlobalOverview
          markets={activeMarkets}
          currency={vm.currency}
          allocations={allocations}
          onSelectCountry={handleSelectFromMap}
          destination={vm.context?.destination ?? null}
          recommendations={vm.recommendations}
        />
      )}

      {currentTab === 'global' && selectedMarket && (
        <CountryDetail
          key={selectedMarket.name}
          market={selectedMarket}
          markets={vm.markets}
          metrics={vm.metrics}
          allocations={allocations}
          currency={vm.currency}
          slug={vm.slug}
          industry={vm.industry ?? null}
          ai={ai}
          context={Boolean(ai)}
          gwi={vm.gwi}
          onBack={handleBack}
          onSelectMarket={selectMarket}
          onOpenCulture={() => handleTabChange('culture')}
        />
      )}

      {currentTab === 'budget' && <BudgetAllocation vm={vm} plan={planState} request={request} result={result} allocations={allocations} />}

      {currentTab === 'culture' && <CultureExplorer markets={cultureMarkets(vm.markets)} onSelectMarket={(name) => selectMarket(marketForCultureName(vm.markets, name)?.name ?? name)} slug={vm.slug} aiEnabled={Boolean(ai)} />}
    </DashboardLayout>
  );
}
