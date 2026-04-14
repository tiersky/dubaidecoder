"use client";

import Image from "next/image";
import TabButton from "@/components/atoms/TabButton";

interface DashboardLayoutProps {
  currentTab: "global" | "budget";
  onTabChange: (tab: "global" | "budget") => void;
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
      {/* Header */}
      <header className="glass-header relative z-20 flex-shrink-0">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/Country Decoder Logo.png"
                alt="Country Decoder"
                width={48}
                height={48}
                className="h-10 w-auto"
              />
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                  Strategic Travel Intelligence
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 p-1 rounded-2xl bg-white/30">
              <TabButton
                label="Global Overview"
                active={currentTab === "global"}
                onClick={() => onTabChange("global")}
              />
              <TabButton
                label="Budget Allocation"
                active={currentTab === "budget"}
                onClick={() => onTabChange("budget")}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar (handles its own mobile toggle) */}
        {sidebar}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
