import type { LicencesProduct } from '@liveworkspace/licences/tables';

import { DISTRIBUTED_APPS, LICENCE_APPS } from './apps.ts';
import { EMBEDDED_WORKS } from './embedded-works.ts';
import { OVERRIDES } from './overrides.ts';

// This product's /licences page (docs/specs/002-project-scope/third-party-licences.md), as
// @liveworkspace/licences' generator and checks take it: its folder and its own tables. The marketing build
// hands it to the generator, locally and in CI alike, from apps/marketing:
//   node ../../../packages/licences/scripts/generate-product.ts --product ../../packages/licences --out .
export const LICENCES: LicencesProduct = {
  productRoot: new URL('../../../', import.meta.url),
  apps: LICENCE_APPS,
  distributed: DISTRIBUTED_APPS,
  overrides: OVERRIDES,
  embedded: EMBEDDED_WORKS,
};
