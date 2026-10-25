import { createPageMetadata } from '@liveworkspace/ui/seo';
import { SITE_NAME, SITE_PITCH, SITE_URL } from './site';

// Per-page SEO for the public sites (docs/specs/019-marketing/marketing-site.md "SEO and metadata",
// docs/specs/018-help/help-app.md): @liveworkspace/ui's pageMetadata and brand card, on this site's
// origin, name and pitch. The title passes through verbatim, and every page carries the large brand
// card unless it ships its own.

export type { PageMetadataInput } from '@liveworkspace/ui/seo';

export const { pageMetadata, BRAND_OG_IMAGE, BRAND_TWITTER_IMAGE } =
  /* @__PURE__ */ createPageMetadata({
    url: SITE_URL,
    name: SITE_NAME,
    pitch: SITE_PITCH,
  });
