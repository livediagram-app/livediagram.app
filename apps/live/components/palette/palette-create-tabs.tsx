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
// zones, Pickers, Reaction pads.
//
// Browsed by category rather than stacked as accordions (spec/09
// "Sub-categories"): five collapsed headers meant you saw a table of contents
// where the palette otherwise shows you pictures, and nothing in the tab was
// visible until you opened one. Same navigation as Icons and Technology, from
// the same component — see PaletteGroupBrowser.
export const BEHAVIOUR_GROUPS: TileGroupDef[] = [
  { id: 'mode', label: 'Selection Mode', icon: <ModeGroupIcon /> },
  {
    id: 'facilitate',
    label: 'Run the room',
    icon: <FacilitateGroupIcon />,
  },
  { id: 'move', label: 'Get around', icon: <MoveGroupIcon /> },
  {
    id: 'session',
    label: 'Session',
    icon: <SessionGroupIcon />,
  },
  {
    id: 'reaction',
    label: 'Reactions',
    icon: <ReactionGroupIcon />,
  },
];

export function PaletteBehaviourTab({ pendingDraw, actions }: TabProps) {
  return (
    <PaletteGroupBrowser
      root="Behaviour"
      tiles={tilesInToolGroup('behaviour')}
      groups={BEHAVIOUR_GROUPS}
      actions={actions}
      pendingDraw={pendingDraw}
      searchInput={{
        placeholder: 'Search behaviour',
        ariaLabel: 'Search behaviour elements',
        clearAriaLabel: 'Clear behaviour search',
        clearDescription: 'Clear the behaviour element search query.',
      }}
      telemetry={{ openedType: 'BehaviourGroup', searchedType: 'BehaviourSearch' }}
      emptyMessage={(q) => `No behaviour elements match \u201c${q}\u201d.`}
    />
  );
}

// The elements that collect what the ROOM thinks (spec/123 to spec/129):
// estimate cards, temperature checks, idea boxes, agendas, decision records
// and roll calls. Grouped by what the element DOES with the room rather than
// by what it looks like: the ones that ask everybody a question and collect
// the answers, and the ones that write down what the room decided.
//
// The comment panel stays ABOVE the categories rather than inside one. It is
// the element people reach for outside a facilitated session entirely, and a
// category of one would be a click in front of the tab's most-used tile.
export const COLLABORATE_GROUPS: TileGroupDef[] = [
  {
    id: 'ask',
    label: 'Ask the room',
    icon: <AskGroupIcon />,
  },
  {
    id: 'record',
    label: 'Keep a record',
    icon: <RecordGroupIcon />,
  },
];

export function PaletteCollaborateTab({ pendingDraw, actions }: TabProps) {
  const collab = tilesInSection('collaborate');
  const loose = collab.filter((t) => !t.tileGroup);
  return (
    <PaletteGroupBrowser
      root="Collaborate"
      tiles={collab}
      groups={COLLABORATE_GROUPS}
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
        placeholder: 'Search collaborate',
        ariaLabel: 'Search collaborate elements',
        clearAriaLabel: 'Clear collaborate search',
        clearDescription: 'Clear the collaborate element search query.',
      }}
      telemetry={{ openedType: 'CollabGroup', searchedType: 'CollabSearch' }}
      emptyMessage={(q) => `No collaborate elements match \u201c${q}\u201d.`}
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
