import { createHelpSite } from '@liveworkspace/help-site/site';
import { cardSubtitle, CONTACT_FORM_URL, pageMetadata, SITE_NAME, SITE_URL } from '@liveplanner/ui';
import { CATEGORY_ART } from '@/components/category-art';
import { articles, categories, getCategoryGroups } from './articles';
import { SUPPORT_ARTICLE_FALLBACK, SUPPORT_ARTICLE_ICONS } from './articleIcons';
import { FEATURE_CATEGORY_HEX, FEATURE_ENTITY_HEX } from './featureColours';
import { FEATURE_CATEGORY_ICONS, FEATURE_FALLBACK_ICON, FEATURE_ICONS } from './featureIcons';

// The liveplanner help centre, bound once (docs/specs/018-help/help-app.md). The pages, components and helpers
// are @liveworkspace/help-site's; what is liveplanner's is here: its name and origin, its article catalogue, its
// card art, and the metadata and social-card rules of its ui package. Server-side only; the browser half is
// lib/help-client.tsx.
export const site = createHelpSite({
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
  contactFormUrl: CONTACT_FORM_URL,
  catalogue: { articles, categories, getCategoryGroups },
  art: {
    featureHex: FEATURE_ENTITY_HEX,
    categoryHex: FEATURE_CATEGORY_HEX,
    featureIcons: FEATURE_ICONS,
    categoryIcons: FEATURE_CATEGORY_ICONS,
    featureFallback: FEATURE_FALLBACK_ICON,
    supportIcons: SUPPORT_ARTICLE_ICONS,
    supportFallback: SUPPORT_ARTICLE_FALLBACK,
    categoryArt: CATEGORY_ART,
  },
  pageMetadata,
  cardSubtitle,
});
