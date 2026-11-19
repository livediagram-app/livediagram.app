import { catalogueFor, guideCounts } from '@liveworkspace/help-registry/catalogue';
import { createHelpSite } from '@liveworkspace/help-site/site';
import { EDITION } from '@/editions';
import { SCOPE } from './scope.generated';

// The one help centre, bound once for the build's scope (liveworkspace/docs/specs/016-help/blueprints/help-centre.md
// "The build"): the scope's articles and categories from the one catalogue, its edition's name, origin, art and
// metadata rules, and each scope's guide count for the app switch. Server-side only; the browser half is
// lib/help-client.tsx.
export const site = createHelpSite({
  ...EDITION.uiFacts,
  catalogue: catalogueFor(SCOPE),
  art: EDITION.art,
  scope: SCOPE,
  guideCounts: guideCounts(),
});
