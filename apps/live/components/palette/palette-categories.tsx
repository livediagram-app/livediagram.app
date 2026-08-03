'use client';

// The palette's category catalogue: which categories exist, in band order,
// with the label, blurb and glyph each one wears.
//
// Its own module, holding NO component imports, because two surfaces need the
// list and one of them is reached from inside a category body: the palette's
// Favourites tab renders the Edit Favourites dialog, which draws a pill per
// category. With this living beside the tab bodies, that closed a cycle
// (catalogue -> favourites tab -> dialog -> catalogue) and the dialog saw an
// undefined list at module-eval time.

import {
  BehaviourTabIcon,
  BuildTabIcon,
  CollaborateTabIcon,
  ComponentsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  DrawTabIcon,
  FavouritesTabIcon,
  IconsTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  WriteTabIcon,
} from './palette-tab-icons';

/**
 * The category catalogue's IDENTITY: which categories exist, in band order,
 * with the label, blurb and glyph each one wears. No bodies.
 *
 * Split from `paletteCategoryTabs` below because two surfaces need the list
 * and only one of them can build the bodies: the Edit Favourites dialog draws
 * a pill per category but has no search state to hand the Icons / Stickers /
 * Tech tabs. It used to keep its own copy of the list, which drifted the
 * moment the palette changed — by the time it was noticed it was offering a
 * Tools category that no longer existed and hiding six that did.
 *
 * Order IS layout: PaletteTabBar renders the dropdown straight from this
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
    id: 'favourites',
    label: 'Favourites',
    // No band: it is every category at once, so it spans the row
    // above the first heading rather than sitting under one.
    fullWidth: true,
    description:
      'Your go-to tiles from every category in one grid. Edit to add or remove controls.',
    icon: <FavouritesTabIcon />,
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
    description: 'The wordy elements: pages, text, sticky notes, and annotations.',
    icon: <WriteTabIcon />,
  },
  {
    id: 'draw',
    label: 'Draw',
    group: 0,
    description: 'The gesture tools: pencil, highlighter, polygon, and arrows.',
    icon: <DrawTabIcon />,
  },
  {
    id: 'build',
    label: 'Build',
    group: 1,
    description: 'The structural elements: mind nodes, lanes, frames, timelines, and tables.',
    icon: <BuildTabIcon />,
  },
  {
    id: 'components',
    label: 'Components',
    group: 1,
    description:
      'Ready-made composites that follow the tab theme: Banner, Hero, and Header. Each drops as a group you can recolour, retitle, or ungroup.',
    icon: <ComponentsTabIcon />,
  },
  {
    id: 'devices',
    label: 'Devices',
    group: 1,
    description: 'Wireframing device frames: browser, monitor, laptop, phone, tablet, smartwatch.',
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
      'Colour emoji for reacting, showing how you feel, marking status, pointing at things, celebrating, and prettying the board up.',
    icon: <StickersTabIcon />,
  },
  {
    id: 'technology',
    label: 'Tech',
    group: 2,
    description:
      'Full-colour AWS, Azure, and generic-infrastructure icons for system-architecture diagrams.',
    icon: <TechTabIcon />,
  },
  {
    id: 'media',
    label: 'Media',
    group: 2,
    description: 'Pictures and figures: an uploaded image, or a circular avatar.',
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
  {
    id: 'behaviour',
    label: 'Behaviour',
    group: 3,
    description:
      'Elements that do something when somebody interacts with them: switch a mode, jump through a portal, open a link, run a timer or vote, uncover something hidden, mark work done, throw a reaction, take a seat, or pick at random.',
    icon: <BehaviourTabIcon />,
  },
  {
    // Collaborate (spec/123 to spec/129, plus the comment pin in
    // spec/136): the elements that collect what the room thinks.
    // Dynamic band, beside Behaviour — both hold elements whose
    // content arrives at runtime rather than being drawn by the author.
    id: 'collaborate',
    label: 'Collaborate',
    group: 3,
    description:
      'Elements that collect what the room thinks: comment pins, estimate cards, temperature checks, idea boxes, agendas, decision records, and roll calls.',
    icon: <CollaborateTabIcon />,
  },
];
