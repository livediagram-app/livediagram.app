import { createPageMetadata } from '@liveworkspace/ui/seo';
import { cardSubtitle } from '@liveworkspace/ui/social-card';
import { CONTACT_FORM_URL, PLATFORM_SITE } from '@liveworkspace/sites';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { ALL_APPS_ART } from './lib/art';
import { HOME } from './lib/home-sections';
import type { Edition } from '../types';

// The All Apps edition (liveworkspace/docs/specs/017-help/help-centre.md "Where it is shown"): www.liveworkspace.app/
// help, in liveworkspace's slate with its own logo, header and footer, every app's art, and its own home layout.
const { pageMetadata } = /* @__PURE__ */ createPageMetadata({
  url: PLATFORM_SITE.url,
  name: PLATFORM_SITE.name,
  pitch: 'Live collaborative apps for every kind of work in a single platform.',
});

export const edition: Edition = {
  app: 'all',
  header: Header,
  footer: Footer,
  uiFacts: {
    siteName: PLATFORM_SITE.name,
    siteUrl: PLATFORM_SITE.url,
    contactFormUrl: CONTACT_FORM_URL,
    pageMetadata,
    cardSubtitle,
  },
  art: ALL_APPS_ART,
  homeLayout: HOME,
  heroLede:
    'Guides and answers for livediagram, liveplanner, livedocuments, livedesign and livehuddle, in one place.',
};

export default edition;

// The name the generated pick (current.generated.ts) exports, so a test can alias this file in its place.
export { edition as EDITION };
