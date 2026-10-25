// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in livedesign's rose with its own wordmark, headline and footer line.

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
  wordmark: 'design',
  domain: 'livedesign.app',
  headline: 'Make pages together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link and start writing.',
  // The brand-700 rose the marketing Brand uses (rose-600 is too pale for text on white).
  colours: { ground: ['#fff1f2', '#ffe4e6'], ink: '#4c0519', accent: '#be123c' },
});
