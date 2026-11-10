import { Glyph } from '@livediagram/ui';
import type { PaletteTileDef } from './types';

// The Components tiles: one section of the palette tile catalogue,
// joined into PALETTE_TILES by palette-tile-defs.tsx in catalogue order.

export const COMPONENT_TILES: PaletteTileDef[] = [
  // --- Components (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md): each one element that lays itself out -
  {
    id: 'components:banner',
    tileGroup: 'web',
    blurb: 'A themed title block for the top',
    caption: 'Banner',
    section: 'components',
    label: 'Add Banner',
    description:
      'Banner. A themed title block (an accent bar with a title and subtitle) to head your diagram. Click to drop or drag to size; double-click to edit the title, click the subtitle once it is selected to edit it.',
    noTint: true,
    action: { type: 'component', kind: 'banner' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M7 10.75h10" strokeWidth="2.2" />
        <path d="M9 14.25h6" />
      </Glyph>
    ),
  },
  {
    id: 'components:callout',
    tileGroup: 'web',
    blurb: 'A note box with an icon and title',
    caption: 'Callout',
    section: 'components',
    label: 'Add Callout',
    description:
      'Callout. A soft note box with an icon badge, a heading, and a body for annotating a diagram. Click to drop or drag to size; double-click to edit the body.',
    noTint: true,
    action: { type: 'component', kind: 'callout' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
        <path d="M11 8.5h8M6 13h13M6 16h9" />
      </Glyph>
    ),
  },
  {
    id: 'components:stat',
    tileGroup: 'web',
    blurb: 'Three KPI cards side by side',
    caption: 'Stat Row',
    section: 'components',
    label: 'Add Stat Row',
    description:
      'Stat row. KPI cards (big number + caption) for dashboards and summaries. Resize to spread the cards; click a number to edit it, and add or remove stats from its menu.',
    noTint: true,
    action: { type: 'component', kind: 'stat' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2" y="6" width="6" height="12" rx="1" />
        <rect x="9" y="6" width="6" height="12" rx="1" />
        <rect x="16" y="6" width="6" height="12" rx="1" />
        <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
      </Glyph>
    ),
  },
  {
    id: 'components:process',
    tileGroup: 'web',
    blurb: 'Numbered steps joined by arrows',
    caption: 'Process',
    section: 'components',
    label: 'Add Process Steps',
    description:
      'Process steps. Numbered circles joined by arrows with captions, for flows. Resize to spread the steps; click a caption to edit it, and add or remove steps from its menu.',
    noTint: true,
    action: { type: 'component', kind: 'process' },
    icon: (
      <Glyph size={18} units={24}>
        <circle cx="5" cy="12" r="3" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="12" r="3" />
        <path d="M8 12h1M15 12h1" />
      </Glyph>
    ),
  },
  {
    id: 'components:hero',
    tileGroup: 'web',
    blurb: 'A big image with a title card',
    caption: 'Hero',
    section: 'components',
    label: 'Add Hero',
    description:
      'Hero. A large image with a title and supporting line on a themed caption card. Click to drop or drag to size; double-click the image to set it, click the caption to edit it.',
    noTint: true,
    needsImage: true,
    action: { type: 'component', kind: 'hero' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
        <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
        <path d="M7 17.5h10" strokeWidth="2.2" />
      </Glyph>
    ),
  },
  {
    id: 'components:header',
    tileGroup: 'web',
    blurb: 'A website-style nav bar',
    caption: 'Header',
    section: 'components',
    label: 'Add Header',
    description:
      'Header. A website-style bar with a logo, brand name, and nav links. Resize to make room for more links; drop an icon on it to set the logo.',
    noTint: true,
    action: { type: 'component', kind: 'header' },
    icon: (
      <Glyph size={18} units={24}>
        <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
        <circle cx="7" cy="12" r="2.2" />
        <path d="M14 10.5h5M14 13.5h5" />
      </Glyph>
    ),
  },
];
