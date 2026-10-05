// The Plan category's tiles (docs/specs/025-plan/plan-mode.md "The palette"): a board per preset, a
// card per item type. Made from the presets and the item-type catalogue, so a new preset or type is a
// tile with no edit here. Spread into PALETTE_TILES.
import {
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  type ItemTypeDef,
  type PlanBoardPresetId,
} from '@livediagram/items';
import { PlanBoardTileArt, PlanCardTileArt } from '@/components/plan/plan-tile-art';
import type { PaletteTileDef } from './palette-tile-defs';

const GLYPH_PX = 18;

// The boards the palette offers, in the order they are reached for, with what each is for.
const BOARDS: { preset: PlanBoardPresetId; caption: string; description: string }[] = [
  {
    preset: 'kanban',
    caption: 'Kanban',
    description: 'A Kanban Board: Backlog to Done, with WIP limits on the busy columns.',
  },
  {
    preset: 'sprint',
    caption: 'Sprint',
    description: 'A Sprint Board of Tasks, a row per person and estimates on every card.',
  },
  {
    preset: 'retro',
    caption: 'Retro',
    description: 'A Retro Board: Notes stay hidden until you reveal them, then everyone votes.',
  },
  {
    preset: 'roadmap',
    caption: 'Roadmap',
    description: 'Projects on Now, Next and Later.',
  },
  {
    preset: 'bug-triage',
    caption: 'Bug Triage',
    description: 'Tasks labelled bug, from New to Fixed, a row per priority.',
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
    section: 'plan-boards',
    label: `Add ${PLAN_BOARD_PRESETS[b.preset].label}`,
    caption: b.caption,
    description: b.description,
    action: { type: 'shape', kind: 'plan-board', plan: b.preset },
    icon: <PlanBoardTileArt size={GLYPH_PX} preset={b.preset} />,
  })),
  ...ITEM_TYPES.map(planCardTile),
];

// A card tile for an item type (docs/specs/025-plan/item-types.md "Where types show"): the built-in
// ones above, and the Cards category's tiles for a document's own catalogue.
export function planCardTile(t: ItemTypeDef): PaletteTileDef {
  return {
    id: `plan:card-${t.id}`,
    section: 'plan-cards',
    label: `Add ${t.label} Card`,
    caption: `${t.label} Card`,
    description: `A new ${t.label}, dragged into a column on a board.`,
    noTint: true,
    action: { type: 'shape', kind: 'plan-card', plan: t.id },
    icon: <PlanCardTileArt size={GLYPH_PX} color={t.color} />,
  };
}
