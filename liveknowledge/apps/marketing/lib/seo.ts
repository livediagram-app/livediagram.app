import { createPageMetadata } from '@liveworkspace/ui/seo';
import { SITE_NAME, SITE_URL } from '@liveknowledge/ui';

import { SITE_PITCH } from './site-words';

// Every marketing page's metadata (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): the shared
// pageMetadata and brand card on this site's origin and name, with this site's own pitch (lib/site-words.ts).
// @liveknowledge/ui's pageMetadata still carries the fork's pitch in its share image's alt text.
export const { pageMetadata, BRAND_OG_IMAGE, BRAND_TWITTER_IMAGE } =
  /* @__PURE__ */ createPageMetadata({
    url: SITE_URL,
    name: SITE_NAME,
    pitch: SITE_PITCH,
  });
