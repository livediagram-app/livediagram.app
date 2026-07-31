'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteTileGroup } from './PaletteTileGroup';
import { EmbedGroupIcon, WebGroupIcon } from './palette-group-icons';
import { tilesInSection, tilesInToolGroup } from './palette-tile-defs';

// The palette's creation-category tab bodies. Since spec/78 every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid, so each tab is just its catalogue slice — the
// per-tile JSX that used to live here moved into the catalogue. The
// search-driven tabs (Icons / Technology) stay in CommandPalette since they
// own their search state; the Favourites tab (spec/78) has its own file
// (PaletteFavouritesTab).
//
// There is no longer a Tools tab (spec/110): every group it held graduated to
// a top-level category, and a tab with no categories left is not a tab.

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
};

export function PaletteShapesTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="shapes" actions={actions} pendingDraw={pendingDraw} />;
}

// The wordy elements (spec/110): Page, Text, Sticky Note, Annotation.
export function PaletteWriteTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInToolGroup('write')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}

// The gesture tools (spec/110): Pencil, Highlighter, Polygon, Arrow. Separate
// from Write because these are things you pick up and drag, not things you
// drop and type into.
export function PaletteDrawTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows tiles={tilesInToolGroup('draw')} actions={actions} pendingDraw={pendingDraw} />
  );
}

// Charts, meters and tables (spec/53, spec/110): pie / bar / line charts,
// progress bars and rings, ratings, and the editable grid. Rows with a blurb,
// like Behaviour: "Pie" and "Donut" name the picture but not the job, and
// "Proportions of a whole" vs "How far along something is" is the thing you
// are actually choosing between.
export function PaletteDataTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows tiles={tilesInSection('data')} actions={actions} pendingDraw={pendingDraw} />
  );
}

// The elements that DO something when somebody interacts with them (spec/103
// to spec/107): Selection Mode buttons, Portals, Session buttons, Reveal
// zones, Pickers. Rows, not a tile grid: half of these are behaviours whose
// glyph cannot say what they do, so each keeps its one-line blurb.
export function PaletteBehaviourTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInToolGroup('behaviour')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}

// The elements that collect what the ROOM thinks (spec/123 to spec/129):
// estimate cards, temperature checks, idea boxes, agendas, decision records
// and roll calls. Rows, not a tile grid, for the same reason Behaviour is: a
// glyph cannot distinguish "everyone answers privately then all at once" from
// "everyone answers and you watch it move", and that IS the choice.
export function PaletteCollaborateTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInSection('collaborate')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}

// Pictures and figures (spec/110): Image and Avatar. Rows with a blurb — two
// picture frames look near-identical at 18px, and "an uploaded picture" vs "a
// picture cropped to a circle" is the whole difference.
export function PaletteMediaTab({ pendingDraw, actions }: TabProps) {
  // The embed providers collapse behind one row (spec/121); Media's own two
  // elements stay on top where they were.
  const media = tilesInSection('media');
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteToolRows
        tiles={media.filter((t) => !t.tileGroup)}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Embed"
        blurb={(n) => `${n} services that play on the canvas`}
        icon={<EmbedGroupIcon />}
        tiles={media.filter((t) => t.tileGroup === 'embed')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
    </div>
  );
}

// The website composites (Banner, Hero, Header, Callout, Stat row, Process)
// collapse behind one Web Elements row, the same way Media's embeds do: they
// are six of the eleven tiles here and were crowding out the diagram content
// that moved in beside them (spec/110).
export function PaletteComponentsTab({ pendingDraw, actions }: TabProps) {
  const components = tilesInSection('components');
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteToolRows
        tiles={components.filter((t) => !t.tileGroup)}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Web Elements"
        blurb={(n) => `${n} themed page sections`}
        icon={<WebGroupIcon />}
        tiles={components.filter((t) => t.tileGroup === 'web')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
    </div>
  );
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see spec/09 "Devices". Rows with a blurb: the frames
// are six grey rectangles of slightly different proportions, so the name and
// what it is for do the work the outline cannot.
export function DevicePickerTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows
      tiles={tilesInSection('devices')}
      actions={actions}
      pendingDraw={pendingDraw}
    />
  );
}
