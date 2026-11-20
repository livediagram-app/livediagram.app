// The page tree as the sidebar draws it (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"): the
// rows on screen, where the arrow keys go, and where a dragged row lands. Pure, over the tree functions
// (@liveknowledge/document page-tree.ts): the list of tabs in, rows or a move out.
import { pageAncestors, pageTreeRows, type PageMove, type TreePage } from '@liveknowledge/document';

/** The sidebar's width, in px at the panels' UI scale. */
export const PAGE_TREE_WIDTH = 264;
/** Collapsed, the sidebar is a rail this wide. */
export const PAGE_TREE_RAIL_WIDTH = 48;
/** How far a level indents. */
export const PAGE_TREE_INDENT = 20;
/** A row's height with a mouse, and on a touch screen (never under the 44px a finger needs). */
export const PAGE_TREE_ROW = 32;
export const PAGE_TREE_TOUCH_ROW = 44;
/** The gap the corner panels and the bottom-right cluster keep from the sidebar. */
const PAGE_TREE_GAP = 16;

/** How far the left corner stacks and the bottom-right cluster start from the canvas's left beside a sidebar
 *  `width` px wide (at the panels' scale): past it, with their usual inset. */
export function pageTreeClearancePx(width: number, panelScale: number): number {
  return width * panelScale + PAGE_TREE_GAP;
}

/** What the tree reads of a tab to draw its row. */
export type TreeTab = TreePage & { name: string; locked?: boolean | undefined };

/** One row on screen. `level` is 1 at the top; `position` and `siblings` place it among its siblings. */
export type PageRow = {
  id: string;
  name: string;
  level: number;
  parent: string | undefined;
  subpages: number;
  open: boolean;
  position: number;
  siblings: number;
  locked: boolean;
};

/**
 * The rows on screen, top to bottom: every page not under a closed one. A page with subpages is open unless it is in
 * `closed`; the current page's ancestors are always open, so the page you are on is never folded out of sight.
 */
export function visiblePageRows(
  tabs: readonly TreeTab[],
  closed: ReadonlySet<string>,
  activeId: string | null,
): PageRow[] {
  const forced = new Set(activeId ? pageAncestors(tabs, activeId).map((p) => p.id) : []);
  const rows = pageTreeRows(tabs);
  // The page at each level above the row being read, for its parent; and how many pages each parent holds.
  const path: string[] = [];
  const counts = new Map<string | undefined, number>();
  const parents: (string | undefined)[] = [];
  for (const row of rows) {
    path.length = row.depth - 1;
    const parent = path[row.depth - 2];
    parents.push(parent);
    counts.set(parent, (counts.get(parent) ?? 0) + 1);
    path[row.depth - 1] = row.page.id;
  }
  const seen = new Map<string | undefined, number>();
  const out: PageRow[] = [];
  // Rows deeper than this are folded away, until a row at this level or above ends the closed page's subtree.
  let foldedBelow = Infinity;
  rows.forEach((row, i) => {
    const parent = parents[i];
    const position = (seen.get(parent) ?? 0) + 1;
    seen.set(parent, position);
    if (row.depth > foldedBelow) return;
    foldedBelow = Infinity;
    const { page } = row;
    const open = row.subpages > 0 && (forced.has(page.id) || !closed.has(page.id));
    if (row.subpages > 0 && !open) foldedBelow = row.depth;
    out.push({
      id: page.id,
      name: page.name,
      level: row.depth,
      parent,
      subpages: row.subpages,
      open,
      position,
      siblings: counts.get(parent) ?? 1,
      locked: page.locked === true,
    });
  });
  return out;
}

/** What a key pressed on a row asks for. */
export type TreeKeyAction =
  | { kind: 'focus'; id: string }
  | { kind: 'open'; id: string }
  | { kind: 'close'; id: string }
  | { kind: 'select'; id: string }
  | { kind: 'rename'; id: string }
  | { kind: 'menu'; id: string };

/**
 * A tree's keys (WAI-ARIA tree view): Up and Down move through the rows on screen, Home and End to the first and
 * last, Right opens a closed page or enters an open one, Left closes an open page or goes to its parent, Enter opens
 * the page, F2 renames it and the menu key (or Shift+F10) opens its menu. Null for a key the tree does not take.
 */
export function treeKeyAction(
  rows: readonly PageRow[],
  focusedId: string | null,
  key: string,
  shift = false,
): TreeKeyAction | null {
  const at = rows.findIndex((r) => r.id === focusedId);
  const row = rows[at];
  if (!row) return null;
  const focus = (target: PageRow | undefined): TreeKeyAction | null =>
    target && target.id !== row.id ? { kind: 'focus', id: target.id } : null;
  switch (key) {
    case 'ArrowDown':
      return focus(rows[at + 1]);
    case 'ArrowUp':
      return focus(rows[at - 1]);
    case 'Home':
      return focus(rows[0]);
    case 'End':
      return focus(rows[rows.length - 1]);
    case 'ArrowRight':
      if (row.subpages === 0) return null;
      return row.open ? focus(rows[at + 1]) : { kind: 'open', id: row.id };
    case 'ArrowLeft':
      if (row.open) return { kind: 'close', id: row.id };
      return focus(rows.find((r) => r.id === row.parent));
    case 'Enter':
      return { kind: 'select', id: row.id };
    case 'F2':
      return { kind: 'rename', id: row.id };
    case 'ContextMenu':
      return { kind: 'menu', id: row.id };
    case 'F10':
      return shift ? { kind: 'menu', id: row.id } : null;
    default:
      return null;
  }
}

/** Where on a row the pointer is while dragging: its top edge, its bottom edge, or the row itself. */
export type DropZone = 'before' | 'after' | 'inside';

/** The zone under a pointer `offsetY` px down a row `height` px tall: the top and bottom quarters reorder, the
 *  middle nests. */
export function dropZoneOf(offsetY: number, height: number): DropZone {
  if (height <= 0) return 'inside';
  const at = offsetY / height;
  if (at < 0.25) return 'before';
  return at > 0.75 ? 'after' : 'inside';
}

/**
 * The move a drop asks for: before a row is before it among its siblings; on a row is its last subpage; after a row
 * is after it among its siblings, or, when the row is open, before its first subpage (where the insertion line is
 * drawn). Null for a row not on screen.
 */
export function dropMove(
  rows: readonly PageRow[],
  targetId: string,
  zone: DropZone,
): PageMove | null {
  const at = rows.findIndex((r) => r.id === targetId);
  const target = rows[at];
  if (!target) return null;
  if (zone === 'inside') return { parent: target.id };
  if (zone === 'before') return { parent: target.parent, before: target.id };
  if (target.open) return { parent: target.id, before: rows[at + 1]?.id };
  // The next row on screen at the target's own level and under the same parent is its next sibling; one above that
  // level ends the siblings.
  let next: string | undefined;
  for (let i = at + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.level < target.level) break;
    if (row.level === target.level) {
      next = row.id;
      break;
    }
  }
  return { parent: target.parent, before: next };
}
