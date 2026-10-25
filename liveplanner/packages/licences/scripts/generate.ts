// Generates this product's /licences page data (docs/specs/002-project-scope/third-party-licences.md)
// with the monorepo's one generator, @liveworkspace/licences, and this product's own tables. Runs in
// the marketing build, locally and in CI alike:
//   node packages/licences/scripts/generate.ts --out apps/marketing
// Writes <out>/generated/licences.json and <out>/public/licences/texts/*.txt.
import { generateLicences } from '@liveworkspace/licences/generate';

import { LICENCE_APPS } from '../src/apps.ts';
import { EMBEDDED_WORKS } from '../src/embedded-works.ts';
import { OVERRIDES } from '../src/overrides.ts';

generateLicences({
  productRoot: new URL('../../../', import.meta.url),
  apps: LICENCE_APPS,
  overrides: OVERRIDES,
  embedded: EMBEDDED_WORKS,
});
