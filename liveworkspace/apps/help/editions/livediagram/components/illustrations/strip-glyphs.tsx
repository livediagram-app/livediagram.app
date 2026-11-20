// livediagram's palette strip glyphs (packages/ui palette-tab-icons.tsx, and lucide's for Library and Search) and the
// strip's item names, for ./editor-chrome and the flyouts: each glyph in its own box, drawn centred at any size.

import { Icon } from '@/editions/livehuddle/components/illustrations/editor-chrome';
import { lucideLibrary, lucideSearch } from '@liveworkspace/icons/lucide';

/** A glyph's drawing parts, as lucide's (and the livehuddle kit's Icon) take them. */
export type Prim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: string; [k: string]: unknown };

// Shapes, Concepts and Layout draw in an 18-unit box, the rest in lucide's 24.
const SHAPES: readonly Prim[] = [
  { t: 'path', d: 'M9 2 12.3 7.4 5.7 7.4Z' },
  { t: 'circle', cx: 5.2, cy: 12.8, r: 2.8 },
  { t: 'rect', x: 10.4, y: 10, w: 5.6, h: 5.6, rx: 0.9 },
];
const WRITE: readonly Prim[] = [
  { t: 'path', d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z' },
  { t: 'path', d: 'm14.5 5.5 4 4' },
];
const DRAW: readonly Prim[] = [
  { t: 'path', d: 'M3 16c3-6 5.5-9 7-9s1.5 4 0 8 1 5 3.5 2 4.5-6 7.5-6' },
];
const CONCEPTS: readonly Prim[] = [
  { t: 'path', d: 'M9 2.5 11.6 7H6.4Z' },
  { t: 'path', d: 'M5.6 8.4h6.8l2.2 3.6H3.4Z' },
  { t: 'path', d: 'M2.6 13.4h12.8l1 2.1H1.6Z' },
];
const LAYOUT: readonly Prim[] = [
  { t: 'rect', x: 1.6, y: 3, w: 9.4, h: 12, rx: 1.2 },
  { t: 'path', d: 'M1.6 6.6h9.4M11 10.8h2.2' },
  { t: 'rect', x: 13.2, y: 8.6, w: 3.2, h: 4.4, rx: 0.9 },
];
const ICONS_GLYPH: readonly Prim[] = [
  { t: 'circle', cx: 12, cy: 12, r: 9.5 },
  { t: 'path', d: 'M8.4 14.5s1.4 1.9 3.6 1.9 3.6-1.9 3.6-1.9' },
  { t: 'path', d: 'M9 9.5h.01M15 9.5h.01' },
];
const TECH: readonly Prim[] = [
  { t: 'rect', x: 3, y: 4, w: 18, h: 7, rx: 1.5 },
  { t: 'rect', x: 3, y: 13, w: 18, h: 7, rx: 1.5 },
  { t: 'path', d: 'M7 7.5h.01M7 16.5h.01' },
];

/** The strip's items in Diagram mode, as the editor names them. */
export type StripItem =
  'shapes' | 'write' | 'draw' | 'concepts' | 'layout' | 'icons' | 'tech' | 'library' | 'search';

/** Each item's glyph and the box it is drawn in. */
export const STRIP_GLYPHS: Record<StripItem, { prims: readonly Prim[]; units: number }> = {
  shapes: { prims: SHAPES, units: 18 },
  write: { prims: WRITE, units: 24 },
  draw: { prims: DRAW, units: 24 },
  concepts: { prims: CONCEPTS, units: 18 },
  layout: { prims: LAYOUT, units: 18 },
  icons: { prims: ICONS_GLYPH, units: 24 },
  tech: { prims: TECH, units: 24 },
  library: { prims: lucideLibrary, units: 24 },
  search: { prims: lucideSearch, units: 24 },
};

/** The category's name, for a flyout's header and a label under the strip. */
export const STRIP_NAMES: Record<StripItem, string> = {
  shapes: 'Shapes',
  write: 'Write',
  draw: 'Draw',
  concepts: 'Concepts',
  layout: 'Layout',
  icons: 'Icons',
  tech: 'Tech',
  library: 'Library',
  search: 'Search',
};

/** A strip glyph centred on (x, y), drawn in its own box at `size`. */
export function StripGlyph({
  item,
  x,
  y,
  size = 10,
  className = 'stroke-slate-600',
}: {
  item: StripItem;
  x: number;
  y: number;
  size?: number;
  className?: string;
}) {
  const { prims, units } = STRIP_GLYPHS[item];
  // Icon draws in lucide's 24-unit box; an 18-unit glyph is drawn larger by the ratio so it fills the size, its
  // centre moved to match.
  const k = 24 / units;
  const off = ((24 - units) / 2) * (size / units);
  return <Icon prims={prims} x={x + off} y={y + off} size={size * k} className={className} />;
}
