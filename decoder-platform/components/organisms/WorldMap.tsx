'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { whereNumeric, whereAlpha3 } from 'iso-3166-1';
import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface GeoFeature {
  rsmKey: string;
  id?: string | number;
  properties?: Record<string, unknown>;
}

/**
 * Resolve a topojson geography feature to an ISO 3166-1 alpha-2 code (lower
 * case), first via the numeric id embedded in the world-atlas dataset, then
 * falling back to the ISO_A3 property some geographies carry instead.
 */
function geoToIso2(geo: { id?: string | number; properties?: Record<string, unknown> }): string | null {
  const byNum = geo.id != null ? whereNumeric(String(geo.id).padStart(3, '0')) : undefined;
  if (byNum) return byNum.alpha2.toLowerCase();
  const a3 = (geo.properties?.ISO_A3 ?? geo.properties?.iso_a3) as string | undefined;
  const byA3 = a3 ? whereAlpha3(a3) : undefined;
  return byA3 ? byA3.alpha2.toLowerCase() : null;
}

const TARGET_FILL = '#93c5fd'; // blue-300
const TARGET_HOVER = '#60a5fa'; // blue-400
const DEFAULT_FILL = '#e2e8f0'; // slate-200
const DEFAULT_HOVER = '#cbd5e1'; // slate-300

interface WorldMapProps {
  markets: MarketVm[];
  currency: string;
  allocations: AllocationRow[];
  onSelectCountry: (market: MarketVm) => void;
}

interface MemoizedGeographyProps {
  geo: GeoFeature;
  fill: string;
  hoverFill: string;
  tooltipContent: string;
  onClick: () => void;
}

const MemoizedGeography = memo(function MemoizedGeography({
  geo,
  fill,
  hoverFill,
  tooltipContent,
  onClick,
}: MemoizedGeographyProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Geography
      geography={geo}
      fill={isHovered ? hoverFill : fill}
      stroke="#fff"
      strokeWidth={0.5}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-tooltip-id="map-tooltip"
      data-tooltip-content={tooltipContent}
      style={{
        default: { outline: 'none' },
        hover: { outline: 'none', cursor: 'pointer' },
        pressed: { outline: 'none' },
      }}
    />
  );
});

export default function WorldMap({
  markets,
  currency,
  allocations,
  onSelectCountry,
}: WorldMapProps) {
  const marketByIso2 = useMemo(() => {
    const map = new Map<string, MarketVm>();
    for (const m of markets) {
      if (m.iso2 !== null) map.set(m.iso2.toLowerCase(), m);
    }
    return map;
  }, [markets]);

  const allocationByName = useMemo(
    () => new Map(allocations.map((a) => [a.name, a])),
    [allocations]
  );

  const buildTooltipContent = useCallback(
    (market: MarketVm): string => {
      const budget = allocationByName.get(market.name)?.budget ?? 0;
      return `${market.name} | Budget: ${currency} ${Math.round(budget).toLocaleString()}`;
    },
    [allocationByName, currency]
  );

  const handleGeoClick = useCallback(
    (iso2: string | null) => {
      const market = iso2 ? marketByIso2.get(iso2) : undefined;
      if (market) onSelectCountry(market);
    },
    [marketByIso2, onSelectCountry]
  );

  return (
    <div className="relative">
      <div className="w-full" style={{ height: 500 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 115, center: [15, 20] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo: GeoFeature) => {
                  const iso2 = geoToIso2(geo);
                  const market = iso2 ? marketByIso2.get(iso2) : undefined;

                  let fill = DEFAULT_FILL;
                  let hoverFill = DEFAULT_HOVER;
                  let tooltipContent = (geo.properties?.name as string | undefined) ?? '';

                  if (market) {
                    fill = TARGET_FILL;
                    hoverFill = TARGET_HOVER;
                    tooltipContent = buildTooltipContent(market);
                  }

                  return (
                    <MemoizedGeography
                      key={geo.rsmKey}
                      geo={geo}
                      fill={fill}
                      hoverFill={hoverFill}
                      tooltipContent={tooltipContent}
                      onClick={() => handleGeoClick(iso2)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <Tooltip
        id="map-tooltip"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          color: '#f1f5f9',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '13px',
          fontFamily: 'inherit',
          zIndex: 50,
        }}
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 pb-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: TARGET_FILL }}
          />
          <span className="text-xs text-slate-500 font-medium">Target Markets</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: DEFAULT_FILL }}
          />
          <span className="text-xs text-slate-500 font-medium">Other</span>
        </div>
      </div>
    </div>
  );
}
