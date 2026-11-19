// The category flyout's editor parts (each editor's docs/specs/007-editor/toolbar-layout.md "The flyout"): the
// flyout, its side panel and their keyboard are every editor's one copy (CategoryFlyout, CategoryFlyoutSide,
// CategoryBarFlyout, Work Tracker 1261), drawn from the editor's own tiles. Each editor binds its tiles once, at module
// scope, in its components/palette/category-flyout-kit.tsx: how a tile places, arms, drags and tints, and how its
// categories are arranged. The flyout never reads a tile's action; only the kit does.
import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { flyoutWidthPx } from './CategoryBar';

/** A palette tile as the flyout draws it: the fields every editor's PaletteTileDef shares. */
export type FlyoutTile<T> = {
  id: string;
  label: string;
  description: string;
  blurb?: string | undefined;
  icon: ReactNode;
  shortcut?: string | undefined;
  disabled?: { reason: string } | undefined;
  // A tile with presets (Card, Badge) or a parent's members (Devices): its side panel lists them.
  variants?: readonly T[] | undefined;
  variantsHint?: string | undefined;
  parentOf?: string | undefined;
};

/** A category as its flyout shows it: its tiles, or a catalogue's own browse (`content`) when it has none. */
export type FlyoutCategory<T> = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  // Null for a catalogue, whose body is `content`.
  tiles: readonly T[] | null;
  content: ReactNode;
};

/** One of a category's named groups (the editor's category-flyout-groups). */
export type FlyoutGroup<T> = { id: string; title: string | null; tiles: T[] };

/** The editor's tiles, bound for the flyout. `A` is its tile actions and `P` its pending draw; the flyout only passes
 *  them through. */
export type FlyoutKit<T extends FlyoutTile<T>, A, P> = {
  /** The tile's name as a tile shows it (its caption, else its label). */
  displayName: (def: T) => string;
  /** The tiles this editor shows now (a picture's tools only with a picture). */
  visible: (tiles: readonly T[], actions: A) => T[];
  /** Uses the tile: places it, arms its tool or runs its command. */
  press: (def: T, actions: A, pendingDraw: P) => void;
  /** Whether the tile's tool is the armed one. */
  active: (def: T, pendingDraw: P) => boolean;
  /** Its drag onto the canvas, or none for a tile that does not drag. */
  dragStart: (def: T) => ((e: DragEvent) => void) | undefined;
  /** A drag's end, dropped or not: its canvas preview goes. */
  dragEnd: () => void;
  /** Its glyph's theme tint and finish (the editor's useTileGlyph); `plain` keeps the brand look. A hook. */
  useGlyph: (
    def: T,
    plain: boolean,
  ) => { glyphStyle: CSSProperties | undefined; glyphClass: string };
  /** Whether a press opens a side panel (its presets, or what the editor puts there) rather than placing. */
  opensSide: (def: T) => boolean;
  /** The footer's line for a tile without presets, in place of its description (an opener's "Browse …"). */
  footerLine?: (def: T) => string | undefined;
  /** The category's tiles in its named groups. */
  groups: (categoryId: string, tiles: readonly T[]) => FlyoutGroup<T>[];
  /** Picture tiles in a grid, or cards with their blurbs. */
  layout: (categoryId: string) => 'grid' | 'cards';
  /** A grid category's columns. */
  columns: (categoryId: string) => number;
  /** A card category's columns, by how many tiles it has. */
  cardColumns: (tileCount: number) => number;
  /** The short line under the category's name. */
  tagline: (categoryId: string, fallback: string) => string;
  /** What leads a category's groups, if anything (livedesign's own components lead Components). */
  lead?: (categoryId: string) => ReactNode;
  /** A catalogue's browse, wrapped for the flyout (its two panes). */
  catalogue: (content: ReactNode) => ReactNode;
};

/** A category's flyout width in px, by the kit's arrangement (flyoutWidthPx). */
export function flyoutCategoryWidthPx<T extends FlyoutTile<T>>(
  kit: Pick<FlyoutKit<T, unknown, unknown>, 'layout' | 'cardColumns'>,
  category: Pick<FlyoutCategory<T>, 'id' | 'tiles'>,
): number {
  return flyoutWidthPx(
    category.tiles ? category.tiles.length : null,
    kit.layout(category.id) === 'cards',
    kit.cardColumns,
  );
}
