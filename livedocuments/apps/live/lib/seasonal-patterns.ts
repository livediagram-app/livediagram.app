// The seasonal canvas patterns (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks"): one motif tile
// each, as raw SVG in the tab's pattern colour. canvas-backgrounds.ts draws it twice from this one source: encoded
// into a CSS `url(...)` for the live canvas, and as an export tile. Every motif sits inside its tile or crosses an
// edge only where the opposite edge carries the matching half, so the tiles meet seamlessly.
import type { BackgroundPattern, SeasonalBackgroundPattern } from '@livedocuments/document';

/** One tile of a seasonal pattern: its size and inner SVG markup. */
type MotifTile = { w: number; h: number; inner: string };

const r1 = (n: number) => Math.round(n * 10) / 10;

// A four-point twinkle centred on (x, y), its points `r` out, its waist pinched by quadratic curves.
function twinkle(x: number, y: number, r: number, c: string): string {
  return (
    `<path d='M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} ` +
    `Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z' fill='${c}'/>`
  );
}

// An egg outline centred on (x, y): narrower at the top, with a zigzag band painted round its middle.
function egg(x: number, y: number, c: string): string {
  const band = [-3.5, -1.75, 0, 1.75, 3.5]
    .map((dx, i) => `${i ? 'L' : 'M'}${x + dx} ${y + (i % 2 ? -1 : 1)}`)
    .join(' ');
  return (
    `<path d='M${x} ${y - 6} C${x + 4} ${y - 6} ${x + 5} ${y + 1} ${x + 4.5} ${y + 3} ` +
    `C${x + 3.5} ${y + 6.5} ${x - 3.5} ${y + 6.5} ${x - 4.5} ${y + 3} ` +
    `C${x - 5} ${y + 1} ${x - 4} ${y - 6} ${x} ${y - 6} Z' fill='none' stroke='${c}' stroke-width='1'/>` +
    `<path d='${band}' fill='none' stroke='${c}' stroke-width='0.8'/>`
  );
}

// A six-armed snowflake centred on (x, y): three strokes through the middle, a small V on each arm's outer half.
function snowflake(x: number, y: number, r: number, c: string): string {
  const parts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    parts.push(`M${x} ${y} L${r1(x + ux * r)} ${r1(y + uy * r)}`);
    // The V: from 60% out along the arm, two short branches angled back towards the centre.
    const [bx, by] = [x + ux * r * 0.6, y + uy * r * 0.6];
    for (const turn of [-1, 1]) {
      const b = a + (turn * Math.PI) / 4;
      const len = r * 0.35;
      parts.push(
        `M${r1(bx)} ${r1(by)} L${r1(bx + Math.cos(b) * len)} ${r1(by + Math.sin(b) * len)}`,
      );
    }
  }
  return `<path d='${parts.join(' ')}' fill='none' stroke='${c}' stroke-width='1' stroke-linecap='round'/>`;
}

// A quarter web spun from the tile's top-left corner: five spokes and three sagging rings. The neighbouring tiles
// each start their own, so the canvas reads as webs strung in every corner.
function cobweb(c: string): string {
  const spokes = [0, 22.5, 45, 67.5, 90].map((deg) => (deg * Math.PI) / 180);
  const at = (a: number, r: number) => `${r1(Math.cos(a) * r)} ${r1(Math.sin(a) * r)}`;
  const parts = spokes.map((a) => `M0 0 L${at(a, 44)}`);
  for (const r of [12, 24, 36]) {
    // Each thread between two spokes sags towards the corner, as silk does.
    for (let i = 1; i < spokes.length; i++) {
      const mid = (spokes[i - 1]! + spokes[i]!) / 2;
      parts.push(`M${at(spokes[i - 1]!, r)} Q${at(mid, r * 0.86)} ${at(spokes[i]!, r)}`);
    }
  }
  return `<path d='${parts.join(' ')}' fill='none' stroke='${c}' stroke-width='0.8'/>`;
}

// Built tiles by pattern and colour. The canvas asks again on every pan frame with the same pair, and a snowflake's
// trigonometry costs ~10µs a build, so each pair is built once. A tab has one pattern colour (two with the appearance
// halves, a few more while its strength slider moves), so the cap only bounds a long session's slider drags.
const TILE_CACHE_MAX = 32;
const tileCache = new Map<string, MotifTile | null>();

/** The tile for a seasonal pattern in colour `c` (any CSS colour), or null for every other pattern. */
export function seasonalPatternTile(pattern: BackgroundPattern, c: string): MotifTile | null {
  const key = `${pattern}|${c}`;
  const cached = tileCache.get(key);
  if (cached !== undefined) return cached;
  const tile = buildTile(pattern, c);
  if (tileCache.size >= TILE_CACHE_MAX) tileCache.clear();
  tileCache.set(key, tile);
  return tile;
}

function buildTile(pattern: BackgroundPattern, c: string): MotifTile | null {
  switch (pattern as SeasonalBackgroundPattern) {
    case 'sparkles':
      return {
        w: 56,
        h: 56,
        inner:
          twinkle(14, 14, 6, c) +
          twinkle(40, 34, 4, c) +
          twinkle(20, 44, 2.5, c) +
          `<circle cx='44' cy='10' r='1' fill='${c}'/>` +
          `<circle cx='6' cy='32' r='0.8' fill='${c}'/>`,
      };
    case 'eggs':
      return { w: 48, h: 48, inner: egg(12, 13, c) + egg(36, 37, c) };
    case 'cobwebs':
      return { w: 64, h: 64, inner: cobweb(c) };
    case 'snowflakes':
      return {
        w: 60,
        h: 60,
        inner:
          snowflake(15, 15, 8, c) +
          snowflake(44, 42, 5, c) +
          `<circle cx='46' cy='12' r='1.2' fill='${c}'/>` +
          `<circle cx='12' cy='46' r='1' fill='${c}'/>`,
      };
    case 'candy-stripes':
      // Thick 45° bands corner to corner (the diagonal pattern's seamless trick), with the two corner halves.
      return {
        w: 24,
        h: 24,
        inner: `<path d='M-6 6 L6 -6 M0 24 L24 0 M18 30 L30 18' stroke='${c}' stroke-width='5' fill='none'/>`,
      };
    default:
      return null;
  }
}
