import { Glyph, type IconProps } from '@livedesign/ui';
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
  // Logos and wireframes: a square artboard with a mark on its keyline circle.
  logos: glyph(
    <>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <circle cx="8" cy="8" r="3.5" />
      <path d="M8 4.5v7" />
    </>,
  ),
  // Photo editing: a picture, a sun over a hill.
  photos: glyph(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <circle cx="10.5" cy="6" r="1.5" />
      <path d="M1.5 11.5l4-4 3.5 3.5 2-2 3.5 3.5" />
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
