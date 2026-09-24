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
  EventStormingTabIcon,
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
    description: 'The gesture tools: pencil, shape pen, polygon, and arrows.',
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
    description:
      'Wireframing device frames: browser, monitor, laptop, phone, tablet, foldable, smartwatch.',
    icon: <DevicesTabIcon />,
  },
  {
    // Event Storming (spec/139): the workshop notation as a first-class
    // kit. Structure band — like Build, it's a set you reach for when
    // deciding how a board is arranged, not a decoration or a behaviour.
    id: 'event-storming',
    label: 'Event Storming',
    group: 1,
    description:
      'The sticky-note workshop notation: events, commands, actors, policies, read models, and more.',
    icon: <EventStormingTabIcon />,
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
    // Behaviours (spec/110): everything whose content arrives at RUNTIME
    // rather than being drawn by the author — the elements that do something
    // when pressed (spec/103 to spec/107, spec/135) and the ones that collect
    // what the room thinks (spec/123 to spec/129, spec/136).
    //
    // ONE category, not two. They were split on "pressing this does something
    // to your session" versus "the board is collecting an answer from
    // everybody" — a real distinction, and a useless one to navigate by. You
    // reach for both while facilitating, and nothing told a user hunting for
    // the Done check why it lived apart from the Estimate card.
    id: 'behaviour',
    label: 'Behaviours',
    group: 3,
    description:
      'Elements that come alive with the room: ask for an estimate or a temperature, leave a comment or an action on the board, collect ideas, check who is done, run a timer, vote or poll, keep an agenda or a decision, throw a reaction, switch a mode, jump through a portal, or bring everyone to look at one spot.',
    icon: <BehaviourTabIcon />,
  },
];
