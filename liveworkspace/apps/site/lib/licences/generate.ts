// Generates liveworkspace.app's /licences data (liveworkspace/docs/specs/010-site/site.md "Licences") with the
// monorepo's one generator and liveworkspace's own tables. Runs in the site's build:
//   node lib/licences/generate.ts --out .
// Writes generated/licences.json and public/licences/texts/*.txt.
import { generateLicences } from '@liveworkspace/licences/generate';

import { LICENCE_APPS } from './apps.ts';
import { EMBEDDED_WORKS } from './embedded-works.ts';
import { OVERRIDES } from './overrides.ts';

generateLicences({
  productRoot: new URL('../../../../', import.meta.url),
  apps: LICENCE_APPS,
  overrides: OVERRIDES,
  embedded: EMBEDDED_WORKS,
});
