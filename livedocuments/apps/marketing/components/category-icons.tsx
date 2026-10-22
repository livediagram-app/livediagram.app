import { Glyph, type IconProps } from '@livedocuments/ui';
import type { ReactElement } from 'react';

// One glyph per feature category (docs/specs/019-marketing/marketing-site.md), shown beside each
// landing beat's name. Drawn on the shared chrome Glyph (16-unit viewBox, stroke
// in currentColor) so they sit with the rest of the site's icons. Each draws
// what the category is ABOUT; category-icons.test.ts pins one per
// LANDING_SECTIONS id, none shared.

type Icon = (props: IconProps) => ReactElement;

const glyph =
  (paths: ReactElement): Icon =>
  ({ size = 14, ...rest }) => (
    <Glyph size={size} {...rest}>
      {paths}
    </Glyph>
  );

export const CATEGORY_ICONS: Record<string, Icon> = {
  // Articles: a page of writing.
  articles: glyph(
    <>
      <path d="M3.5 1.5h6l3 3v10h-9z" />
      <path d="M9.5 1.5v3h3M5.5 7.5h5M5.5 9.75h5M5.5 12h3" />
    </>,
  ),
  // Slide decks: a slide on its stand, a play mark on it.
  slides: glyph(
    <>
      <rect x="1.5" y="2.5" width="13" height="8.5" rx="1" />
      <path d="M7 5l3 1.75L7 8.5z" />
      <path d="M8 11v2.5M5.5 14h5" />
    </>,
  ),
  // Infographics: a page with a title and a bar chart.
  infographics: glyph(
    <>
      <rect x="3.5" y="1.5" width="9" height="13" rx="1" />
      <path d="M5.5 4h5M6 12V9.5M8 12V8M10 12v-1.5" />
    </>,
  ),
  // Logos and wireframes: a square artboard with a mark on its keyline circle.
  logos: glyph(
    <>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <circle cx="8" cy="8" r="3.5" />
      <path d="M8 4.5v7" />
    </>,
  ),
  // Collaboration: two people.
  collaboration: glyph(
    <>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M2 13.5c.4-2.4 2-3.75 4-3.75s3.6 1.35 4 3.75" />
      <path d="M10.5 3.5a2.25 2.25 0 0 1 0 4.25M11.75 9.9c1.2.5 2 1.7 2.25 3.6" />
    </>,
  ),
};
