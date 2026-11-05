import { isFloorPattern, spacePattern, type BackgroundPattern } from '@livehuddle/document';
import { floorTile, isDarkCanvas } from '@/lib/floor-tiles';
import { seasonalPatternTile } from '@/lib/seasonal-patterns';

// The canvas backdrop builders, lifted out of Canvas.tsx. Pure functions: given a tab's stored pattern, the pan
// offset and the tab's colours, return the `React.CSSProperties` Canvas stamps onto its main element, or the same
// backdrop as one SVG tile for the image export.
//
// livehuddle's canvas wears a floor (docs/specs/011-theme/floors.md): every stored pattern goes through
// `spacePattern` first, so a retired diagram pattern (dots, graph paper, ruled lines...) draws as its floor, and what
// is left to draw is a floor, None, or a seasonal look's motif. A floor brings its own colours, light or dark after
// the canvas colour under it; the strength slider fades it into that canvas colour.

// A tab's pattern colour is document data, so another editor (or a copied
// Community board) chooses it, and it is spliced into SVG markup (the export
// preview renders that as HTML) and into CSS `url(...)` values. Anything
// outside a plain colour grammar (hex, rgb/hsl functions, a named colour)
// becomes transparent, so a quote or `<` can never leave its attribute.
const SAFE_CSS_COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]{1,64}\)|[a-z]{1,32})$/i;
export function safeCssColor(color: string): string {
  return SAFE_CSS_COLOR.test(color) ? color : 'transparent';
}

// Apply the user-controlled tab background opacity by converting the
// `#rrggbb` colour to `rgba(...)` with the supplied alpha. Hex parsing
// is permissive: anything else falls back to the colour as-is so a
// theme that ships a CSS keyword doesn't break.
function applyAlpha(rawColor: string, alpha: number): string {
  const color = safeCssColor(rawColor);
  if (alpha >= 1) return color;
  const match = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Scale every `<n>px` length in a CSS background-size spec by `k` (the
// user's pattern-size slider). Only background-size is scaled, never
// background-position, so the tiles grow / shrink while the pattern still
// tracks the pan offset at its original phase. Multi-layer specs (comma
// separated, e.g. graph / engineering) scale every layer.
function scaleBackgroundSize(spec: string, k: number): string {
  return spec.replace(/(\d+(?:\.\d+)?)px/g, (_, n: string) => `${Number(n) * k}px`);
}

// Where the static pattern's origin lands on screen, so the pattern lives in
// WORLD space like the elements (docs/specs/008-canvas/canvas-and-palette.md "Canvas"). The element
// layer is `scale(z) translate(o)` about the centre C of the canvas, which
// puts world point p at `z * (p + o) + C * (1 - z)`; this is that for p = 0.
// Feeding the raw offset instead drifted the pattern against the elements at
// any zoom but 1, which a phone (it opens at 0.6) showed on every pan.
// Pair it with `patternScale * zoom` so the tiles scale with the canvas.
export function worldPatternOrigin(
  offset: { x: number; y: number },
  zoom: number,
  size: { w: number; h: number },
): { x: number; y: number } {
  return {
    x: zoom * offset.x + (1 - zoom) * (size.w / 2),
    y: zoom * offset.y + (1 - zoom) * (size.h / 2),
  };
}

export function tabBackgroundStyle(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity = 1,
  patternScale = 1,
): React.CSSProperties {
  const style = patternStyleFor(pattern, offset, backgroundColor, patternColor, backgroundOpacity);
  if (patternScale !== 1 && typeof style.backgroundSize === 'string') {
    style.backgroundSize = scaleBackgroundSize(style.backgroundSize, patternScale);
  }
  return style;
}

function patternStyleFor(
  pattern: BackgroundPattern,
  offset: { x: number; y: number },
  backgroundColor: string,
  patternColor: string,
  backgroundOpacity: number,
): React.CSSProperties {
  const drawn = spacePattern(pattern);
  const position = `${offset.x}px ${offset.y}px`;
  if (isFloorPattern(drawn)) {
    // The floor over the canvas colour, faded by the strength slider (so at 0% the plain canvas shows).
    const tile = fadedFloorTile(drawn, isDarkCanvas(backgroundColor), backgroundOpacity);
    return {
      backgroundColor: safeCssColor(backgroundColor),
      backgroundImage: svgTileUrl(tile),
      backgroundSize: `${tile.w}px ${tile.h}px`,
      backgroundPosition: position,
    };
  }
  const base: React.CSSProperties = {
    backgroundColor: applyAlpha(backgroundColor, backgroundOpacity),
  };
  // A seasonal motif is one SVG tile in the tab's pattern colour, faded in lockstep with the backdrop.
  const seasonal = seasonalPatternTile(drawn, applyAlpha(patternColor, backgroundOpacity));
  if (!seasonal) return base;
  return {
    ...base,
    backgroundImage: svgTileUrl(seasonal),
    backgroundSize: `${seasonal.w}px ${seasonal.h}px`,
    backgroundPosition: position,
  };
}

// A floor tile at a strength below full: the same tile inside one faded group. Cached per floor, half and strength;
// the strength slider steps in 5% so the cache stays small, and it is emptied if it ever grows past a few dozen.
type Tile = { w: number; h: number; inner: string };
const fadedTiles = new Map<string, Tile>();
function fadedFloorTile(
  floor: Parameters<typeof floorTile>[0],
  dark: boolean,
  opacity: number,
): Tile {
  const tile = floorTile(floor, dark);
  const o = Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100;
  if (o >= 1) return tile;
  const key = `${floor}:${dark}:${o}`;
  let faded = fadedTiles.get(key);
  if (!faded) {
    if (fadedTiles.size > 48) fadedTiles.clear();
    faded = { w: tile.w, h: tile.h, inner: `<g opacity='${o}'>${tile.inner}</g>` };
    fadedTiles.set(key, faded);
  }
  return faded;
}

// A raw SVG tile as a CSS `url(...)`: `#` becomes %23. Memoised per tile object (floor and seasonal tiles are cached
// objects), so a pan or zoom frame re-encodes nothing.
const tileUrls = new WeakMap<object, string>();
function svgTileUrl(tile: Tile): string {
  let url = tileUrls.get(tile);
  if (!url) {
    url =
      `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${tile.w}' height='${tile.h}'>` +
      `${tile.inner.replace(/#/g, '%23')}</svg>")`;
    tileUrls.set(tile, url);
  }
  return url;
}

// ── The backdrop as an SVG tile, for the image export (docs/specs/010-palette/style-presets.md) ─────
//
// The editor paints the backdrop as a CSS background-image; an export can't capture that, so this returns the SAME
// tile as raw SVG (raw `#` colours) for the export to drop into an SVG `<pattern>` (and to rasterise onto the
// PNG/PDF canvas). Null for None, which paints no image. A floor's tile carries its own colours and is faded by
// `opacity` as on the canvas; a seasonal motif takes the pattern colour.
//
// `scale` (the tab's pattern-size slider) is baked in: the tile grows and its content scales with it, matching
// `scaleBackgroundSize`.
type BackgroundPatternTile = { width: number; height: number; content: string };

export function backgroundPatternTile(
  pattern: BackgroundPattern,
  patternColor: string,
  opacity = 1,
  scale = 1,
  backgroundColor = '#ffffff',
): BackgroundPatternTile | null {
  const drawn = spacePattern(pattern);
  const spec = isFloorPattern(drawn)
    ? fadedFloorTile(drawn, isDarkCanvas(backgroundColor), opacity)
    : seasonalPatternTile(drawn, applyAlpha(patternColor, opacity));
  if (!spec) return null;
  return {
    width: spec.w * scale,
    height: spec.h * scale,
    content: scale === 1 ? spec.inner : `<g transform='scale(${scale})'>${spec.inner}</g>`,
  };
}
