// The whiteboard's shape catalogue (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows",
// "Shape slots"): every shape a whiteboard can arm, derived from the palette's own shape tiles rather
// than restated. The Shapes flyout's six open it under their dock names; every other palette shape
// kind follows, grouped by its palette category. Icons, stickers, technology and the Components
// category are not shapes here. Pure data; the dock renders each entry's preview.
import type { ShapeKind } from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import { SHAPE_TILES, shapeTileSearchItem } from './palette-search';
import { PALETTE_CATEGORIES } from '@/components/palette/palette-categories';
import { PALETTE_TILES, type PaletteTileDef } from '@/components/palette/palette-tile-defs';
import {
  WHITEBOARD_SHAPES,
  whiteboardShapeIntent,
  type WhiteboardShapeId,
} from './whiteboard-tool';

// A catalogue entry's stable id, stored in the synced preferences: a dock shape's id
// ('rectangle'), a shape kind ('triangle'), or a kind and its creation choice ('session-button:poll').
// 'sticky' is the whiteboard's sticky note, a shape of the bar and the flyout like any other.
export type WhiteboardShapeKey =
  WhiteboardShapeId | 'sticky' | ShapeKind | `${ShapeKind}:${string}`;

export type WhiteboardShapeEntry = {
  key: WhiteboardShapeKey;
  label: string;
  // Searched after the label, as the palette search does.
  keywords: string;
  // The palette category it sits in, which orders the catalogue.
  group: string;
  // Armed as a board shape: plain ink, the tool style of its kind.
  intent: PendingDraw;
  // One of the Shapes flyout's six: previewed with the dock's own glyph.
  dockShape?: WhiteboardShapeId;
  // The palette tile it comes from: previewed with the tile's own icon.
  tile?: PaletteTileDef;
  // Drawn with the dock's own glyph rather than a tile's (the sticky note, whose tile keeps its
  // paper colour, where the flyout draws every shape in the board's ink).
  glyph?: 'sticky';
};

// The palette categories that are not shapes on a whiteboard (the spec's "not components").
// Plan's boards, cards and plan views (docs/specs/025-plan/plan-mode.md, plan-views.md) frame items, not ink,
// so the dock leaves them out.
const EXCLUDED_CATEGORIES = new Set([
  'components',
  'plan-boards',
  'plan-cards',
  'plan-widgets',
  'plan-metrics',
  'plan-visualisations',
]);

// The palette tile behind each flyout shape that has one; Line and Arrow have none.
const DOCK_TILE_KIND: Partial<Record<WhiteboardShapeId, ShapeKind>> = {
  rectangle: 'square',
  ellipse: 'circle',
  diamond: 'diamond',
  cylinder: 'cylinder',
};

const LINE_KEYWORDS: Record<'line' | 'arrow', string> = {
  line: 'line straight connector stroke rule',
  arrow: 'arrow connector pointer direction flow',
};

// The palette category a tile renders under: its section, or its tool group inside Tools.
function tileCategory(tile: PaletteTileDef): string {
  return tile.section === 'tools' ? (tile.toolGroup ?? 'tools') : tile.section;
}

function tileEntry(tile: PaletteTileDef): WhiteboardShapeEntry {
  const item = shapeTileSearchItem(tile);
  const { type: _type, shapeKind, ...choice } = item.add;
  return {
    key: item.id.slice('shape:'.length) as WhiteboardShapeKey,
    label: item.name,
    keywords: item.keywords,
    group: tileCategory(tile),
    intent: { type: 'shape', kind: shapeKind, ...choice, board: true },
    tile,
  };
}

const tileOfKind = (kind: ShapeKind) =>
  SHAPE_TILES.find((t) => t.action.type === 'shape' && t.action.kind === kind);

function dockEntry(id: WhiteboardShapeId, label: string): WhiteboardShapeEntry {
  const kind = DOCK_TILE_KIND[id];
  const tile = kind ? tileOfKind(kind) : undefined;
  const keywords = tile
    ? `${shapeTileSearchItem(tile).name} ${shapeTileSearchItem(tile).keywords}`
    : LINE_KEYWORDS[id as 'line' | 'arrow'];
  return {
    key: id,
    label,
    keywords,
    group: tile ? tileCategory(tile) : 'draw',
    intent: whiteboardShapeIntent(id),
    dockShape: id,
  };
}

// The sticky note (docs/specs/023-draw-mode/draw-mode.md "Shape slots"): found by its names,
// armed as the plain note (no Event Storming colour).
function stickyEntry(): WhiteboardShapeEntry {
  const tile = PALETTE_TILES.find((t) => t.action.type === 'sticky' && !('fill' in t.action));
  return {
    key: 'sticky',
    label: 'Sticky note',
    keywords: `sticky note post-it postit memo card ${tile?.description ?? ''}`,
    group: tile ? tileCategory(tile) : 'write',
    intent: { type: 'sticky' },
    glyph: 'sticky',
  };
}

function buildCatalogue(): WhiteboardShapeEntry[] {
  const docked = new Set(Object.values(DOCK_TILE_KIND));
  const entries = [
    ...WHITEBOARD_SHAPES.map((s) => dockEntry(s.id, s.label)),
    stickyEntry(),
    ...SHAPE_TILES.filter((t) => !EXCLUDED_CATEGORIES.has(tileCategory(t)))
      .filter((t) => !(t.action.type === 'shape' && docked.has(t.action.kind)))
      .map(tileEntry),
  ];
  // Grouped in the palette's category order; catalogue order within a group.
  const order = PALETTE_CATEGORIES.map((c) => c.id);
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => order.indexOf(a.e.group) - order.indexOf(b.e.group) || a.i - b.i)
    .map(({ e }) => e);
}

export const WHITEBOARD_SHAPE_CATALOGUE: readonly WhiteboardShapeEntry[] = buildCatalogue();

const BY_KEY = new Map<string, WhiteboardShapeEntry>(
  WHITEBOARD_SHAPE_CATALOGUE.map((e) => [e.key, e]),
);

export function whiteboardShapeEntry(key: string): WhiteboardShapeEntry | undefined {
  return BY_KEY.get(key);
}

export function isWhiteboardShapeKey(key: unknown): key is WhiteboardShapeKey {
  return typeof key === 'string' && BY_KEY.has(key);
}

// Which catalogue shape an armed intent is, or null: only a board shape counts.
export function armedWhiteboardShape(intent: PendingDraw | null): WhiteboardShapeKey | null {
  if (!intent) return null;
  // The plain note only: an Event Storming note carries a colour or a kind.
  if (intent.type === 'sticky') return intent.fill || intent.esKind ? null : 'sticky';
  if (intent.type === 'arrow') {
    if (!intent.board) return null;
    return intent.ends === 'none' ? 'line' : 'arrow';
  }
  if (intent.type !== 'shape' || !intent.board) return null;
  const dock = (Object.keys(DOCK_TILE_KIND) as WhiteboardShapeId[]).find(
    (id) => DOCK_TILE_KIND[id] === intent.kind,
  );
  if (dock) return dock;
  const choice = intent.session ?? intent.reaction ?? intent.mode ?? intent.estimateScale;
  const key = choice ? `${intent.kind}:${choice}` : intent.kind;
  return isWhiteboardShapeKey(key) ? key : null;
}
