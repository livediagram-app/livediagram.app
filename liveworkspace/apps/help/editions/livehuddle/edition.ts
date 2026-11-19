import type { HelpArt } from '@liveworkspace/help-site/site';
import {
  cardSubtitle,
  CONTACT_FORM_URL,
  pageMetadata,
  REPO_URL,
  SITE_NAME,
  SITE_URL,
} from '@livehuddle/ui';
import { CATEGORY_ART } from './components/category-art';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { SUPPORT_ARTICLE_FALLBACK, SUPPORT_ARTICLE_ICONS } from './lib/articleIcons';
import { FEATURE_CATEGORY_HEX, FEATURE_ENTITY_HEX } from './lib/featureColours';
import { FEATURE_CATEGORY_ICONS, FEATURE_ICONS } from './lib/featureIcons';
import { HOME } from './lib/home-sections';
import type { Edition } from '../types';

// The livehuddle edition of the one help centre (docs/specs/016-help/help-centre.md): what is livehuddle's alone,
// gathered from what its own help app bound in lib/help-site.tsx, app/page.tsx and components/. The
// framework's `editions/index.ts` picks it when the build's scope is `livehuddle`.
const art: HelpArt = {
  featureHex: FEATURE_ENTITY_HEX,
  categoryHex: FEATURE_CATEGORY_HEX,
  featureIcons: FEATURE_ICONS,
  categoryIcons: FEATURE_CATEGORY_ICONS,
  featureFallback: FEATURE_ICONS['the-canvas'],
  supportIcons: SUPPORT_ARTICLE_ICONS,
  supportFallback: SUPPORT_ARTICLE_FALLBACK,
  categoryArt: CATEGORY_ART,
};

export const edition: Edition = {
  app: 'livehuddle',
  header: Header,
  footer: Footer,
  uiFacts: {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    contactFormUrl: CONTACT_FORM_URL,
    pageMetadata,
    cardSubtitle,
  },
  art,
  homeLayout: HOME,
  heroLede: 'Guides and answers for every part of livehuddle, from your first Space onwards.',
  issuesUrl: `${REPO_URL}/issues`,
};

export default edition;
