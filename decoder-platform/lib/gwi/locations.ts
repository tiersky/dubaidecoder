/**
 * GWI Core locations this account can query, by lower-case iso2. Generated
 * from POST /v2/locations/filter (2026-11-24); GWI adds markets rarely, so a
 * static map saves a call per fetch. Markets missing here (Monaco, Qatar, …)
 * are reported as unsupported.
 */
export const GWI_LOCATIONS: Record<string, { code: string; name: string }> = {
  ae: { code: 's2_971', name: "UAE" },
  ar: { code: 's2_54', name: "Argentina" },
  at: { code: 's2_43', name: "Austria" },
  au: { code: 's2_61', name: "Australia" },
  be: { code: 's2_32', name: "Belgium" },
  bg: { code: 's2_359', name: "Bulgaria" },
  br: { code: 's2_55', name: "Brazil" },
  ca: { code: 's2_2', name: "Canada" },
  ch: { code: 's2_41', name: "Switzerland" },
  cl: { code: 's2_56', name: "Chile" },
  cn: { code: 's2_86', name: "China" },
  co: { code: 's2_57', name: "Colombia" },
  cz: { code: 's2_420', name: "Czech Republic" },
  de: { code: 's2_49', name: "Germany" },
  dk: { code: 's2_45', name: "Denmark" },
  eg: { code: 's2_20', name: "Egypt" },
  es: { code: 's2_34', name: "Spain" },
  fr: { code: 's2_33', name: "France" },
  gb: { code: 's2_44', name: "UK" },
  gh: { code: 's2_233', name: "Ghana" },
  gr: { code: 's2_30', name: "Greece" },
  hk: { code: 's2_852', name: "Hong Kong" },
  hr: { code: 's2_385', name: "Croatia" },
  hu: { code: 's2_36', name: "Hungary" },
  id: { code: 's2_62', name: "Indonesia" },
  ie: { code: 's2_353', name: "Ireland" },
  il: { code: 's2_972', name: "Israel" },
  in: { code: 's2_91', name: "India" },
  it: { code: 's2_39', name: "Italy" },
  jp: { code: 's2_81', name: "Japan" },
  ke: { code: 's2_254', name: "Kenya" },
  kr: { code: 's2_82', name: "South Korea" },
  ma: { code: 's2_212', name: "Morocco" },
  mx: { code: 's2_52', name: "Mexico" },
  my: { code: 's2_60', name: "Malaysia" },
  ng: { code: 's2_234', name: "Nigeria" },
  nl: { code: 's2_31', name: "Netherlands" },
  no: { code: 's2_47', name: "Norway" },
  nz: { code: 's2_64', name: "New Zealand" },
  ph: { code: 's2_63', name: "Philippines" },
  pl: { code: 's2_48', name: "Poland" },
  pt: { code: 's2_351', name: "Portugal" },
  ro: { code: 's2_40', name: "Romania" },
  rs: { code: 's2_381', name: "Serbia" },
  ru: { code: 's2_7', name: "Russia" },
  sa: { code: 's2_966', name: "Saudi Arabia" },
  se: { code: 's2_46', name: "Sweden" },
  sg: { code: 's2_65', name: "Singapore" },
  th: { code: 's2_66', name: "Thailand" },
  tr: { code: 's2_90', name: "Turkey" },
  tw: { code: 's2_886', name: "Taiwan" },
  us: { code: 's2_1', name: "USA" },
  vn: { code: 's2_84', name: "Vietnam" },
  za: { code: 's2_27', name: "South Africa" },
};

/**
 * Microstates GWI doesn't survey, read through the country around them
 * (Monaco & Nice → France). The dashboard says so wherever it applies.
 */
export const GWI_PROXY: Record<string, string> = { mc: 'fr', sm: 'it', va: 'it', li: 'ch', ad: 'es' };

/** The country whose GWI numbers a market reads (itself, or its proxy), or null. */
export function gwiCountry(iso2: string | null | undefined): string | null {
  if (!iso2) return null;
  const k = iso2.toLowerCase();
  if (GWI_LOCATIONS[k]) return k;
  return GWI_PROXY[k] && GWI_LOCATIONS[GWI_PROXY[k]] ? GWI_PROXY[k] : null;
}

/** The GWI location for a market's country, or null when GWI doesn't survey it. */
export function gwiLocation(iso2: string | null | undefined): { code: string; name: string } | null {
  const k = gwiCountry(iso2);
  return k ? GWI_LOCATIONS[k] : null;
}
