"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import SegmentedControl from "@/components/atoms/SegmentedControl";

interface DashboardLayoutProps {
  title: string;
  tabs: Array<{ id: string; label: string; shortLabel?: string }>;
  currentTab: string;
  onTabChange: (id: string) => void;
  /** Receives a `close` callback so a pick inside the mobile sheet dismisses it. */
  sidebar?: (close: () => void) => React.ReactNode;
  /** Changing this replays the materialize transition on the content. */
  viewKey: string;
  children: React.ReactNode;
}

export default function DashboardLayout({
  title,
  tabs,
  currentTab,
  onTabChange,
  sidebar,
  viewKey,
  children,
}: DashboardLayoutProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const close = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  return (
    <div className="flex h-dvh gap-3 overflow-hidden lg:p-3">
      {/* Desktop: floating inset sidebar */}
      {sidebar && (
        <aside className="glass hidden w-[272px] flex-shrink-0 flex-col overflow-hidden rounded-[var(--radius-panel)] lg:flex">
          {sidebar(close)}
        </aside>
      )}

      {/* Mobile: sheet from the leading edge, same path in and out */}
      {sidebar && sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="scrim absolute inset-0 bg-black/25" onClick={close} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Markets"
            className="sheet glass glass-solid absolute inset-y-2 left-2 flex w-[min(300px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[var(--radius-panel)]"
          >
            {sidebar(close)}
          </aside>
        </div>
      )}

      <main className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Floating toolbar; content scrolls beneath the material */}
        <header className="sticky top-0 z-30 px-2 pt-2 lg:px-0 lg:pt-0">
          <div className="glass flex h-[58px] items-center justify-between gap-3 rounded-[18px] pl-2 pr-2 sm:pl-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {sidebar && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="press -ml-0.5 rounded-[10px] p-2 text-ink hover:bg-black/5 lg:hidden"
                  aria-label="Show markets"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <rect x="3.5" y="4.5" width="17" height="15" rx="3" strokeWidth={1.7} />
                    <path d="M9 4.5v15" strokeWidth={1.7} />
                  </svg>
                </button>
              )}
              <Image
                src="/Country Decoder Logo.png"
                alt="Country Decoder"
                width={94}
                height={36}
                className="h-9 w-auto flex-shrink-0"
                priority
              />
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-[14px] font-semibold leading-tight text-ink">{title}</p>
                <p className="truncate text-[11.5px] leading-tight text-ink-2">Strategic Travel Intelligence</p>
              </div>
            </div>

            <SegmentedControl items={tabs} value={currentTab} onChange={onTabChange} label="Dashboard view" />
          </div>
        </header>

        <div className="mx-auto max-w-[1240px] px-3 pb-12 pt-6 sm:px-5 lg:px-6">
          <div key={viewKey} className="materialize">
            {children}
          </div>
        </div>
      </main>

      {/* Shared tooltip for metric ⓘ icons (definitions + data sources) */}
      <Tooltip id="metric-tooltip" className="tip" opacity={1} noArrow offset={8} />
    </div>
  );
}
