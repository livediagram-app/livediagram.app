import type { PaletteTileDef } from './palette-tile-defs';

// The category bar's arrangement (docs/specs/007-editor/toolbar-layout.md "The category bar"): each category's
// one-word name, how its tiles are laid out in its flyout, the short line under its name, and the names of its
// groups. Pure, so the rules are testable without rendering the strip.

// The bar names every category in one word, so a name never wraps or crowds its neighbours: a layout's longer
// name gives way to its short one here (the flyout's header uses the same, so the two never disagree).
const BAR_LABELS: Readonly<Record<string, string>> = {
  write: 'Write',
};

export function barLabel(categoryId: string, label: string): string {
  return BAR_LABELS[categoryId] ?? label;
}

/** How a flyout lays its tiles out: a grid of pictures where the glyph IS the answer (a square explains a square),
 *  or cards with a one-line blurb where it is not (a Sankey's glyph does not explain a Sankey). The same rule as the
 *  category bodies' (docs/specs/010-palette/palette-top-level-categories.md "Rows, not tiles"). */
type FlyoutLayout = 'grid' | 'cards';

// The grid categories and their columns: Shapes five to a row.
const GRID_COLUMNS: Readonly<Record<string, number>> = { shapes: 5 };

export function flyoutLayout(categoryId: string): FlyoutLayout {
  return categoryId in GRID_COLUMNS ? 'grid' : 'cards';
}

/** A grid category's columns. */
export function flyoutColumns(categoryId: string): number {
  return GRID_COLUMNS[categoryId] ?? 5;
}

/** A card category's columns: one for a short list (Media's two), so its flyout is narrow; two otherwise. */
export const SHORT_CARD_LIST = 3;
export function flyoutCardColumns(tileCount: number): 1 | 2 {
  return tileCount <= SHORT_CARD_LIST ? 1 : 2;
}

// The line under a flyout's name: what the category is for, short enough for one line at 26rem. A category not
// listed falls back to its own description.
const TAGLINES: Readonly<Record<string, string>> = {
  shapes: 'The basics, the flowchart vocabulary and more.',
  write: 'Words on the canvas: text, notes and comments.',
  draw: 'Sketch, outline and connect by hand.',
  build: 'Frames, stacks and tables that hold other work.',
  concepts: 'Ideas laid out as one element that arranges itself.',
  icons: 'Single-colour glyphs for any idea.',
  technology: 'Cloud and infrastructure marks for architecture.',
  media: 'Pictures and people.',
  stickers: 'Colour emoji to react, mark status and celebrate.',
  data: 'Charts and meters that read at a glance.',
  components: 'Ready-made blocks that follow the theme.',
  devices: 'Frames to set a screen design in.',
};

export function flyoutTagline(categoryId: string, fallback: string): string {
  return TAGLINES[categoryId] ?? fallback;
}

// A group's name, by the tile that starts it: a category splits into groups where a tile ends one (`dividerAfter`,
// the strip's fixed dividers), and the same tile starts the same kind of group whichever mode's layout it is in.
// A category shows its groups only when every one is named; otherwise it is one block, so a layout whose dividers
// fall elsewhere (Workshop's Write) never shows half its groups headed and half bare.
const GROUP_NAMES: Readonly<Record<string, string>> = {
  'shapes:square': 'Basics',
  'shapes:cylinder': 'Flowchart',
  'shapes:cloud': 'More Shapes',
  'tools:text': 'Text',
  'tools:sticky': 'Notes',
  'tools:polygon': 'Outlines',
  'tools:arrow': 'Connectors',
  'tools:table': 'Tables',
  'tools:stack': 'Layout',
  'components:hero': 'Layout',
  'tools:code-block': 'Code and Lists',
  'components:card': 'Page Blocks',
  // Page Blocks where a layout leaves out the Card and the Badge.
  'components:step': 'Page Blocks',
  'devices:browser': 'Desktop',
  'devices:phone': 'Mobile',
  'tools:image': 'Pictures',
  'media:embed-youtube': 'Embeds',
  'tools:avatar': 'People',
  'data:pie': 'Charts',
  'data:progress-bar': 'Meters',
};

export type FlyoutGroup = { id: string; title: string | null; tiles: PaletteTileDef[] };

/** The category's tiles split into its named groups, in order; one untitled group when they are not all named. */
export function flyoutGroups(tiles: readonly PaletteTileDef[]): FlyoutGroup[] {
  const runs: PaletteTileDef[][] = [[]];
  tiles.forEach((tile, i) => {
    runs.at(-1)!.push(tile);
    if (tile.dividerAfter && i < tiles.length - 1) runs.push([]);
  });
  const groups = runs.filter((run) => run.length > 0);
  const named = groups.length > 1 && groups.every((run) => GROUP_NAMES[run[0]!.id]);
  if (!named) return tiles.length > 0 ? [{ id: tiles[0]!.id, title: null, tiles: [...tiles] }] : [];
  return groups.map((run) => ({ id: run[0]!.id, title: GROUP_NAMES[run[0]!.id]!, tiles: run }));
}
// An item's place in the flyout, for arrow-key moves: the centre of its box.
type FlyoutPoint = { x: number; y: number };

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
        if (Math.abs(p.y - rowY) > 2) return;
        if (best === null || Math.abs(p.x - here.x) < Math.abs(points[best]!.x - here.x)) best = i;
      });
      return best;
    }
    default:
      return null;
  }
}
