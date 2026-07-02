// Shared types for the two icon catalogues (spec/09 "Icons" line art +
// spec/41 Technology brand marks). Moved here from apps/live so the data
// can be consumed by every renderer: the editor (async, via its
// icon-registry chunk), the api worker's live-image / thumbnail render,
// and the MCP worker's inline render.

export type IconPrim =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'polyline'; points: string }
  | { t: 'polygon'; points: string }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export type IconDef = {
  id: string;
  label: string;
  // Extra search terms beyond the label, so "db" finds "database" and
  // "gear" finds "settings".
  keywords: string;
  prims: IconPrim[];
};

export type TechProvider = 'aws' | 'azure' | 'cloudflare' | 'firebase' | 'generic';

export type TechIconDef = {
  id: string;
  label: string;
  // Optional shorter caption for the palette tile, where a long label
  // would truncate (and e.g. "Virtual Machine" / "Virtual Network" would
  // clip to the same ambiguous prefix). The full `label` is still used for
  // search, the aria-label, and the on-canvas element. Omit when `label`
  // already fits.
  short?: string;
  provider: TechProvider;
  // Extra search terms beyond the label (so "object storage" finds S3).
  keywords: string;
  // Tile fill — the service / brand colour.
  color: string;
  // Inner SVG markup in a 0..24 art box, drawn on top of the tile. The
  // renderer wraps it in a white line-art group, so a bare <path>/<circle>
  // strokes white; a filled mark sets fill="#fff" stroke="none" itself.
  glyph: string;
};
