'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteTileGroup } from './PaletteTileGroup';
import { EmbedGroupIcon, WebGroupIcon } from './palette-group-icons';
import type { PaletteTileDef } from './palette-tile-defs';
import { EventStormingBoardRows, type EsBoardControls } from './EventStormingBoardRows';

// The palette's creation-category tab bodies. Every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid. Each body is how its category is PRESENTED (a grid, rows with a
// blurb, collapsed groups); which tiles it holds is the mode's palette layout's call
// (palette-layouts.ts, docs/specs/007-editor/editor-modes.md "The palette per mode"), handed in
// as `tiles`. The
// search-driven tabs (Icons / Stickers / Technology) have their own files since they
// own their search state.
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

// The Collaborate elements (docs/specs/012-collaboration/facilitate-mode.md "The palette"): six
// categories, one per group (Ask, Tools, Record, React, Selection Mode, Navigate). Rows with a blurb,
// like Build and Data: eight mode buttons or five reaction pads look alike at palette size, and
// "Hand everyone the laser" against "Hand everyone the spotlight" is the choice being made.
//
// They were once one category with a group browser inside it. In Facilitate every group is
// something a facilitator reaches for mid-session, so the parent was a click in front of each.
export function PaletteCollaborateTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
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
