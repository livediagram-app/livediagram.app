// The Plan category's tiles (docs/specs/026-plan/plan-mode.md "The palette"): a board per preset, a
// card per item type, and a widget per board widget kind. Made from the presets and the item-type catalogue, so a new preset or type is a
// tile with no edit here. Spread into PALETTE_TILES.
import {
  BOARD_WIDGET_KINDS,
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  type ItemTypeDef,
  type PlanBoardPresetId,
} from '@livediagram/items';
import { BoardWidgetArt, PlanBoardTileArt, PlanCardTileArt } from '@/components/plan/plan-tile-art';
import { BOARD_WIDGET_INFO } from '@/components/plan/board-widget-catalogue';
import type { PaletteTileDef } from './palette-tile-defs';
import { PLAN_VIEW_TILES } from './palette-plan-view-tiles';

const GLYPH_PX = 18;
// The one larger tile step (docs/specs/004-interface-design/iconography.md): a Plan card tile is a picture of a card with its type's glyph on the face, drawn bigger to
// fill its tile and keep that glyph legible; 26 still fits the Rows layout's 28px chip.
export const CARD_TILE_GLYPH_PX = 26;

// The boards the palette offers, in the order they are reached for, with what each is for. One list for the palette's
// Boards and Start with a Board; All Cards is always last (docs/specs/026-plan/plan-mode.md "Starting a board").
export const PLAN_BOARD_TILES: {
  preset: PlanBoardPresetId;
  caption: string;
  description: string;
}[] = [
  {
    preset: 'blank',
    caption: 'Board',
    description: 'An empty board: name its first column and build it your way.',
  },
  {
    preset: 'kanban',
    caption: 'Kanban',
    description:
      'A Kanban Board of Tasks and Actions: Backlog to Done, with WIP limits on the busy columns.',
  },
  {
    preset: 'todo',
    caption: 'To-do List',
    description: 'Actions to tick off, from To Do to Done.',
  },
  {
    preset: 'sprint',
    caption: 'Sprint',
    description:
      'A Sprint Board of Stories, Tasks and Bugs, a row per person and estimates on every card.',
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
    description: 'Bugs from New to Fixed, a row per priority.',
  },
  {
    preset: 'weekly',
    caption: 'Week',
    description: 'A column a day, Monday to Friday.',
  },
  {
    preset: 'archive',
    caption: 'Archive',
    description: 'Every archived card, out of the way of the other boards, ready to restore.',
  },
  {
    preset: 'all-cards',
    caption: 'All Cards',
    description: 'Every card in the document, a row per status: nothing lost between boards.',
  },
];

export const PLAN_TILES: PaletteTileDef[] = [
  ...PLAN_BOARD_TILES.map((b): PaletteTileDef => ({
    id: `plan:board-${b.preset}`,
    section: 'plan-boards',
    label: `Add ${PLAN_BOARD_PRESETS[b.preset].label}`,
    caption: b.caption,
    description: b.description,
    action: { type: 'shape', kind: 'plan-board', plan: b.preset },
    icon: <PlanBoardTileArt size={GLYPH_PX} preset={b.preset} />,
  })),
  ...ITEM_TYPES.map(planCardTile),
  // The header widgets (docs/specs/026-plan/board-widgets.md): dragged into a board's header, or tapped
  // to add to the selected board.
  ...BOARD_WIDGET_KINDS.map((w): PaletteTileDef => ({
    id: `plan:widget-${w}`,
    section: 'plan-widgets',
    label: `Add ${BOARD_WIDGET_INFO[w].label}`,
    caption: BOARD_WIDGET_INFO[w].label,
    description: BOARD_WIDGET_INFO[w].description,
    noTint: true,
    action: { type: 'plan-widget', widget: w },
    icon: <BoardWidgetArt kind={w} size={GLYPH_PX} />,
  })),
  // Metrics and visualisations (docs/specs/026-plan/plan-views.md): plan views placed on the canvas.
  ...PLAN_VIEW_TILES,
];

// A card tile for an item type (docs/specs/026-plan/item-types.md "Where types show"): the built-in
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
    icon: <PlanCardTileArt size={CARD_TILE_GLYPH_PX} color={t.color} glyph={t.glyph} />,
  };
}
