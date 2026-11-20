// The palette strip's category glyphs (packages/ui palette-tab-icons.tsx) and the strip's item names, for
// ./editor-chrome and the flyouts: each glyph in its own box, drawn centred at any size.

import { Icon } from '@/editions/livehuddle/components/illustrations/editor-chrome';
import { lucideLibrary, lucideSearch } from '@liveworkspace/icons/lucide';

/** A glyph's drawing parts, as lucide's (and the livehuddle kit's Icon) take them. */
export type Prim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: string; [k: string]: unknown };

// The category glyphs (packages/ui palette-tab-icons.tsx), each in its own box: Shapes, Concepts and Components in
// an 18-unit box, the rest in lucide's 24.
const SHAPES: readonly Prim[] = [
  { t: 'path', d: 'M9 2 12.3 7.4 5.7 7.4Z' },
  { t: 'circle', cx: 5.2, cy: 12.8, r: 2.8 },
  { t: 'rect', x: 10.4, y: 10, w: 5.6, h: 5.6, rx: 0.9 },
];
const CONCEPTS: readonly Prim[] = [
  { t: 'path', d: 'M9 2.5 11.6 7H6.4Z' },
  { t: 'path', d: 'M5.6 8.4h6.8l2.2 3.6H3.4Z' },
  { t: 'path', d: 'M2.6 13.4h12.8l1 2.1H1.6Z' },
];
const COMPONENTS: readonly Prim[] = [
  { t: 'rect', x: 2.5, y: 2.5, w: 13, h: 4, rx: 1 },
  { t: 'rect', x: 2.5, y: 8, w: 13, h: 7.5, rx: 1 },
];
const WRITE: readonly Prim[] = [
  { t: 'path', d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z' },
  { t: 'path', d: 'm14.5 5.5 4 4' },
];
const ICONS_GLYPH: readonly Prim[] = [
  { t: 'circle', cx: 12, cy: 12, r: 9.5 },
  { t: 'path', d: 'M8.4 14.5s1.4 1.9 3.6 1.9 3.6-1.9 3.6-1.9' },
  { t: 'path', d: 'M9 9.5h.01M15 9.5h.01' },
];
const MEDIA: readonly Prim[] = [
  { t: 'rect', x: 3, y: 4.5, w: 18, h: 15, rx: 2 },
  { t: 'circle', cx: 8.5, cy: 10, r: 1.6 },
  { t: 'path', d: 'm4 16.5 4.5-4 3.5 3 3-2.5 5 4' },
];
const DATA: readonly Prim[] = [{ t: 'path', d: 'M5 20V10M12 20V4M19 20v-8' }];

/** The strip's items, as the editor's own names. */
export type StripItem =
  | 'shapes'
  | 'write'
  | 'concepts'
  | 'components'
  | 'icons'
  | 'media'
  | 'data'
  | 'library'
  | 'search';

/** Each item's glyph and the box it is drawn in. */
export const STRIP_GLYPHS: Record<StripItem, { prims: readonly Prim[]; units: number }> = {
  shapes: { prims: SHAPES, units: 18 },
  write: { prims: WRITE, units: 24 },
  concepts: { prims: CONCEPTS, units: 18 },
  components: { prims: COMPONENTS, units: 18 },
  icons: { prims: ICONS_GLYPH, units: 24 },
  media: { prims: MEDIA, units: 24 },
  data: { prims: DATA, units: 24 },
  library: { prims: lucideLibrary, units: 24 },
  search: { prims: lucideSearch, units: 24 },
};

/** The category's name, for a flyout's header. */
export const STRIP_NAMES: Record<StripItem, string> = {
  shapes: 'Shapes',
  write: 'Write',
  concepts: 'Concepts',
  components: 'Components',
  icons: 'Icons',
  media: 'Media',
  data: 'Data',
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
