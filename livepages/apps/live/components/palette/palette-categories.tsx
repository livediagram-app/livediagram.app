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
  PopularTabIcon,
  IconsTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  WriteTabIcon,
  ParticipateTabIcon,
} from '@livepages/ui';
import { Glyph } from '@livepages/ui';

// A phone with a screen being wireframed: a bar, a picture and a button.
function WireframeTabIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <rect x="8.5" y="6.5" width="7" height="5" rx="0.75" />
      <path d="M8.5 14.5h7M8.5 17.5h4" />
    </Glyph>
  );
}

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
 * 1 Structure, 2 Decorate, 3 Dynamic).
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
    // Popular (docs/specs/007-editor/pages-mode.md "The palette's kind"): every page kind's
    // landing category, twelve tiles that kind is most often built from, picked across its
    // categories by its palette layout. No band: it draws from every category at once, so it
    // spans the row above the first heading rather than sitting under one.
    id: 'popular',
    label: 'Popular',
    fullWidth: true,
    description: 'The tiles most reached for in this mode, from across its categories.',
    icon: <PopularTabIcon />,
  },
  {
    // Participate (docs/specs/013-workspace/share-roles.md): a Participant's whole palette, what it may add. In no
    // mode's layout: participantPaletteCategories offers it, and only to a Participant.
    id: 'participate',
    label: 'Participate',
    fullWidth: true,
    description: 'Add stickies and text to the board.',
    icon: <ParticipateTabIcon />,
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
    // Pages mode, while the tab has a wireframe page (docs/specs/007-editor/wireframe-pages.md "The
    // Elements palette").
    id: 'wireframe',
    label: 'Elements',
    group: 0,
    description:
      'The parts a screen is wireframed from: buttons, fields, badges, pictures, avatars, cards and lists.',
    icon: <WireframeTabIcon />,
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
    description: 'The structural elements: frames, stacks, tables, and Sankey diagrams.',
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
      'Pictures and figures: an uploaded image or a circular avatar; in Pages, embeds, a Tab Window onto another tab and a Link Card.',
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
