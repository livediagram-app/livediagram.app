// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in livedocuments' amber with its own wordmark, headline and footer line.

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
  domain: 'livedocuments.app',
  headline: 'Make pages together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link and start writing.',
  // The brand-700 amber the marketing Brand uses (amber-600 is too pale for text on white).
  colours: { ground: ['#fffbeb', '#fef3c7'], ink: '#451a03', accent: '#a34a0c' },
});
