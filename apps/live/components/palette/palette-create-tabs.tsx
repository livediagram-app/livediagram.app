'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteTileGroup } from './PaletteTileGroup';
import { PaletteGroupBrowser, type TileGroupDef } from './PaletteGroupBrowser';
import {
  AskGroupIcon,
  EmbedGroupIcon,
  FacilitateGroupIcon,
  ModeGroupIcon,
  MoveGroupIcon,
  ReactionGroupIcon,
  RecordGroupIcon,
  WebGroupIcon,
} from './palette-group-icons';
import type { PaletteTileDef } from './palette-tile-defs';
import { EventStormingBoardRows, type EsBoardControls } from './EventStormingBoardRows';

// The palette's creation-category tab bodies. Since docs/specs/010-palette/palette-favourites.md every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid. Each body is how its category is PRESENTED (a grid, rows with a
// blurb, a group browser); which tiles it holds is the mode's palette layout's call
// (palette-layouts.ts, docs/specs/007-editor/editor-modes.md "The palette per mode"), handed in
// as `tiles`. The
// search-driven tabs (Icons / Technology) stay in CommandPalette since they
// own their search state; the Favourites tab (docs/specs/010-palette/palette-favourites.md) has its own file
// (PaletteFavouritesTab).
//
// There is no longer a Tools tab (docs/specs/010-palette/palette-top-level-categories.md): every group it held graduated to
// a top-level category, and a tab with no categories left is not a tab.

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
  // The category's tiles in this mode, in order (palette-layouts).
  tiles: PaletteTileDef[];
};

export function PaletteShapesTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteTileGrid tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// The structural elements (docs/specs/010-palette/build-category.md): Mind node, Lane, Frame, Timeline, Table.
// Rows with a blurb rather than a bare icon grid: these are all "a container
// that holds other work", so the picture alone doesn't separate them — "Tab
// adds a child, Enter a sibling" vs "A titled band that carries its steps" is
// the thing you are choosing between.
export function PaletteBuildTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// The wordy elements (docs/specs/010-palette/palette-top-level-categories.md): Page, Text, Sticky Note, Annotation.
export function PaletteWriteTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// The Event Storming notation (docs/specs/021-event-storming/event-storming.md): one coloured-sticky tile per note
// kind of the workshop grammar, in workshop order. Rows with a blurb, like
// Behaviour and Data — eight identical squares in different colours don't
// explain themselves; "Something that happened, past tense" against "An
// intent that triggers an event" is the actual choice.
export function PaletteEventStormingTab({
  pendingDraw,
  actions,
  tiles,
  board,
}: TabProps & { board?: EsBoardControls }) {
  return (
    <>
      {/* Board-level switches first (docs/specs/021-event-storming/event-storming.md Phase 6), then the notation.
          Absent on every other tab, where they would control nothing. */}
      {board ? <EventStormingBoardRows controls={board} /> : null}
      <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />
    </>
  );
}

// The gesture tools (docs/specs/010-palette/palette-top-level-categories.md): the three pens, Polygon, Arrow, Line. Separate
// from Write because these are things you pick up and drag, not things you
// drop and type into.
export function PaletteDrawTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// Charts, meters and tables (docs/specs/009-elements/pie-chart.md, docs/specs/010-palette/palette-top-level-categories.md): pie / bar / line charts,
// progress bars and rings, ratings, and the editable grid. Rows with a blurb,
// like Behaviour: "Pie" and "Donut" name the picture but not the job, and
// "Proportions of a whole" vs "How far along something is" is the thing you
// are actually choosing between.
export function PaletteDataTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// Every element whose content arrives at RUNTIME (docs/specs/010-palette/palette-top-level-categories.md): the ones that do
// something when pressed and the ones that collect what the room thinks.
//
// Browsed by category rather than stacked as accordions (docs/specs/008-canvas/canvas-and-palette.md
// "Sub-categories"): a column of collapsed headers meant you saw a table of
// contents where the palette otherwise shows you pictures, and nothing in the
// tab was visible until you opened one. Same navigation as Icons and
// Technology, from the same component — see PaletteGroupBrowser.
//
// Ordered room-first: the groups a facilitator opens mid-session come before
// the ones you set up once and forget. Collaborate used to be a separate
// category (Ask / Record); merging it in is docs/specs/010-palette/palette-top-level-categories.md's
// reconciliation, which docs/specs/012-collaboration/done-check.md called ahead of time when it filed the Done
// check under Behaviour and said so.
//
// There is no **Session** group. It held the Timer, the Dot vote and the Poll
// — a group named after the machinery rather than the job. A poll and a dot
// vote ARE asking the room, so they sit with the estimate card and the
// temperature check, which is where somebody looking to put a question to
// everybody actually looks. A timer is facilitation, so it sits with the
// Reveal, the Done check and the Picker. With all three rehoused the group had
// nothing left in it.
export const BEHAVIOUR_GROUPS: TileGroupDef[] = [
  {
    id: 'ask',
    label: 'Ask',
    icon: <AskGroupIcon />,
  },
  {
    id: 'facilitate',
    label: 'Tools',
    icon: <FacilitateGroupIcon />,
  },
  {
    id: 'record',
    label: 'Record',
    icon: <RecordGroupIcon />,
  },
  {
    id: 'reaction',
    label: 'React',
    icon: <ReactionGroupIcon />,
  },
  { id: 'mode', label: 'Selection Mode', icon: <ModeGroupIcon /> },
  { id: 'move', label: 'Navigate', icon: <MoveGroupIcon /> },
];

export function PaletteBehaviourTab({ pendingDraw, actions, tiles }: TabProps) {
  // Every tile is in a group. The comment pin used to sit loose above them,
  // on the reasoning that it is the one you reach for outside a facilitated
  // session and a group of one would be a click in front of the tab's
  // most-used tile. It is in **Record** now: a comment thread is a
  // thing you leave behind on the canvas for somebody to find later, which is
  // what the agenda, the decision record and the roll call all are, and a
  // single row floating above six category tiles read as an oversight.
  return (
    <PaletteGroupBrowser
      root="Collaborate"
      tiles={tiles}
      groups={BEHAVIOUR_GROUPS}
      actions={actions}
      pendingDraw={pendingDraw}
      searchInput={{
        placeholder: 'Search collaboration',
        ariaLabel: 'Search collaborate elements',
        clearAriaLabel: 'Clear collaborate search',
        clearDescription: 'Clear the collaborate element search query.',
      }}
      telemetry={{ openedType: 'BehaviourGroup', searchedType: 'BehaviourSearch' }}
      emptyMessage={(q) => `No behaviours match \u201c${q}\u201d.`}
    />
  );
}

// Pictures and figures (docs/specs/010-palette/palette-top-level-categories.md): Image and Avatar. Rows with a blurb — two
// picture frames look near-identical at 18px, and "an uploaded picture" vs "a
// picture cropped to a circle" is the whole difference.
export function PaletteMediaTab({ pendingDraw, actions, tiles: media }: TabProps) {
  // The embed providers collapse behind one row (docs/specs/009-elements/embed-providers.md); Media's own two
  // elements stay on top where they were.
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteToolRows
        tiles={media.filter((t) => !t.tileGroup)}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      {/* A layout that leaves the whole group out leaves its row out too. */}
      {media.some((t) => t.tileGroup === 'embed') ? (
        <PaletteTileGroup
          title="Embed"
          blurb="Load a page on the canvas"
          icon={<EmbedGroupIcon />}
          tiles={media.filter((t) => t.tileGroup === 'embed')}
          actions={actions}
          pendingDraw={pendingDraw}
        />
      ) : null}
    </div>
  );
}

// The website composites (Banner, Hero, Header, Callout, Stat row, Process)
// collapse behind one Web Elements row, the same way Media's embeds do: they
// are six of the eleven tiles here and were crowding out the diagram content
// that moved in beside them (docs/specs/010-palette/palette-top-level-categories.md).
export function PaletteComponentsTab({ pendingDraw, actions, tiles: components }: TabProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteToolRows
        tiles={components.filter((t) => !t.tileGroup)}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      {/* A layout that leaves the whole group out leaves its row out too. */}
      {components.some((t) => t.tileGroup === 'web') ? (
        <PaletteTileGroup
          title="Web Elements"
          blurb="Themed page sections"
          icon={<WebGroupIcon />}
          tiles={components.filter((t) => t.tileGroup === 'web')}
          actions={actions}
          pendingDraw={pendingDraw}
        />
      ) : null}
    </div>
  );
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see docs/specs/008-canvas/canvas-and-palette.md "Devices". Rows with a blurb: the frames
// are six grey rectangles of slightly different proportions, so the name and
// what it is for do the work the outline cannot.
export function DevicePickerTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}
