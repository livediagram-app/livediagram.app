// This product's social card (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): @liveworkspace/ui's
// card, drawn in liveplanner's violet with its own wordmark, headline and footer line.

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
  wordmark: 'planner',
  domain: 'liveplanner.app',
  headline: 'Plan together,',
  pitch: sentencePitch,
  footer: 'No sign-up. Open the link, start planning.',
  // The violet-600 accent the marketing Brand uses.
  colours: { ground: ['#f5f3ff', '#ede9fe'], ink: '#2e1065', accent: '#7c3aed' },
});
