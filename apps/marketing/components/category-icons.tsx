import { Glyph, type IconProps } from '@livediagram/ui';
import type { ReactElement } from 'react';

// One glyph per feature category (docs/specs/019-marketing/marketing-site.md), shown on the landing beats'
// category chips. Drawn on the shared chrome Glyph (16-unit viewBox, stroke
// in currentColor) so they sit with the rest of the site's icons. Each draws
// what the category is ABOUT; category-icons.test.ts pins one per
// LANDING_SECTIONS id, none shared.

type Icon = (props: IconProps) => ReactElement;

const glyph =
  (paths: ReactElement): Icon =>
  ({ size = 14, strokeWidth = 1.5, ...rest }) => (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      {paths}
    </Glyph>
  );

export const CATEGORY_ICONS: Record<string, Icon> = {
  // The basics: a pointer, the first thing you use.
  simple: glyph(<path d="M4 2.5l8.5 5.25-3.75.9 2.1 3.95-1.55.85-2.1-3.95L4.5 12z" />),
  // Rich content: a picture.
  content: glyph(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.75" cy="6.25" r="1.1" />
      <path d="M2.5 11.5l3.5-3 2.5 2 2-1.75 3 2.75" />
    </>,
  ),
  // Drawing and text: a freehand stroke under a pen nib.
  express: glyph(
    <>
      <path d="M10.5 2.5l3 3-6 6-3.5.5.5-3.5z" />
      <path d="M2 14c1.5-1 3-1 4.5 0s3 1 4.5 0" />
    </>,
  ),
  // Smart assists: a box snapped to alignment guides.
  assist: glyph(
    <>
      <rect x="5" y="5" width="6" height="6" rx="1" />
      <path d="M2 5h1.5M12.5 5H14M2 11h1.5M12.5 11H14M5 2v1.5M5 12.5V14M11 2v1.5M11 12.5V14" />
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
  // Tabs: a row of tabs over a page.
  tabs: glyph(
    <>
      <path d="M2 13V5.5h12V13z" />
      <path d="M2 5.5V3.5h4l.75 2M6.75 5.5V3.5H10.5l.75 2" />
    </>,
  ),
  // Presenting: a screen on a stand.
  present: glyph(
    <>
      <rect x="2" y="2.5" width="12" height="8" rx="1" />
      <path d="M8 10.5v3M5.5 13.5h5M6.75 5l2.75 1.5-2.75 1.5z" />
    </>,
  ),
  // Animation: a shape leaving motion lines behind it.
  motion: glyph(
    <>
      <circle cx="11" cy="8" r="2.75" />
      <path d="M1.5 5h4.5M3 8h3.5M1.5 11h4.5" />
    </>,
  ),
  // Customisation: a painter's palette.
  customise: glyph(
    <>
      <path d="M8 2a6 6 0 0 0 0 12c1 0 1.5-.6 1.5-1.4 0-.9-.8-1.2-.8-2 0-.7.6-1.1 1.3-1.1H12a2 2 0 0 0 2-2A5.8 5.8 0 0 0 8 2z" />
      <circle cx="5" cy="7" r=".75" />
      <circle cx="7.5" cy="4.75" r=".75" />
      <circle cx="10.5" cy="5.25" r=".75" />
    </>,
  ),
  // Organising: stacked layers.
  refine: glyph(
    <>
      <path d="M8 2.5l6 3-6 3-6-3z" />
      <path d="M2 8.25l6 3 6-3M2 11l6 3 6-3" />
    </>,
  ),
  // Open source: code brackets.
  foundations: glyph(<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10" />),
  // Reliability: a shield with a tick.
  reliability: glyph(
    <>
      <path d="M8 2l5 2v4c0 3-2.2 5.1-5 6-2.8-.9-5-3-5-6V4z" />
      <path d="M5.75 8l1.6 1.6 2.9-3.1" />
    </>,
  ),
  // Tools and AI: a plug.
  connect: glyph(
    <>
      <path d="M6 2v3M10 2v3" />
      <path d="M4 5h8v2.5a4 4 0 0 1-8 0z" />
      <path d="M8 11.5V14" />
    </>,
  ),
};
