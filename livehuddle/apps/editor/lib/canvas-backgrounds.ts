import { isFloorPattern, spacePattern, type BackgroundPattern } from '@livehuddle/document';
import { floorTile, isDarkCanvas } from '@/lib/floor-tiles';
import { seasonalPatternTile } from '@/lib/seasonal-patterns';
import {
  applyAlpha,
  safeCssColor,
  scaleBackgroundSize,
  svgTileUrl,
} from '@liveworkspace/workbench/lib/canvas-backgrounds';

// The colour guard, the alpha, the size scale, the world origin and the tile url are the shared builders'
// (@liveworkspace/workbench/lib/canvas-backgrounds); the floors are this editor's own.
export { safeCssColor, worldPatternOrigin } from '@liveworkspace/workbench/lib/canvas-backgrounds';

// The canvas backdrop builders, lifted out of Canvas.tsx. Pure functions: given a tab's stored pattern, the pan
// offset and the tab's colours, return the `React.CSSProperties` Canvas stamps onto its main element, or the same
// backdrop as one SVG tile for the image export.
//
// livehuddle's canvas wears a floor (docs/specs/011-theme/floors.md): every stored pattern goes through
// `spacePattern` first, so a retired diagram pattern (dots, graph paper, ruled lines...) draws as its floor, and what
// is left to draw is a floor, None, or a seasonal look's motif. A floor brings its own colours, light or dark after
// the canvas colour under it; the strength slider fades it into that canvas colour.

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
