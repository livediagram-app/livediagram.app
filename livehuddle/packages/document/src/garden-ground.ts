// The garden's ground (docs/specs/009-elements/office.md "Garden Path", "Grass"; furniture-art-style.md): the textures
// a Garden Path and Grass are drawn with in the shaded illustration style. Gravel specks, flagstones cut by hand, and a
// lawn's fine turf with the light falling across it. Every texture is a fixed handful of shapes or one path whatever
// the size, seeded so the same element always draws the same. Pure: no React, no DOM.

const n = (v: number) => Math.round(v * 100) / 100;

/** A small seeded random source: the same seed always gives the same run of numbers in 0..1. */
function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * A flagstone inside the ellipse at (cx, cy) with radii rx, ry: seven corners, each pulled in a little by chance and
 * rounded, so no two stones are the same and each sits wholly inside its ellipse.
 */
export function flagstone(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const rand = seeded(seed + 1);
  const corners = 7;
  const turn = rand() * Math.PI * 2;
  const pts = Array.from({ length: corners }, (_, i) => {
    const a = turn + (i / corners) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const k = 0.84 + rand() * 0.14;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  });
  // Rounded: a curve through each corner's neighbourhood, from the middle of one side to the next.
  const mid = (i: number) => {
    const p = pts[i % corners]!;
    const q = pts[(i + 1) % corners]!;
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
  };
  let d = `M${n(mid(corners - 1)[0])} ${n(mid(corners - 1)[1])}`;
  for (let i = 0; i < corners; i += 1) {
    const c = pts[i]!;
    const m = mid(i);
    d += `Q${n(c[0])} ${n(c[1])} ${n(m[0])} ${n(m[1])}`;
  }
  return `${d}Z`;
}

// How far apart gravel specks lie, and the most a bed draws of each tone (so a very long path stays one modest path).
const SPECK_PITCH = 7;
const SPECK_CAP = 900;

/**
 * Gravel: specks of light and shadow scattered over a bed, as two paths of tiny squares (one element each, however
 * long the bed). `inside` keeps them to the bed's shape.
 */
export function gravelSpecks(
  width: number,
  height: number,
  seed: number,
  inside: (x: number, y: number) => boolean,
): { light: string; dark: string } {
  const rand = seeded(seed + 7);
  let light = '';
  let dark = '';
  let count = 0;
  // A coarser grid on a big bed, so it never draws more than the cap.
  const cells = (width / SPECK_PITCH) * (height / SPECK_PITCH);
  const pitch = cells > SPECK_CAP ? SPECK_PITCH * Math.sqrt(cells / SPECK_CAP) : SPECK_PITCH;
  for (let y = pitch / 2; y < height; y += pitch)
    for (let x = pitch / 2; x < width; x += pitch) {
      const px = x + (rand() - 0.5) * pitch;
      const py = y + (rand() - 0.5) * pitch;
      const size = 0.9 + rand() * 1.1;
      if (!inside(px, py) || count >= SPECK_CAP) continue;
      count += 1;
      const sq = `M${n(px)} ${n(py)}h${n(size)}v${n(size)}h${n(-size)}Z`;
      if (rand() < 0.55) dark += sq;
      else light += sq;
    }
  return { light, dark };
}

/** One blade of grass rooted at (x, y): a thin curve `tall` px high leaning by `lean`, written "Mx yq c1x c1y ex ey". */
function blade(x: number, y: number, tall: number, lean: number): string {
  return `M${n(x)} ${n(y)}q${n(lean * 0.25)} ${n(-tall * 0.6)} ${n(lean)} ${n(-tall)}`;
}

/** A repeating tile of turf: its side in canvas px, its shaded blades and its sunlit blades as path data. */
export interface GrassTile {
  size: number;
  shade: string;
  light: string;
}

// A tile of fine blades, scattered by chance but wholly inside the tile so none is cut at its seam.
function turf(size: number, count: number, seed: number): GrassTile {
  const rand = seeded(seed);
  let shade = '';
  let light = '';
  for (let i = 0; i < count; i += 1) {
    const tall = 2.5 + rand() * 3.5;
    const lean = (rand() - 0.5) * 3;
    const x = 2 + Math.abs(lean) + rand() * (size - 4 - 2 * Math.abs(lean));
    const y = 2 + tall + rand() * (size - 4 - tall);
    const b = blade(x, y, tall, lean);
    if (rand() < 0.6) shade += b;
    else light += b;
  }
  return { size, shade, light };
}

/**
 * Grass's turf: two tiles of fine blades laid over its fill, sized so their repeats rarely line up (44 and 68 px),
 * which hides the grid on a large lawn. A lawn of any size paints these same few strokes through an SVG pattern.
 */
export const GRASS_TILES: readonly GrassTile[] = [turf(44, 26, 3), turf(68, 40, 11)];

/**
 * Grass's mottling: a large tile of soft patches, lighter where the grass is lush and darker where it is thick, so a
 * lawn reads as grown rather than flat. Ellipses as path data, one path a tone.
 */
export const GRASS_MOTTLE = (() => {
  const size = 220;
  const rand = seeded(23);
  let lush = '';
  let thick = '';
  for (let i = 0; i < 14; i += 1) {
    const rx = 22 + rand() * 34;
    const ry = rx * (0.4 + rand() * 0.25);
    const cx = rx + rand() * (size - 2 * rx);
    const cy = ry + rand() * (size - 2 * ry);
    const e = `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`;
    if (i % 2 === 0) lush += e;
    else thick += e;
  }
  return { size, lush, thick };
})();

/** How the turf is painted over the lawn's fill: tints, so they suit any fill and either paper. */
export const GRASS_BLADES = {
  shade: '#0f3d1e',
  shadeOpacity: 0.32,
  light: '#f0fdf4',
  lightOpacity: 0.22,
  width: 0.9,
  // The mottling's tints.
  lushOpacity: 0.035,
  thickOpacity: 0.045,
  // The light across the lawn: brighter at its far edge, deeper toward you.
  topLight: 0.1,
  bottomShade: 0.14,
  // The lawn's edge: a darker rim so a patch reads against the floor round it.
  rimOpacity: 0.35,
  rimWidth: 2,
} as const;
