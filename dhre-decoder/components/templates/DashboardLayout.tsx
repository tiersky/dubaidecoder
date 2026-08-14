'use client';

import TabButton from '@/components/atoms/TabButton';

interface DashboardLayoutProps {
  currentTab: 'global' | 'budget';
  onTabChange: (tab: 'global' | 'budget') => void;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardLayout({
  currentTab,
  onTabChange,
  sidebar,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="glass-header relative z-20 flex-shrink-0">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
                <span className="text-white text-sm font-bold">DH</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">DHRE Market Prioritization</p>
                <p className="text-xs font-medium text-slate-400 tracking-wide">
                  International Real Estate Investment Intelligence
                </p>
              </div>
            </div>

            <div className="flex gap-1.5 p-1 rounded-2xl bg-white/30">
              <TabButton
                label="Market Overview"
                active={currentTab === 'global'}
                onClick={() => onTabChange('global')}
              />
              <TabButton
                label="Budget Allocation"
                active={currentTab === 'budget'}
                onClick={() => onTabChange('budget')}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {sidebar}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
