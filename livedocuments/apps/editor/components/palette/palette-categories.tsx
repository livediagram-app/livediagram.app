'use client';

// The palette's category catalogue: which categories exist, in band order,
// with the label, blurb and glyph each one wears.
//
// Its own module, holding NO component imports, so anything that needs the list (the mode
// layouts, the whiteboard dock's shape catalogue) can import it without pulling in the category
// bodies, and without the import cycle an earlier dialog reached from inside a body once closed.

import {
  BuildTabIcon,
  ConceptsTabIcon,
  ComponentsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  DrawTabIcon,
  IconsTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  WriteTabIcon,
} from '@livedocuments/ui';

/**
 * The category catalogue's IDENTITY: which categories exist, in band order,
 * with the label, blurb and glyph each one wears. No bodies.
 *
 * Split from `paletteCategoryTabs` because several surfaces need the list and only the palette
 * builds the bodies. A surface that once kept its own copy of the list drifted the moment the
 * palette changed — by the time it was noticed it was offering a Tools category that no longer
 * existed and hiding six that did.
 *
 * Order IS layout: the category bar draws the categories in this order, with a divider
 * where `group` (the band: 0 Common, 1 Structure, 2 Decorate, 3 Dynamic) changes.
 */
export const PALETTE_CATEGORIES: {
  id: string;
  label: string;
  group?: number;
  description: string;
  icon: React.ReactNode;
}[] = [
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
    description: 'The wordy elements: text, sticky notes and pointer notes.',
    icon: <WriteTabIcon />,
  },
  {
    id: 'draw',
    label: 'Draw',
    group: 0,
    description: 'The gesture tools: polygon and arrows.',
    icon: <DrawTabIcon />,
  },
  {
    id: 'build',
    label: 'Build',
    group: 1,
    description: 'The structural elements: stacks, tables, and Sankey diagrams.',
    icon: <BuildTabIcon />,
  },
  {
    // Concept graphics (docs/specs/009-elements/concept-graphics.md): the shapes ideas come in, as single elements.
    id: 'concepts',
    label: 'Concepts',
    group: 1,
    description:
      'Concept graphics that lay out their own rows: a layer stack, a pyramid, a funnel, a cycle, a hub and spoke, onion rings, chevrons and a timeline. Add, reorder and retitle rows in place.',
    icon: <ConceptsTabIcon />,
  },
  {
    id: 'components',
    label: 'Components',
    group: 1,
    description:
      'Ready-made blocks that follow the tab theme: the Card, Badge and Step number, the web components (Banner, Callout, Stat row, Process, Hero, Header) and the code block and checklist. Each is one element that re-flows as you resize it, with every line of text editable in place.',
    icon: <ComponentsTabIcon />,
  },
  {
    id: 'devices',
    label: 'Devices',
    group: 1,
    description:
      'Wireframing device frames: browser, monitor, laptop, phone, tablet, foldable, smartwatch.',
    icon: <DevicesTabIcon />,
  },
  {
    id: 'icons',
    label: 'Icons',
    group: 2,
    description: 'Searchable catalogue of single-colour glyphs.',
    icon: <IconsTabIcon />,
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
    id: 'technology',
    label: 'Tech',
    group: 2,
    description:
      'Full-colour AWS, Azure, Cloudflare, Firebase, and generic-infrastructure icons for system-architecture diagrams.',
    icon: <TechTabIcon />,
  },
  {
    id: 'media',
    label: 'Media',
    group: 2,
    description:
      'Pictures and figures: an uploaded image or a circular avatar, embeds, a Tab Window onto another tab and a Link Card.',
    icon: <MediaTabIcon />,
  },
  {
    id: 'data',
    label: 'Data',
    group: 3,
    description:
      'Charts and meters: pie, bar and line charts, progress bars and rings, and ratings.',
    icon: <DataTabIcon />,
  },
];
