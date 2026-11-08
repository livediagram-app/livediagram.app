'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import type { PaletteTileDef } from './palette-tile-defs';

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

// The wordy elements (docs/specs/010-palette/palette-top-level-categories.md): Text, Sticky Note, Annotation.
export function PaletteWriteTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// The gesture tools (docs/specs/010-palette/palette-top-level-categories.md): the three pens, Polygon, Arrow, Line. Separate
// from Write because these are things you pick up and drag, not things you
// drop and type into.
export function PaletteDrawTab({ pendingDraw, actions, tiles }: TabProps) {
  return <PaletteToolRows tiles={tiles} actions={actions} pendingDraw={pendingDraw} />;
}

// The Collaborate elements (docs/specs/012-collaboration/workshop-mode.md "The palette"): six
// categories, one per group (Ask, Tools, Record, React, Selection Mode, Navigate). Rows with a blurb:
// mode buttons look alike at palette size, and
// the line under each is the choice being made.
//
// They were once one category with a group browser inside it. In Workshop every group is
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
    </div>
  );
}
