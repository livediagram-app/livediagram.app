// Generates one product's /licences page data (docs/specs/002-project-scope/third-party-licences.md in each
// product): the product's own tables, from its @<product>/licences package's `src/product.ts` (`LICENCES`),
// handed to generateLicences. The product's marketing build runs it, locally and in CI alike, from its app:
//   node ../../../packages/licences/scripts/generate-product.ts --product ../../packages/licences --out .
// Writes <out>/generated/licences.json and <out>/public/licences/texts/*.txt.
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { LicencesProduct } from '../src/tables.ts';
import { generateLicences } from './generate.ts';
import { logFailure } from './log.ts';

const at = process.argv.indexOf('--product');
const dir = at === -1 ? undefined : process.argv[at + 1];

try {
  if (!dir) throw new Error('usage: generate-product.ts --product <dir> --out <dir>');
  const tables = pathToFileURL(join(resolve(dir), 'src', 'product.ts')).href;
  const { LICENCES } = (await import(tables)) as { LICENCES: LicencesProduct };
  generateLicences(LICENCES);
} catch (error) {
  logFailure(error);
  process.exit(1);
}
