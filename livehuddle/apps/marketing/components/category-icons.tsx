import { Glyph, type IconProps } from '@livehuddle/ui';
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
  // Collaboration: two people.
  collaboration: glyph(
    <>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M2 13.5c.4-2.4 2-3.75 4-3.75s3.6 1.35 4 3.75" />
      <path d="M10.5 3.5a2.25 2.25 0 0 1 0 4.25M11.75 9.9c1.2.5 2 1.7 2.25 3.6" />
    </>,
  ),
  // Spaces: a little character standing in a doorway.
  spaces: glyph(
    <>
      <path d="M2.5 14.5v-11a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v11" />
      <circle cx="8" cy="6.25" r="1.75" />
      <path d="M5.5 14.5c.3-2.3 1.2-3.75 2.5-3.75s2.2 1.45 2.5 3.75" />
    </>,
  ),
  // Meetings: a timer, the meeting's own clock.
  meetings: glyph(
    <>
      <circle cx="8" cy="9" r="5.25" />
      <path d="M8 9V6.25M6.5 1.75h3M12.25 4.25l1-1" />
    </>,
  ),
};
