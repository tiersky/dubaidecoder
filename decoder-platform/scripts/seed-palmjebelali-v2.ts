import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from '../lib/parser/grid';
import { findModelBlocks } from '../lib/parser/detect';
import { assembleConfig } from '../lib/parser/assemble';
import { verifyAgainstWorkbook } from '../lib/parser/verify';
import { validateConfig } from '../lib/config/validate';
import { publishVersion } from '../lib/versions/store';
import { serviceClient } from '../lib/supabase/admin';

// Palm Jebel Ali v2: model variables from the "Model-Country (2)" sheet, budget
// split fixed by the client brief — USA a flat 1.3M, the rest 36/14/10/8/2.
const SLUG = 'palmjebelali-decoder-v2';
const SHEET = 'Model-Country (2)';
const BUDGET = 5_000_000;
const ALLOCATION = {
  fixed: { USA: 1_300_000 },
  shares: { China: 36, UK: 14, India: 10, UAE: 8, Russia: 2 },
};

async function main() {
  const wbPath = path.resolve(
    process.cwd(),
    process.argv[2] ?? '../xx-Palm Jebel Ali - Country Decoder.xlsx'
  );
  const bytes = readFileSync(wbPath);
  const candidate = findModelBlocks(loadWorkbookGrids(bytes)).find((c) => c.sheetName === SHEET);
  if (!candidate) throw new Error(`no model block on sheet "${SHEET}"`);
  const { config, warnings, errors } = assembleConfig(candidate, {
    name: 'Palm Jebel Ali Decoder v2',
    slug: SLUG,
    currency: 'USD',
    defaultBudget: BUDGET,
  });
  if (!config) throw new Error(`assembly failed: ${errors.join('; ')}`);
  const report = verifyAgainstWorkbook(config, candidate);
  console.log('verification:', report.ok ? 'OK' : 'MISMATCH', 'maxScoreDelta', report.maxScoreDelta);
  if (!report.ok) throw new Error(`refusing to seed an unverified config: ${report.reasons.join('; ')}`);
  if (warnings.length > 0) console.warn('warnings:', warnings);

  const v = validateConfig({ ...config, allocation: ALLOCATION });
  if (!v.ok) throw new Error(`allocation invalid: ${v.errors.join('; ')}`);

  const { id, revision } = await publishVersion(v.config, {
    workbookPathFor: async (rev) => {
      const target = `${SLUG}/rev-${rev}.xlsx`;
      const { error } = await serviceClient()
        .storage.from('workbooks')
        .upload(target, bytes, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });
      if (error) throw new Error(`workbook upload failed: ${error.message}`);
      return target;
    },
  });
  console.log(`published slug=${SLUG} id=${id} revision=${revision}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
