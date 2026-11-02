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
  // Diagrams: two boxes joined by a connector.
  diagrams: glyph(
    <>
      <rect x="1.5" y="2.5" width="5.5" height="4" rx="1" />
      <rect x="9" y="9.5" width="5.5" height="4" rx="1" />
      <path d="M4.25 6.5v4.75H9" />
    </>,
  ),
  // Whiteboard: a freehand stroke under a pen nib.
  whiteboard: glyph(
    <>
      <path d="M10.5 2.5l3 3-6 6-3.5.5.5-3.5z" />
      <path d="M2 14c1.5-1 3-1 4.5 0s3 1 4.5 0" />
    </>,
  ),
};
