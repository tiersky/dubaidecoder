import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from '../lib/parser/grid';
import { findModelBlocks } from '../lib/parser/detect';
import { assembleConfig } from '../lib/parser/assemble';
import { verifyAgainstWorkbook } from '../lib/parser/verify';
import { publishVersion } from '../lib/versions/store';

async function main() {
  const wbPath = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
  const candidates = findModelBlocks(loadWorkbookGrids(readFileSync(wbPath)));
  if (candidates.length === 0) throw new Error('no model block found');
  const candidate = candidates[0];
  const { config, warnings, errors } = assembleConfig(candidate, {
    name: 'Egypt Decoder',
    slug: 'egypt',
    currency: candidate.budget?.currency ?? 'USD',
    defaultBudget: candidate.budget?.amount ?? 10_000_000,
  });
  if (!config) throw new Error(`assembly failed: ${errors.join('; ')}`);
  const report = verifyAgainstWorkbook(config, candidate);
  console.log('verification:', report.ok ? 'OK' : 'MISMATCH', 'maxScoreDelta', report.maxScoreDelta);
  if (!report.ok) throw new Error('refusing to seed an unverified config');
  if (warnings.length > 0) console.warn('warnings:', warnings);
  const { id, revision } = await publishVersion(config);
  console.log(`published slug=egypt id=${id} revision=${revision}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
