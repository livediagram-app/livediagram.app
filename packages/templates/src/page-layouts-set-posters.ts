// More Posters layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"), category 'posters':
// pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the page's
// content box so each fits every size and orientation, in the tab's theme.
import type { PageLayout } from './page-layouts';
import { buildComingSoon, buildExhibition, buildGigPoster } from './page-layouts-set-posters-2';
import { buildHiring, buildResearch } from './page-layouts-set-posters-3';
import { buildTravel, buildWorkshop } from './page-layouts-set-posters-4';
import { buildBigSale, buildMotivational, buildNotice } from './page-layouts-set-posters-5';

export type PostersSetLayoutId =
  | 'gig-poster'
  | 'coming-soon'
  | 'exhibition'
  | 'travel-poster'
  | 'workshop'
  | 'research-poster'
  | 'hiring'
  | 'big-sale'
  | 'notice'
  | 'motivational';

export const POSTERS_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'gig-poster',
    category: 'posters',
    label: 'Gig Poster',
    description: 'A band name set huge, the support, a photo, date, doors and price, and tickets',
    build: buildGigPoster,
  },
  {
    id: 'research-poster',
    category: 'posters',
    label: 'Research Poster',
    description:
      'A conference poster: title and authors, sections, a results chart and the key finding',
    build: buildResearch,
  },
  {
    id: 'coming-soon',
    category: 'posters',
    label: 'Coming Soon',
    description: 'A teaser: a key image, the title, a tagline, the date set large and the credits',
    build: buildComingSoon,
  },
  {
    id: 'exhibition',
    category: 'posters',
    label: 'Exhibition',
    description: 'A Swiss-style title in steps, a captioned artwork and the dates, hours and place',
    build: buildExhibition,
  },
  {
    id: 'travel-poster',
    category: 'posters',
    label: 'Travel',
    description: 'A destination set huge, a big photo, three facts and the offer',
    build: buildTravel,
  },
  {
    id: 'workshop',
    category: 'posters',
    label: 'Workshop',
    description: 'A class: what you learn, when and how much, and a tear-off strip to take away',
    build: buildWorkshop,
  },
  {
    id: 'hiring',
    category: 'posters',
    label: "We're Hiring",
    description: 'A big "We\'re hiring", three open roles, the perks and where to apply',
    build: buildHiring,
  },
  {
    id: 'big-sale',
    category: 'posters',
    label: 'Big Sale',
    description: 'Up to 50% off set in a big disc, the dates, the departments and where to shop',
    build: buildBigSale,
  },
  {
    id: 'notice',
    category: 'posters',
    label: 'Notice',
    description: 'A workplace sign: a Caution band, a big icon, the rule and what else to do',
    build: buildNotice,
  },
  {
    id: 'motivational',
    category: 'posters',
    label: 'Motivational',
    description: 'A framed, type-only poster: three short lines set huge and who said them',
    build: buildMotivational,
  },
];
