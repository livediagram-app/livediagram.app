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

// Every element whose content arrives at RUNTIME (spec/110): the ones that do
// something when pressed and the ones that collect what the room thinks.
//
// Browsed by category rather than stacked as accordions (spec/09
// "Sub-categories"): a column of collapsed headers meant you saw a table of
// contents where the palette otherwise shows you pictures, and nothing in the
// tab was visible until you opened one. Same navigation as Icons and
// Technology, from the same component — see PaletteGroupBrowser.
//
// Ordered room-first: the groups a facilitator opens mid-session come before
// the ones you set up once and forget. Collaborate used to be a separate
// category (Ask the room / Keep a record); merging it in is spec/110's
// reconciliation, which spec/137 called ahead of time when it filed the Done
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
    label: 'Ask the room',
    icon: <AskGroupIcon />,
  },
  {
    id: 'facilitate',
    label: 'Run the room',
    icon: <FacilitateGroupIcon />,
  },
  {
    id: 'record',
    label: 'Keep a record',
    icon: <RecordGroupIcon />,
  },
  {
    id: 'reaction',
    label: 'Reactions',
    icon: <ReactionGroupIcon />,
  },
  { id: 'mode', label: 'Selection Mode', icon: <ModeGroupIcon /> },
  { id: 'move', label: 'Get around', icon: <MoveGroupIcon /> },
];

export function PaletteBehaviourTab({ pendingDraw, actions }: TabProps) {
  const tiles = tilesInToolGroup('behaviour');
  // The comment pin sits ABOVE the groups rather than inside one. It is the
  // element people reach for outside a facilitated session entirely, and a
  // group of one would be a click in front of the tab's most-used tile.
  const loose = tiles.filter((t) => !t.tileGroup);
  return (
    <PaletteGroupBrowser
      root="Behaviours"
      tiles={tiles}
      groups={BEHAVIOUR_GROUPS}
      actions={actions}
      pendingDraw={pendingDraw}
      leadIn={
        loose.length > 0 ? (
          <div className="mb-2">
            <PaletteToolRows tiles={loose} actions={actions} pendingDraw={pendingDraw} />
          </div>
        ) : undefined
      }
      searchInput={{
        placeholder: 'Search behaviours',
        ariaLabel: 'Search behaviour elements',
        clearAriaLabel: 'Clear behaviour search',
        clearDescription: 'Clear the behaviour element search query.',
      }}
      telemetry={{ openedType: 'BehaviourGroup', searchedType: 'BehaviourSearch' }}
      emptyMessage={(q) => `No behaviours match \u201c${q}\u201d.`}
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
        blurb="Load a page on the canvas"
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
        blurb="Themed page sections"
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
