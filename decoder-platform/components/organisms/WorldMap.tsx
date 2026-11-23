'use client';

import { useState, useMemo, useCallback, memo, useSyncExternalStore } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
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

import {
  NEUTRAL_LAND,
  NEUTRAL_LAND_HOVER,
  RAMP,
  rampColor,
  toneScale,
  formatMoney,
} from '@/lib/ui/theme';

/** Target market with no budget (toggled off by default). */
const UNFUNDED_FILL = '#d6e4f5';
const UNFUNDED_HOVER = '#c3d6ee';

const noopSubscribe = () => () => {};

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
  interactive: boolean;
  onClick: () => void;
}

const MemoizedGeography = memo(function MemoizedGeography({
  geo,
  fill,
  hoverFill,
  tooltipContent,
  interactive,
  onClick,
}: MemoizedGeographyProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Geography
      geography={geo}
      fill={isHovered ? hoverFill : fill}
      stroke="rgba(255,255,255,0.9)"
      strokeWidth={0.6}
      className="map-geo"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-tooltip-id="map-tooltip"
      data-tooltip-content={tooltipContent}
      style={{
        default: { outline: 'none', transition: 'fill 320ms ease' },
        hover: { outline: 'none', cursor: interactive ? 'pointer' : 'default', transition: 'fill 120ms ease' },
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
  // City decoders draw each market as a dot at its own coordinates; several
  // cities can share a country, so countries are not filled or clickable.
  const cities = useMemo(() => markets.filter((m) => m.place && m.lat !== null && m.lng !== null), [markets]);
  const cityMode = markets.some((m) => m.place);
  // Dots are drawn only in the browser: server and client project coordinates
  // with last-digit float differences, which React reports as a hydration
  // mismatch. The country shapes load client-side anyway.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const marketByIso2 = useMemo(() => {
    const map = new Map<string, MarketVm>();
    if (cityMode) return map;
    for (const m of markets) {
      if (m.iso2 !== null) map.set(m.iso2.toLowerCase(), m);
    }
    return map;
  }, [markets, cityMode]);

  const allocationByName = useMemo(
    () => new Map(allocations.map((a) => [a.name, a])),
    [allocations]
  );

  const tone = useMemo(
    () => toneScale(allocations.filter((a) => a.budget > 0).map((a) => a.split)),
    [allocations]
  );

  const buildTooltipContent = useCallback(
    (market: MarketVm): string => {
      const alloc = allocationByName.get(market.name);
      if (!alloc || alloc.budget <= 0) return `${market.name} · not funded`;
      return `${market.name} · ${(alloc.split * 100).toFixed(1)}% · ${formatMoney(currency, alloc.budget)}`;
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
      <div className="w-full overflow-hidden rounded-[14px]" style={{ aspectRatio: '16 / 9.5' }}>
        <ComposableMap
          projection="geoMercator"
          // City view: Florida to Turkey, the summer belt this decoder covers.
          projectionConfig={cityMode ? { scale: 290, center: [-8, 41] } : { scale: 118, center: [15, 24] }}
          width={800}
          height={475}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo: GeoFeature) => {
                  const iso2 = geoToIso2(geo);
                  const market = iso2 ? marketByIso2.get(iso2) : undefined;
                  let fill = NEUTRAL_LAND;
                  let hoverFill = NEUTRAL_LAND_HOVER;
                  let tooltipContent = (geo.properties?.name as string | undefined) ?? '';

                  if (market) {
                    const alloc = allocationByName.get(market.name);
                    if (alloc && alloc.budget > 0) {
                      const t = tone(alloc.split);
                      fill = rampColor(0.1 + 0.9 * t);
                      hoverFill = rampColor(Math.min(1, 0.25 + 0.9 * t));
                    } else {
                      fill = UNFUNDED_FILL;
                      hoverFill = UNFUNDED_HOVER;
                    }
                    tooltipContent = buildTooltipContent(market);
                  }

                  return (
                    <MemoizedGeography
                      key={geo.rsmKey}
                      geo={geo}
                      fill={fill}
                      hoverFill={hoverFill}
                      tooltipContent={tooltipContent}
                      interactive={Boolean(market)}
                      onClick={() => handleGeoClick(iso2)}
                    />
                  );
                })
              }
            </Geographies>
            {mounted && cities.map((m) => {
              const alloc = allocationByName.get(m.name);
              const funded = Boolean(alloc && alloc.budget > 0);
              const t = funded ? tone(alloc!.split) : 0;
              return (
                <Marker key={m.name} coordinates={[m.lng!, m.lat!]}>
                  <circle
                    r={funded ? 4 + 5 * t : 3.5}
                    fill={funded ? rampColor(0.25 + 0.75 * t) : UNFUNDED_FILL}
                    stroke="#fff"
                    strokeWidth={1.2}
                    className="map-geo"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectCountry(m)}
                    data-tooltip-id="map-tooltip"
                    data-tooltip-content={buildTooltipContent(m)}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <Tooltip id="map-tooltip" className="tip" opacity={1} noArrow offset={10} float />

      {/* Legend: one ramp, one meaning */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-1 pb-0.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-ink-2">Smaller share</span>
          <span
            aria-hidden
            className="h-2 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, ${RAMP.join(', ')})` }}
          />
          <span className="text-xs text-ink-2">Larger share</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: UNFUNDED_FILL }} />
            Not funded
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NEUTRAL_LAND }} />
            Other
          </span>
        </div>
      </div>
    </div>
  );
}
