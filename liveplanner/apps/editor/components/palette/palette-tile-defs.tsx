import {} from '@liveplanner/project';

import type { SessionTool, ShapeKind } from '@liveplanner/project';
import {
  PickerIcon,
  TemperatureIcon,
  StopwatchIcon,
  TimerIcon,
} from '@/components/palette/palette-icons';
import { lucideStickyNote, lucideType } from '@liveplanner/icons/lucide';
import { Glyph, Prims } from '@liveplanner/ui';
import { PLAN_TILES } from './palette-plan-tiles';

// Every palette tile glyph is drawn at this size (docs/specs/004-interface-design/iconography.md), so a strip of
// tiles reads as one set.
export const TILE_GLYPH_PX = 18;

// Lucide's sticky-note as its two paths: the note body takes the paper fill, the corner fold does not.
const pathD = (i: number) => {
  const p = lucideStickyNote[i];
  if (p?.t !== 'path') throw new Error('lucideStickyNote: expected a path');
  return p.d;
};
const lucideStickyNotePaths = { body: pathD(0), fold: pathD(1) };

// The shared palette tile catalogue: every creation tile across the categories as one data
// entry — label, glyph, tinting flags, and an action descriptor the
// editor's add-handlers act on. Every category body, Popular, the Toolbar strip and the Search panel
// render from this one catalogue (arranged per mode by palette-layouts.ts), so a tile is defined
// once and can never drift between the places it shows.
//
// Pure data: a flat catalogue, exempt from the file-size target (see
// AGENTS.md) — extend it in place rather than splitting it.

export type PaletteTileSection =
  // Plan's Boards and Cards (docs/specs/026-plan/plan-mode.md "The palette"): boards by preset, cards by item type.
  | 'plan-boards'
  | 'plan-cards'
  // Plan views (docs/specs/026-plan/plan-views.md): metrics and visualisations.
  | 'plan-metrics'
  | 'plan-visualisations'
  // A Dashboard's rows and slots (docs/specs/026-plan/plan-tabs.md), on a Dashboard tab alone.
  | 'dashboard-layout'
  | 'dashboard-tabs'
  // A Dashboard's written cards (Status, Checklist, Key Date, Links), on a Dashboard tab alone.
  | 'dashboard-cards'
  | 'plan-sheets'
  // The few other elements a team plans beside its boards: a sticky, text, a page, the session tools.
  | 'tools';

// What clicking (or drag-dropping) the tile does. 'shape' descriptors also
// drive the tile's drag-to-place payload + pending-draw highlight; the
// singleton tools map one-to-one onto the editor's add-handlers.
type PaletteTileAction =
  // `session` is a creation-time choice, not a separate kind: the element is ONE kind with a tool field, and
  // the palette offers a tile per tool (docs/specs/012-collaboration/session-button.md).
  | {
      type: 'shape';
      kind: ShapeKind;
      session?: SessionTool;
      // Plan board preset, or a Plan card's item type (docs/specs/026-plan/plan-mode.md "The palette").
      plan?: string;
      // A creation-time variant of the kind (packages/project shape-variants.ts).
      variant?: string;
    }
  | { type: 'text' }
  | { type: 'sticky' };

export type PaletteTileDef = {
  // Stable id: the Search panel and the dashboard's slot picker address tiles by it, so renaming one means renaming
  // it there too.
  id: string;
  section: PaletteTileSection;
  label: string;
  // Overrides the caption derived from `label` where that runs too long
  // for the tile (see IconButton).
  caption?: string;
  description: string;
  // A short line rendered UNDER the tile in list layouts (the Tools tab).
  // Separate from `description`, which is the fuller hover card / search text:
  // this one has to fit a palette-width row, so it is a clause, not a
  // sentence, and it says what the tool IS rather than how to use it.
  blurb?: string;
  icon: React.ReactNode;
  shortcut?: string;
  // IconButton flags (docs/specs/008-canvas/canvas-and-palette.md theme tinting): `filled` tiles preview the
  // theme's element fill; `noTint` tiles keep fixed colours.
  filled?: boolean;
  noTint?: boolean;
  // Greyed out with its reason (no press, no drag, the reason in its hover card). A card tile no board on the tab
  // takes gets one at render (usePlanCardTileDisabled, docs/specs/026-plan/plan-mode.md "The palette").
  disabled?: { reason: string };
  action: PaletteTileAction;
};

export const PALETTE_TILES: PaletteTileDef[] = [
  {
    // Page (docs/specs/009-elements/page-element.md). Sits first in Write: it is the largest writing
    // surface, and the group reads shortest-to-longest from there. Called
    // Page, not Project, so the palette and the selection toolbar agree —
    // and so it never collides with the Shapes tab's flowchart "document".
    id: 'tools:page',
    blurb: 'A paper-shaped page for prose',
    section: 'tools',
    label: 'Add Page',
    caption: 'Page',
    description: 'A paper-sized surface for rich text. Double-click to write.',
    action: { type: 'shape', kind: 'page' },
    icon: (
      <Glyph size={18} units={18}>
        <rect x="3.5" y="1.5" width="11" height="15" rx="1.5" />
        <path d="M6 5.5h6M6 8.5h6M6 11.5h3.5" />
      </Glyph>
    ),
  },
  {
    id: 'tools:text',
    blurb: 'A free-standing text label',
    section: 'tools',
    label: 'Add Text',
    description: 'Text element. Double-click to edit.',
    shortcut: 'T',
    action: { type: 'text' },
    icon: (
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <Prims prims={lucideType} />
      </Glyph>
    ),
  },
  {
    id: 'tools:sticky',
    blurb: 'A coloured note card',
    section: 'tools',
    label: 'Add Sticky Note',
    caption: 'Note',
    description: 'Sticky note for short annotations.',
    shortcut: 'N',
    noTint: true,
    action: { type: 'sticky' },
    icon: (
      // The note keeps its paper colour (noTint): Lucide sticky-note, body filled.
      <Glyph size={TILE_GLYPH_PX} units={24}>
        <path d={lucideStickyNotePaths.body} fill="rgb(254 243 199)" />
        <path d={lucideStickyNotePaths.fold} />
      </Glyph>
    ),
  },
  {
    // Session tools (docs/specs/012-collaboration/session-button.md): one tile per tool, grouped, rather than one
    // button you place and then reconfigure. The tools have nothing in common
    // at the moment of choosing — you know whether you want a countdown or a
    // vote before you reach for the palette.
    id: 'tools:session-timer',
    blurb: 'A countdown everyone can see',
    caption: 'Timer',
    section: 'tools',
    label: 'Add Timer Button',
    description:
      'A button that starts a countdown for everyone in the room. Pressing it again pauses, and again continues. Set the minutes from its right-click menu.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'timer' },
    icon: <TimerIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'tools:session-stopwatch',
    blurb: 'Counts up from zero',
    caption: 'Stopwatch',
    section: 'tools',
    label: 'Add Stopwatch Button',
    description:
      'A button that starts a stopwatch for everyone in the room, counting up from zero. Pressing it again pauses, and again continues. Nothing to set: a stopwatch has no length.',
    filled: true,
    action: { type: 'shape', kind: 'session-button', session: 'stopwatch' },
    icon: <StopwatchIcon size={TILE_GLYPH_PX} />,
  },
  {
    // Picker (docs/specs/012-collaboration/picker.md): rolls a person or a written option.
    id: 'tools:picker',
    blurb: 'Pick someone at random',
    section: 'tools',
    label: 'Add Picker',
    caption: 'Picker',
    description:
      'Press it to choose at random: one of the people in the room, or one of the options you write on it.',
    filled: true,
    action: { type: 'shape', kind: 'picker' },
    icon: <PickerIcon size={TILE_GLYPH_PX} />,
  },
  {
    id: 'collab:temperature',
    blurb: 'Fist of five: how does the room feel?',
    section: 'tools',
    label: 'Add Temperature Check',
    caption: 'Temperature',
    description:
      'A fist-of-five gauge. Everyone registers 1 to 5 and the bars and average move as the answers land.',
    filled: true,
    action: { type: 'shape', kind: 'temperature' },
    icon: <TemperatureIcon size={TILE_GLYPH_PX} />,
  },
  // Plan (docs/specs/026-plan/plan-mode.md): boards by preset, cards by item type.
  ...PLAN_TILES,
];

export function tileById(id: string): PaletteTileDef | undefined {
  return PALETTE_TILES.find((t) => t.id === id);
}

/** A Plan category's tiles: the ones of that section, in catalogue order. */
export function tilesForCategory(categoryId: PaletteTileSection): PaletteTileDef[] {
  return PALETTE_TILES.filter((t) => t.section === categoryId);
}
