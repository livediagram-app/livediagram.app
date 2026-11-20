import { createSocialCard, type SocialCardOptions } from '@liveworkspace/ui/social-card';
import { brandMarkSvg } from '@liveknowledge/ui';

import { HERO_HEADLINE, PITCH_LINE } from './site-words';

// This site's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): the shared card on
// the lime ground, with the brand's lime cube, the `knowledge` wordmark and this site's own words. A page with
// its own headline (a comparison) passes it; the landing page's card carries the hero's.
const card = /* @__PURE__ */ createSocialCard({
  markSvg: brandMarkSvg({ variant: 'full', scheme: 'light' }),
  wordmark: 'knowledge',
  domain: 'liveknowledge.app',
  headline: 'Knowledge your team trusts,',
  pitch: () => PITCH_LINE,
  footer: 'Free and open source. Start without signing up.',
  // The lime accent the lockup uses (lime-700: lime-600 is too pale for text on white).
  colours: { ground: ['#f7fee7', '#ecfccb'], ink: '#1a2e05', accent: '#4d7c0f' },
});

export function renderSocialCard(opts?: SocialCardOptions) {
  return card({ title: HERO_HEADLINE, subtitle: PITCH_LINE, ...opts });
}
