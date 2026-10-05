// The Plan category's tiles (docs/specs/025-plan/plan-mode.md "The palette"): a board per preset, a
// card per item type. Made from the presets and the item-type catalogue, so a new preset or type is a
// tile with no edit here. Spread into PALETTE_TILES.
import { ITEM_TYPES, PLAN_BOARD_PRESETS, type PlanBoardPresetId } from '@livediagram/items';
import { PlanBoardTileArt, PlanCardTileArt } from '@/components/plan/plan-tile-art';
import type { PaletteTileDef } from './palette-tile-defs';

const GLYPH_PX = 18;

// The boards the palette offers, in the order they are reached for, with what each is for.
const BOARDS: { preset: PlanBoardPresetId; caption: string; description: string }[] = [
  {
    preset: 'kanban',
    caption: 'Kanban',
    description: 'A Kanban board: Backlog to Done, with WIP limits on the busy columns.',
  },
  {
    preset: 'sprint',
    caption: 'Sprint',
    description: 'A sprint board with a row per person and estimates on every card.',
  },
  {
    preset: 'retro',
    caption: 'Retro',
    description: 'A retro: notes stay hidden until you reveal them, then everyone votes.',
  },
  {
    preset: 'roadmap',
    caption: 'Roadmap',
    description: 'Epics on Now, Next and Later.',
  },
  {
    preset: 'bug-triage',
    caption: 'Bug triage',
    description: 'Bugs from New to Fixed, a row per priority.',
  },
  {
    preset: 'weekly',
    caption: 'Week',
    description: 'A column a day, Monday to Friday.',
  },
  {
    preset: 'blank',
    caption: 'Board',
    description: 'A board of To do, In progress and Done, to make your own.',
  },
];

export const PLAN_TILES: PaletteTileDef[] = [
  ...BOARDS.map((b): PaletteTileDef => ({
    id: `plan:board-${b.preset}`,
    section: 'plan',
    label: `Add ${PLAN_BOARD_PRESETS[b.preset].label.toLowerCase()}`,
    caption: b.caption,
    description: b.description,
    action: { type: 'shape', kind: 'plan-board', plan: b.preset },
    icon: (
      <PlanBoardTileArt
        size={GLYPH_PX}
        columns={PLAN_BOARD_PRESETS[b.preset].setup.columns.length}
      />
    ),
  })),
  ...ITEM_TYPES.map((t): PaletteTileDef => ({
    id: `plan:card-${t.id}`,
    section: 'plan',
    label: `Add ${t.label.toLowerCase()} card`,
    caption: t.label,
    description: `A new ${t.label.toLowerCase()} on its own card, anywhere on the canvas. Drag it onto a board to file it.`,
    noTint: true,
    action: { type: 'shape', kind: 'plan-card', plan: t.id },
    icon: <PlanCardTileArt size={GLYPH_PX} color={t.color} />,
  })),
];
