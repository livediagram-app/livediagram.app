'use client';

// The palette's category catalogue: which categories exist, in band order,
// with the label, blurb and glyph each one wears.
//
// Its own module, holding NO component imports, so anything that needs the list (the mode
// layouts, the whiteboard dock's shape catalogue) can import it without pulling in the category
// bodies, and without the import cycle an earlier dialog reached from inside a body once closed.

import { BoardWidgetArt } from '@/components/plan/plan-tile-art';
import { PlanViewArt } from '@/components/plan/plan-view-art';
import {
  BehaviourTabIcon,
  BuildTabIcon,
  ComponentsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  DrawTabIcon,
  PopularTabIcon,
  IconsTabIcon,
  MediaTabIcon,
  MyShapesTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  WriteTabIcon,
  EventStormingTabIcon,
} from './palette-tab-icons';
import { PlanCardsIcon, PlanIcon } from '@livediagram/ui';

/**
 * The category catalogue's IDENTITY: which categories exist, in band order,
 * with the label, blurb and glyph each one wears. No bodies.
 *
 * Split from `paletteCategoryTabs` because several surfaces need the list and only the palette
 * builds the bodies. A surface that once kept its own copy of the list drifted the moment the
 * palette changed — by the time it was noticed it was offering a Tools category that no longer
 * existed and hiding six that did.
 *
 * Order IS layout: PaletteTabBar renders the dropdown straight from this
 * array, grouping by `group` under the CATEGORY_BANDS headings (0 Common,
 * 1 Structure, 2 Decorate, 3 Dynamic, 4 Plan; Plan mode lists its band first).
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
    // Cards and Boards (docs/specs/025-plan/plan-mode.md "The palette"): Plan mode's own band, offered
    // in Plan mode only, first in the picker, Cards first.
    id: 'plan-cards',
    label: 'Cards',
    group: 4,
    description:
      'A card for one item, by type: project, task, note, idea or action, and any the document adds.',
    icon: <PlanCardsIcon size={18} />,
  },
  {
    id: 'plan-boards',
    label: 'Boards',
    group: 4,
    description:
      'Boards of items to drag through columns: Kanban, sprint, retro, roadmap and more.',
    icon: <PlanIcon size={18} />,
  },
  {
    // A board header's widgets (docs/specs/025-plan/board-widgets.md), after Boards.
    id: 'plan-widgets',
    label: 'Widgets',
    group: 4,
    description:
      'Read-outs and controls for a board’s header: completion, a filter, people and more.',
    icon: <BoardWidgetArt kind="progress" size={18} />,
  },
  {
    // Plan views (docs/specs/025-plan/plan-views.md): the read-out widgets free on the canvas, then charts
    // of every card.
    id: 'plan-metrics',
    label: 'Metrics',
    group: 4,
    description:
      'Live metrics over every card, placed anywhere on the canvas: completion, due soon and more.',
    icon: <BoardWidgetArt kind="count" size={18} />,
  },
  {
    id: 'plan-visualisations',
    label: 'Visualisations',
    group: 4,
    description:
      'Charts of every card: a project Gantt chart, a due calendar, workload by person and more.',
    icon: <PlanViewArt view="gantt" size={18} />,
  },
  {
    // The other elements a team plans beside its boards (docs/specs/025-plan/plan-mode.md "The palette"),
    // the same tiles as their home categories. Offered in Plan mode only, and not card-backed, so they sit
    // under the Common and Dynamic headings rather than Plan's.
    id: 'plan-content',
    label: 'Content',
    group: 0,
    description: 'Sticky notes, text, images and pages to sit beside the boards.',
    icon: <WriteTabIcon />,
  },
  {
    id: 'plan-tools',
    label: 'Tools',
    group: 3,
    description:
      'Facilitation for the team: temperature, estimates, an idea box, a picker and timers.',
    icon: <BehaviourTabIcon />,
  },
  {
    id: 'shapes',
    label: 'Shapes',
    group: 0,
    description: 'Square, circle, diamond, and the flowchart shape vocabulary.',
    icon: <ShapesTabIcon />,
  },
  {
    // My shapes (docs/specs/013-workspace/shape-libraries.md): the owner's imported shape libraries,
    // after Shapes in the Common band; offered only when there is a shape to place.
    id: 'my-shapes',
    label: 'My shapes',
    group: 0,
    description: 'Shapes from your imported libraries, ready to place.',
    icon: <MyShapesTabIcon />,
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
    description: 'The gesture tools: pencil, shape pen, highlighter, polygon, and arrows.',
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
      'Ready-made web components that follow the tab theme: Banner, Callout, Stat row, Process, Hero, and Header. Each is one element that re-flows as you resize it, with every line of text editable in place.',
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
    // Event Storming (docs/specs/021-event-storming/event-storming.md): the workshop notation as a first-class
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
      'Colour emoji for reacting, showing how you feel, marking status, pointing at things, celebrating, and prettying the canvas up.',
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
    // Collaborate, id `behaviour` (docs/specs/010-palette/palette-top-level-categories.md): everything whose content arrives at RUNTIME
    // rather than being drawn by the author — the elements that do something
    // when pressed (docs/specs/009-elements/mode-button.md to docs/specs/012-collaboration/picker.md, docs/specs/009-elements/reaction-pad.md) and the ones that collect
    // what the room thinks (docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md, docs/specs/012-collaboration/comment-pin.md).
    //
    // ONE category, not two. They were split on "pressing this does something
    // to your session" versus "the canvas is collecting an answer from
    // everybody" — a real distinction, and a useless one to navigate by. You
    // reach for both while facilitating, and nothing told a user hunting for
    // the Done check why it lived apart from the Estimate card.
    id: 'behaviour',
    label: 'Collaborate',
    group: 3,
    description:
      'Elements that come alive with the room: ask for an estimate or a temperature, run a quiz, leave a comment or an action on the canvas, collect ideas, rank the room’s questions, check who is done, run a timer or a stopwatch, vote or poll, keep an agenda or a decision, throw a reaction, switch a mode, jump through a portal, or bring everyone to look at one spot.',
    icon: <BehaviourTabIcon />,
  },
];
