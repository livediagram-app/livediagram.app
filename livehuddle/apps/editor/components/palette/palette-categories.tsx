'use client';

// The palette's category catalogue: which categories exist, in band order,
// with the label, blurb and glyph each one wears.
//
// Its own module, holding NO component imports, so anything that needs the list (the mode
// layouts, the whiteboard dock's shape catalogue) can import it without pulling in the category
// bodies, and without the import cycle an earlier dialog reached from inside a body once closed.

import {
  BuildTabIcon,
  ComponentsTabIcon,
  DrawTabIcon,
  PopularTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  WriteTabIcon,
} from '@livehuddle/ui';
import { MEET_BAND, SPACE_CATEGORIES } from './space-categories';

/**
 * The category catalogue's IDENTITY: which categories exist, in band order,
 * with the label, blurb and glyph each one wears. No bodies.
 *
 * Split from `paletteCategoryTabs` because several surfaces need the list and only the palette
 * builds the bodies. A surface that once kept its own copy of the list drifted the moment the
 * palette changed — by the time it was noticed it was offering a Tools category that no longer
 * existed and hiding six that did.
 *
 * Order IS layout: the category picker renders the dropdown straight from this
 * array, grouping by `group` under the CATEGORY_BANDS headings (0 Common,
 * 1 Structure, 2 Decorate, 3 Dynamic, 6 Meet, 7 Travel).
 */
export const PALETTE_CATEGORIES: {
  id: string;
  label: string;
  group?: number;
  fullWidth?: boolean;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    // Popular (docs/specs/007-editor/editor-modes.md "The palette per mode"): every mode's
    // landing category, twelve tiles that mode is most often built from, picked across its
    // categories by its palette layout. No band: it draws from every category at once, so it
    // spans the row above the first heading rather than sitting under one.
    id: 'popular',
    label: 'Popular',
    fullWidth: true,
    description: 'The tiles most reached for in this mode, from across its categories.',
    icon: <PopularTabIcon />,
  },
  {
    id: 'shapes',
    label: 'Shapes',
    group: 0,
    description: 'Square, circle, diamond, and the flowchart shape vocabulary.',
    icon: <ShapesTabIcon />,
  },
  {
    id: 'write',
    label: 'Write',
    group: 0,
    description: 'The wordy elements: pages, text, sticky notes, annotations and pointer notes.',
    icon: <WriteTabIcon />,
  },
  {
    id: 'draw',
    label: 'Draw',
    group: 0,
    description: 'The gesture tools: pencil, shape pen, highlighter, polygon, and arrows.',
    icon: <DrawTabIcon />,
  },
  {
    id: 'build',
    label: 'Build',
    group: 1,
    description:
      'The structural elements: lanes, frames, stacks, boundaries, a timeline, a diagram key and tables.',
    icon: <BuildTabIcon />,
  },
  {
    id: 'layout',
    label: 'Layout',
    group: 1,
    description:
      'What a board is arranged and labelled with: lanes, frames, stacks, boundaries, a timeline, a diagram key, cards, badges and step numbers.',
    icon: <BuildTabIcon />,
  },
  {
    id: 'components',
    label: 'Components',
    group: 1,
    description:
      'Ready-made blocks that follow the tab theme: the Card, Badge and Step number, the Callout and the Hero. Each is one element that re-flows as you resize it, with every line of text editable in place.',
    icon: <ComponentsTabIcon />,
  },
  {
    id: 'stickers',
    label: 'Stickers',
    group: 2,
    description:
      'Colour emoji for reacting, showing how you feel, marking status, pointing at things, celebrating, and prettying the canvas up.',
    icon: <StickersTabIcon />,
  },
  {
    id: 'media',
    label: 'Media',
    group: 2,
    description: 'Pictures and figures: an uploaded image or a circular avatar.',
    icon: <MediaTabIcon />,
  },
  // The meeting elements (docs/specs/010-palette/palette-top-level-categories.md "The Space categories"): the Space
  // categories, from their one list. Their own band, one category per group, with no parent category. Their tiles:
  // COLLABORATE_CATEGORY_GROUPS. The Selection Mode category is gone: the Avatar button is in Travel
  // (docs/specs/009-elements/mode-button.md "Only Avatar").
  // Travel takes a band of its own, set apart on the bar (palette-top-level-categories.md "The strip's order").
  ...SPACE_CATEGORIES.map(({ id, label, description, icon, band }) => ({
    id,
    label,
    group: band ?? MEET_BAND,
    description,
    icon,
  })),
];
