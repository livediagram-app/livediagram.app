// The Plan board body's fixed parts (PlanBoardView.tsx): its default corners, when it is busy, its see-through
// surface, how its body keeps a press from the canvas, and the empty values it falls back on.
import { markPanThrough } from '@liveworkspace/workbench/hooks/canvas/pan-through';
import type { Item } from '@liveplanner/items';

// A board's corner radius when it has none of its own (Quick Style's Corners sets one).
export const PLAN_BOARD_RADIUS_PX = 12;
// A board showing more cards than this is busy (docs/specs/026-plan/plan-board.md "A busy board"): a Tab Style change
// snaps its parts rather than easing them, and its cards out of view skip their styling and layout until they come
// into view (globals.css `data-plan-busy`).
export const PLAN_BUSY_CARDS = 100;
// A board's surface, 80% solid so the tab's canvas shows faintly through it.
export const boardSurface = (surface: string) => `color-mix(in srgb, ${surface} 80%, transparent)`;

export const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The board body keeps its presses (cards, cells, buttons) from the canvas, except a finger on empty board,
// which pans the canvas as it would anywhere else, never moving the board: only its header does that
// (docs/specs/026-plan/plan-board.md "On a phone").
export function keepBoardPress(e: React.PointerEvent<HTMLElement>): void {
  if (e.pointerType === 'touch') {
    const t = e.target as HTMLElement;
    if (!t.closest('[data-plan-card], button, input, select, textarea, [role="button"]')) {
      markPanThrough(e);
      return;
    }
  }
  e.stopPropagation();
}
export const NO_ITEMS: ReadonlyMap<string, Item> = new Map();
export const NO_COLUMNS: never[] = [];
export const NO_STATUSES: ReadonlyMap<string, string> = new Map();
export const NONE_SHUT: ReadonlySet<string> = new Set();
