// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in livehuddle's emerald with its own wordmark, headline and footer line.

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
  wordmark: 'huddle',
  domain: 'livehuddle.app',
  headline: 'Meet together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link and walk in.',
  // brand-700, the accent the marketing Brand uses in light mode, over emerald-50 into emerald-100.
  colours: { ground: ['#ecfdf5', '#d1fae5'], ink: '#022c22', accent: '#047857' },
});
