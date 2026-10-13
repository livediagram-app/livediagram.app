// More Social layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"), category 'social':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme. Posts for Instagram,
// LinkedIn, X and stories: one clear message each, in big type, built first for Square, Portrait
// post (4:5) and Story (9:16) pages.
import type { PageLayout } from './page-layouts';
import {
  buildCarouselCover,
  buildCountdown,
  buildMilestone,
  buildTipOfTheDay,
  buildWelcome,
} from './page-layouts-set-social-2';
import {
  buildBehindTheScenes,
  buildGiveaway,
  buildProductSpotlight,
  buildWebinar,
} from './page-layouts-set-social-3';

export type SocialSetLayoutId =
  | 'tip-of-the-day'
  | 'milestone'
  | 'countdown'
  | 'welcome'
  | 'carousel-cover'
  | 'product-spotlight'
  | 'behind-the-scenes'
  | 'giveaway'
  | 'webinar';

export const SOCIAL_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'carousel-cover',
    category: 'social',
    label: 'Carousel Cover',
    description: 'A big hook over several lines, a teaser and a swipe cue',
    build: buildCarouselCover,
  },
  {
    id: 'tip-of-the-day',
    category: 'social',
    label: 'Tip of the Day',
    description: 'A numbered tip set large and three reasons it works',
    build: buildTipOfTheDay,
  },
  {
    id: 'milestone',
    category: 'social',
    label: 'Milestone',
    description: 'A follower milestone set huge, a thank-you and the climb as a chart',
    build: buildMilestone,
  },
  {
    id: 'behind-the-scenes',
    category: 'social',
    label: 'Behind the Scenes',
    description: 'A title and a mosaic of three photos, each naming a step',
    build: buildBehindTheScenes,
  },
  {
    id: 'countdown',
    category: 'social',
    label: 'Countdown',
    description: 'Days, hours and minutes to go in tiles, the date and a reminder button',
    build: buildCountdown,
  },
  {
    id: 'product-spotlight',
    category: 'social',
    label: 'Product Spotlight',
    description: 'A product photo with its price badge, a rating and a Shop now button',
    build: buildProductSpotlight,
  },
  {
    id: 'giveaway',
    category: 'social',
    label: 'Giveaway',
    description: 'The prize with a WIN star, three steps to enter and the small print',
    build: buildGiveaway,
  },
  {
    id: 'welcome',
    category: 'social',
    label: 'Welcome Aboard',
    description: 'A new hire: a round photo, name, role and three fun facts',
    build: buildWelcome,
  },
  {
    id: 'webinar',
    category: 'social',
    label: 'Webinar',
    description: 'A talk title, when and where, the host and a Save your seat button',
    build: buildWebinar,
  },
];
