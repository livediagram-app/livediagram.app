'use client';

import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { PaletteToolRows } from './PaletteToolRows';
import { PaletteTileGroup } from './PaletteTileGroup';
import {
  AskGroupIcon,
  EmbedGroupIcon,
  FacilitateGroupIcon,
  ModeGroupIcon,
  MoveGroupIcon,
  ReactionGroupIcon,
  RecordGroupIcon,
  SessionGroupIcon,
  WebGroupIcon,
} from './palette-group-icons';
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

// The structural elements (spec/132): Mind node, Lane, Frame, Timeline, Table.
// Rows with a blurb rather than a bare icon grid: these are all "a container
// that holds other work", so the picture alone doesn't separate them — "Tab
// adds a child, Enter a sibling" vs "A titled band that carries its steps" is
// the thing you are choosing between.
export function PaletteBuildTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteToolRows tiles={tilesInSection('build')} actions={actions} pendingDraw={pendingDraw} />
  );
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
// The session tools and the reactions each collapse behind one row, the way
// Media's embed providers do (spec/121). Both are ONE element with a mode
// field, so the palette offers a tile per mode: which tool or which reaction
// you want IS the decision, and a button you place and then go and reconfigure
// is two steps for something you already knew. Flattened out, the eight of
// them would also have buried the four single-purpose Behaviour elements.
export function PaletteBehaviourTab({ pendingDraw, actions }: TabProps) {
  const behaviour = tilesInToolGroup('behaviour');
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteTileGroup
        title="Selection Mode"
        blurb={(n) => `${n} modes to hand somebody`}
        icon={<ModeGroupIcon />}
        tiles={behaviour.filter((t) => t.tileGroup === 'mode')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Run the room"
        blurb={(n) => `${n} things a facilitator drives`}
        icon={<FacilitateGroupIcon />}
        tiles={behaviour.filter((t) => t.tileGroup === 'facilitate')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Get around"
        blurb={(n) => `${n} ways to move yourself about`}
        icon={<MoveGroupIcon />}
        tiles={behaviour.filter((t) => t.tileGroup === 'move')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Session"
        blurb={(n) => `${n} tools the room runs together`}
        icon={<SessionGroupIcon />}
        tiles={behaviour.filter((t) => t.tileGroup === 'session')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Reactions"
        blurb={(n) => `${n} ways to celebrate on the board`}
        icon={<ReactionGroupIcon />}
        tiles={behaviour.filter((t) => t.tileGroup === 'reaction')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
    </div>
  );
}

// The elements that collect what the ROOM thinks (spec/123 to spec/129):
// estimate cards, temperature checks, idea boxes, agendas, decision records
// and roll calls. Rows, not a tile grid, for the same reason Behaviour is: a
// glyph cannot distinguish "everyone answers privately then all at once" from
// "everyone answers and you watch it move", and that IS the choice.
// Grouped by what the element DOES with the room rather than by what it looks
// like: three that ask everybody a question and collect the answers, three that
// write down what the room decided. The comment panel stays loose above them —
// it is the one people reach for outside a facilitated session.
export function PaletteCollaborateTab({ pendingDraw, actions }: TabProps) {
  const collab = tilesInSection('collaborate');
  return (
    <div className="flex flex-col gap-0.5">
      <PaletteToolRows
        tiles={collab.filter((t) => !t.tileGroup)}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Ask the room"
        blurb={(n) => `${n} ways to collect an answer from everybody`}
        icon={<AskGroupIcon />}
        tiles={collab.filter((t) => t.tileGroup === 'ask')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
      <PaletteTileGroup
        title="Keep a record"
        blurb={(n) => `${n} ways to write down what happened`}
        icon={<RecordGroupIcon />}
        tiles={collab.filter((t) => t.tileGroup === 'record')}
        actions={actions}
        pendingDraw={pendingDraw}
      />
    </div>
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
        blurb={(n) => `${n} ways to load a page on the canvas`}
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
