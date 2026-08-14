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
import { Country, TIER_CONFIG } from '@/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const ISO_NUMERIC_TO_CODE: Record<string, string> = {
  '840': 'us', '156': 'cn', '826': 'gb', '250': 'fr', '392': 'jp',
  '276': 'de', '124': 'ca', '036': 'au', '380': 'it', '528': 'nl',
  '756': 'ch', '356': 'in', '752': 'se', '643': 'ru', '682': 'sa',
  '702': 'sg', '554': 'nz', '578': 'no', '360': 'id', '442': 'lu',
  '398': 'kz', '634': 'qa', '512': 'om', '400': 'jo', '372': 'ie',
  '414': 'kw', '208': 'dk', '710': 'za',
};

const ISO_NUMERIC_UNPADDED_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_NUMERIC_TO_CODE).map(([k, v]) => [String(Number(k)), v])
);

const ISO_A3_TO_CODE: Record<string, string> = {
  USA: 'us', CHN: 'cn', GBR: 'gb', FRA: 'fr', JPN: 'jp',
  DEU: 'de', CAN: 'ca', AUS: 'au', ITA: 'it', NLD: 'nl',
  CHE: 'ch', IND: 'in', SWE: 'se', RUS: 'ru', SAU: 'sa',
  SGP: 'sg', NZL: 'nz', NOR: 'no', IDN: 'id', LUX: 'lu',
  KAZ: 'kz', QAT: 'qa', OMN: 'om', JOR: 'jo', IRL: 'ie',
  KWT: 'kw', DNK: 'dk', ZAF: 'za',
};

const DEFAULT_FILL = '#e2e8f0';
const DEFAULT_HOVER = '#cbd5e1';

function resolveCountryCode(geo: { id: string; properties: Record<string, string> }): string | null {
  const numericId = geo.id;
  if (ISO_NUMERIC_TO_CODE[numericId]) return ISO_NUMERIC_TO_CODE[numericId];
  if (ISO_NUMERIC_UNPADDED_TO_CODE[numericId]) return ISO_NUMERIC_UNPADDED_TO_CODE[numericId];
  const alpha3 = geo.properties?.ISO_A3;
  if (alpha3 && ISO_A3_TO_CODE[alpha3]) return ISO_A3_TO_CODE[alpha3];
  return null;
}

interface MemoizedGeographyProps {
  geo: { rsmKey: string; id: string; properties: Record<string, string> };
  fill: string;
  hoverFill: string;
  tooltipContent: string;
  onClick: () => void;
}

const MemoizedGeography = memo(function MemoizedGeography({
  geo, fill, hoverFill, tooltipContent, onClick,
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

interface WorldMapProps {
  countries: Country[];
  onSelectCountry: (country: Country) => void;
}

export default function WorldMap({ countries, onSelectCountry }: WorldMapProps) {
  const countryByCode = useMemo(() => {
    const map: Record<string, Country> = {};
    for (const c of countries) map[c.code] = c;
    return map;
  }, [countries]);

  const buildTooltip = useCallback((country: Country): string => {
    const tierLabel = TIER_CONFIG[country.tier].label;
    return `${country.name} | ${tierLabel} | Score: ${country.weightedScore.toFixed(1)}`;
  }, []);

  const handleGeoClick = useCallback(
    (code: string | null) => {
      if (code && countryByCode[code]) onSelectCountry(countryByCode[code]);
    },
    [countryByCode, onSelectCountry]
  );

  return (
    <div className="relative">
      <div className="w-full" style={{ height: 500 }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [30, 25] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const code = resolveCountryCode(geo);
                  const country = code ? countryByCode[code] : null;

                  let fill = DEFAULT_FILL;
                  let hoverFill = DEFAULT_HOVER;
                  let tooltipContent = geo.properties.name || '';

                  if (country) {
                    const tierColor = TIER_CONFIG[country.tier].color;
                    fill = tierColor + '88';
                    hoverFill = tierColor + 'cc';
                    tooltipContent = buildTooltip(country);
                  }

                  return (
                    <MemoizedGeography
                      key={geo.rsmKey}
                      geo={geo}
                      fill={fill}
                      hoverFill={hoverFill}
                      tooltipContent={tooltipContent}
                      onClick={() => handleGeoClick(code)}
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

      <div className="flex items-center justify-center gap-5 mt-3 pb-1">
        {(['prime', 'secondary', 'monitoring', 'excluded'] as const).map((tier) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: TIER_CONFIG[tier].color }}
            />
            <span className="text-xs text-slate-500 font-medium">{TIER_CONFIG[tier].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_FILL }} />
          <span className="text-xs text-slate-500 font-medium">Other</span>
        </div>
      </div>
    </div>
  );
}
