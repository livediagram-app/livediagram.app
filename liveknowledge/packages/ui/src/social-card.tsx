// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in liveknowledge's lime with its own wordmark, headline and footer line.

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
  wordmark: 'documents',
  domain: 'liveknowledge.app',
  headline: 'Make pages together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link and start writing.',
  // The lime accent the lockup uses (lime-700: Tailwind's lime-600 is too pale for text on white).
  colours: { ground: ['#f7fee7', '#ecfccb'], ink: '#1a2e05', accent: '#4d7c0f' },
});
