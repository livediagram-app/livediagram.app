import type { PaletteTileDef } from './palette-tile-defs';

// The category flyout's arrangement (docs/specs/007-editor/toolbar-layout.md "Diagram's category bar"): which
// categories show on the bar, how each one's tiles are laid out in its flyout, the short line under its name, and
// the names of its groups. Pure, so the rules are testable without rendering the strip.

/** How a flyout lays its tiles out: a grid of pictures where the glyph IS the answer (a square explains a square),
 *  or cards with a one-line blurb where it is not (a Sankey's glyph does not explain a Sankey). The same rule as the
 *  category bodies' (docs/specs/010-palette/palette-top-level-categories.md "Rows, not tiles"). */
export type FlyoutLayout = 'grid' | 'cards';

// The grid categories and their columns: Popular's twelve as three even rows of four, Shapes five to a row.
const GRID_COLUMNS: Readonly<Record<string, number>> = { popular: 4, shapes: 5 };

export function flyoutLayout(categoryId: string): FlyoutLayout {
  return categoryId in GRID_COLUMNS ? 'grid' : 'cards';
}

/** A grid category's columns. */
export function flyoutColumns(categoryId: string): number {
  return GRID_COLUMNS[categoryId] ?? 5;
}

// Categories shown as one block whatever their dividers: Popular's picks come from every category, so its strip
// dividers would split twelve tiles into groups of one and three.
const UNGROUPED: ReadonlySet<string> = new Set(['popular']);

/** A card category's columns: one for a short list (Media's two), so its flyout is narrow; two otherwise. */
export const SHORT_CARD_LIST = 3;
export function flyoutCardColumns(tileCount: number): 1 | 2 {
  return tileCount <= SHORT_CARD_LIST ? 1 : 2;
}

// The line under a flyout's name: what the category is for, short enough for one line at 26rem. A category not
// listed falls back to its own description.
const TAGLINES: Readonly<Record<string, string>> = {
  popular: 'The tiles a diagram is most often built from.',
  shapes: 'The basics, the flowchart vocabulary and more.',
  'my-shapes': 'Shapes from your imported libraries.',
  write: 'Words on the canvas: text, notes and comments.',
  draw: 'Sketch, outline and connect by hand.',
  build: 'Structures that grow as you type.',
  concepts: 'Ideas laid out as one element that arranges itself.',
  icons: 'Single-colour glyphs for any idea.',
  technology: 'Cloud and infrastructure marks for architecture.',
  media: 'Pictures and people.',
};

export function flyoutTagline(categoryId: string, fallback: string): string {
  return TAGLINES[categoryId] ?? fallback;
}

// Each category's groups, named in order: a category splits into groups where a tile ends one (`dividerAfter`, the
// strip's fixed dividers), so the names follow those splits. A category with one group shows no heading; a group
// with no name here shows none either.
const GROUP_NAMES: Readonly<Record<string, readonly string[]>> = {
  shapes: ['Basics', 'Flowchart', 'More Shapes'],
  write: ['Text', 'Notes and Comments'],
  draw: ['Pens', 'Outlines', 'Connectors'],
  build: ['Diagrams', 'Layout and Parts'],
};

export type FlyoutGroup = { id: string; title: string | null; tiles: PaletteTileDef[] };

/** The category's tiles split into its named groups, in order. Empty groups are dropped. */
export function flyoutGroups(categoryId: string, tiles: readonly PaletteTileDef[]): FlyoutGroup[] {
  const runs: PaletteTileDef[][] = [[]];
  tiles.forEach((tile, i) => {
    runs.at(-1)!.push(tile);
    if (tile.dividerAfter && i < tiles.length - 1 && !UNGROUPED.has(categoryId)) runs.push([]);
  });
  const names = GROUP_NAMES[categoryId] ?? [];
  const groups = runs.filter((run) => run.length > 0);
  return groups.map((run, i) => ({
    id: run[0]!.id,
    title: groups.length > 1 ? (names[i] ?? null) : null,
    tiles: run,
  }));
}

// An item's place in the flyout, for arrow-key moves: the centre of its box.
export type FlyoutPoint = { x: number; y: number };

/** The index the arrow key moves focus to among the flyout's items (in reading order, across its groups), or null
 *  to stay. Left and Right step through the list; Up and Down move to the nearest item in the row above or below,
 *  by position, since the groups' rows do not line up as one grid; Home and End jump to the ends. */
export function flyoutKeyTarget(
  key: string,
  index: number,
  points: readonly FlyoutPoint[],
): number | null {
  const count = points.length;
  const here = points[index];
  if (count === 0 || !here) return null;
  switch (key) {
    case 'ArrowRight':
      return index + 1 < count ? index + 1 : null;
    case 'ArrowLeft':
      return index > 0 ? index - 1 : null;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'ArrowDown':
    case 'ArrowUp': {
      const down = key === 'ArrowDown';
      // The nearest row in that direction (a few px of slack for sub-pixel layout), then its closest item.
      let rowY: number | null = null;
      for (const p of points) {
        const ahead = down ? p.y > here.y + 2 : p.y < here.y - 2;
        if (ahead && (rowY === null || (down ? p.y < rowY : p.y > rowY))) rowY = p.y;
      }
      if (rowY === null) return null;
      let best: number | null = null;
      points.forEach((p, i) => {
        if (Math.abs(p.y - rowY!) > 2) return;
        if (best === null || Math.abs(p.x - here.x) < Math.abs(points[best]!.x - here.x)) best = i;
      });
      return best;
    }
    default:
      return null;
  }
}
