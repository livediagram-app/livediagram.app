// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in livediagram's sky with its own wordmark, headline and footer line.

import { createSocialCard } from '@liveworkspace/ui/social-card';
import { brandMarkSvg } from './brand-app';
import { sentencePitch } from './site';

export {
  CARD_SUBTITLE_MAX,
  cardSubtitle,
  type SocialCardOptions,
} from '@liveworkspace/ui/social-card';

export const renderSocialCard = /* @__PURE__ */ createSocialCard({
  markSvg: brandMarkSvg({ variant: 'full', scheme: 'light' }),
  wordmark: 'diagram',
  domain: 'livediagram.app',
  headline: 'Diagram together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link, start drawing.',
  // The sky-600 accent the marketing Brand uses.
  colours: { ground: ['#f0f9ff', '#e0f2fe'], ink: '#0c4a6e', accent: '#0284c7' },
});
