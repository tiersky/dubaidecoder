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
import { Country, PerceptionScore } from '@/types';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/**
 * Mapping from ISO 3166-1 numeric code (used in world-atlas TopoJSON `geo.id`)
 * to our internal two-letter country code.
 */
const ISO_NUMERIC_TO_CODE: Record<string, string> = {
  '682': 'sa',
  '048': 'bh',
  '512': 'om',
  '634': 'qa',
  '414': 'kw',
  '643': 'ru',
  '156': 'cn',
  '826': 'gb',
  '250': 'fr',
  '276': 'de',
  '380': 'it',
  '756': 'ch',
  '724': 'es',
  '616': 'pl',
};

/**
 * Also handle numeric ids that may not be zero-padded.
 * The world-atlas dataset sometimes stores `"48"` instead of `"048"`.
 */
const ISO_NUMERIC_UNPADDED_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_NUMERIC_TO_CODE).map(([k, v]) => [String(Number(k)), v])
);

/** ISO Alpha-3 to our country code (fallback for geo.properties.ISO_A3). */
const ISO_A3_TO_CODE: Record<string, string> = {
  SAU: 'sa',
  BHR: 'bh',
  OMN: 'om',
  QAT: 'qa',
  KWT: 'kw',
  RUS: 'ru',
  CHN: 'cn',
  GBR: 'gb',
  FRA: 'fr',
  DEU: 'de',
  ITA: 'it',
  CHE: 'ch',
  ESP: 'es',
  POL: 'pl',
};

const TARGET_FILL = '#93c5fd'; // blue-300
const TARGET_HOVER = '#60a5fa'; // blue-400
const DEFAULT_FILL = '#e2e8f0'; // slate-200
const DEFAULT_HOVER = '#cbd5e1'; // slate-300

interface WorldMapProps {
  countries: Country[];
  perceptionScores: Record<string, PerceptionScore>;
  onSelectCountry: (country: Country) => void;
}

/**
 * Resolve a geography feature to one of our Country objects.
 */
function resolveCountryCode(geo: { id: string; properties: Record<string, string> }): string | null {
  // Try ISO numeric from geo.id (both padded and unpadded)
  const numericId = geo.id;
  if (ISO_NUMERIC_TO_CODE[numericId]) return ISO_NUMERIC_TO_CODE[numericId];
  if (ISO_NUMERIC_UNPADDED_TO_CODE[numericId]) return ISO_NUMERIC_UNPADDED_TO_CODE[numericId];

  // Try ISO Alpha-3 from properties
  const alpha3 = geo.properties?.ISO_A3;
  if (alpha3 && ISO_A3_TO_CODE[alpha3]) return ISO_A3_TO_CODE[alpha3];

  return null;
}

interface MemoizedGeographyProps {
  geo: {
    rsmKey: string;
    id: string;
    properties: Record<string, string>;
  };
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
  countries,
  perceptionScores,
  onSelectCountry,
}: WorldMapProps) {
  const countryByCode = useMemo(() => {
    const map: Record<string, Country> = {};
    for (const c of countries) {
      map[c.code] = c;
    }
    return map;
  }, [countries]);

  const buildTooltipContent = useCallback(
    (country: Country): string => {
      const perception = perceptionScores[country.name];
      const percText = perception ? ` | Perception: ${perception.score}/100` : '';
      return `${country.name}${percText}`;
    },
    [perceptionScores]
  );

  const handleGeoClick = useCallback(
    (code: string | null) => {
      if (code && countryByCode[code]) {
        onSelectCountry(countryByCode[code]);
      }
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
                    fill = TARGET_FILL;
                    hoverFill = TARGET_HOVER;
                    tooltipContent = buildTooltipContent(country);
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
