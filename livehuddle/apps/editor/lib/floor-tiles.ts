// The floors a Space's canvas wears (docs/specs/011-theme/floors.md), each one small SVG tile in its own colours, a
// light and a dark version. A floor is a material, so it brings its colours (grass is green, oak is honey) instead of
// inking the theme's pattern colour; it stays quiet (a few percent of lightness between its tones) so pieces, avatars
// and text read on top of it. Every tile is seamless: anything that crosses an edge is drawn again on the far side,
// or the edge is a joint (a slab, a tile, a plank's end) where a break belongs.
//
// The tiles are built on first use and cached, two per floor at most, so a pan or zoom frame builds nothing; the
// canvas only changes the CSS background's size and position, as it does for every pattern.
import type { FloorPattern } from '@livehuddle/document';

/** One floor tile: its size in canvas px and its SVG content, raw `#` colours. */
export type FloorTile = { w: number; h: number; inner: string };

// Seeded, so a floor draws the same on every machine and every load.
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (n: number): string => String(Math.round(n * 10) / 10);

// A point and its copies across whichever edges a shape of reach `e` around it crosses.
function wraps(x: number, y: number, e: number, w: number, h: number): [number, number][] {
  const xs = [x];
  if (x < e) xs.push(x + w);
  if (x > w - e) xs.push(x - w);
  const ys = [y];
  if (y < e) ys.push(y + h);
  if (y > h - e) ys.push(y - h);
  return xs.flatMap((a) => ys.map((b): [number, number] => [a, b]));
}

const fill = (d: string, colour: string, opacity = 1): string =>
  `<path d='${d}' fill='${colour}'${opacity < 1 ? ` fill-opacity='${opacity}'` : ''}/>`;
const line = (d: string, colour: string, width: number): string =>
  `<path d='${d}' fill='none' stroke='${colour}' stroke-width='${width}' stroke-linecap='round'/>`;
const box = (x: number, y: number, w: number, h: number, colour: string, rx = 0): string =>
  `<rect x='${n1(x)}' y='${n1(y)}' width='${n1(w)}' height='${n1(h)}'${rx ? ` rx='${rx}'` : ''} fill='${colour}'/>`;

// `count` tiny squares scattered over the tile, as one path.
function specks(rand: () => number, count: number, w: number, h: number, size: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = n1(size * (0.6 + rand() * 0.8));
    for (const [a, b] of wraps(x, y, size, w, h)) d += `M${n1(a)} ${n1(b)}h${s}v${s}h-${s}z`;
  }
  return d;
}

// `count` soft ellipses, as one path, for mottling.
function blots(
  rand: () => number,
  count: number,
  w: number,
  h: number,
  r: [number, number],
): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rx = r[0] + rand() * (r[1] - r[0]);
    const ry = rx * (0.5 + rand() * 0.4);
    for (const [a, b] of wraps(x, y, rx, w, h))
      d += `M${n1(a - rx)} ${n1(b)}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} 0 1 0 -${n1(2 * rx)} 0z`;
  }
  return d;
}

const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]!;

// A row of boards (planks, decking) `len` long, joints shifted by `offset`, wrapped across the tile's width.
function boards(
  rand: () => number,
  w: number,
  y: number,
  h: number,
  len: number,
  offset: number,
  tones: readonly string[],
  grain: string,
): { boards: string; grain: string; joints: string } {
  let out = '';
  let grains = '';
  let joints = '';
  for (let x0 = offset; x0 < offset + w; x0 += len) {
    const tone = pick(rand, tones);
    // A board that runs off the right edge carries on from the left.
    const at = x0 + len > w ? [x0, x0 - w] : [x0];
    for (let g = 0; g < 2; g++) {
      const gy = y + h * (0.3 + 0.4 * g) + (rand() - 0.5) * 2;
      const bend = (rand() - 0.5) * 3;
      for (const x of at)
        grains += `M${n1(x + 6)} ${n1(gy)}q${n1(len * 0.45)} ${n1(bend)} ${n1(len - 12)} ${n1(bend * 0.4)}`;
    }
    for (const x of at) out += box(x, y, len, h, tone);
    joints += `M${n1(x0 % w)} ${n1(y)}v${n1(h)}`;
  }
  return { boards: out, grain: line(grains, grain, 0.6), joints };
}

type Palette = Record<string, string>;
type FloorDraw = {
  w: number;
  h: number;
  light: Palette;
  dark: Palette;
  draw: (c: Palette) => string;
};

const FLOORS: Record<FloorPattern, FloorDraw> = {
  // Soft cut-pile: flecks of a darker, a mid and a lighter yarn.
  carpet: {
    w: 64,
    h: 64,
    light: { base: '#e9e4dc', dk: '#dad3c7', md: '#e1dacf', lt: '#f4f1eb' },
    dark: { base: '#2b2926', dk: '#232120', md: '#302d2a', lt: '#37342f' },
    draw: (c) => {
      const r = seeded(11);
      return (
        box(0, 0, 64, 64, c.base!) +
        fill(specks(r, 110, 64, 64, 1.2), c.dk!) +
        fill(specks(r, 70, 64, 64, 1.1), c.md!) +
        fill(specks(r, 80, 64, 64, 1), c.lt!)
      );
    },
  },
  // Office carpet tiles quarter-turned, so the pile runs across one and down the next.
  'carpet-tiles': {
    w: 96,
    h: 96,
    light: { a: '#e4e7ea', b: '#e0e4e8', la: '#dfe2e6', lb: '#dbdfe3', seam: '#d4d9df' },
    dark: { a: '#262a2f', b: '#24282d', la: '#2a2e33', lb: '#212529', seam: '#1c1f23' },
    draw: (c) => {
      let s = '';
      let across = '';
      let down = '';
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const turned = (i + j) % 2 === 1;
          s += box(i * 48, j * 48, 48, 48, turned ? c.b! : c.a!);
          for (let k = 2; k < 48; k += 4) {
            if (turned) down += `M${i * 48 + k} ${j * 48 + 2}v44`;
            else across += `M${i * 48 + 2} ${j * 48 + k}h44`;
          }
        }
      return (
        s +
        line(across, c.la!, 0.8) +
        line(down, c.lb!, 0.8) +
        `<path d='M0 0.5H96M0 48.5H96M0.5 0V96M48.5 0V96' stroke='${c.seam}' stroke-width='1'/>`
      );
    },
  },
  // Oak planks in staggered rows, two grain lines each.
  wood: {
    w: 240,
    h: 100,
    light: { t1: '#e9d9c1', t2: '#e5d3b8', t3: '#ecdec9', grain: '#dcc8a8', seam: '#cfb894' },
    dark: { t1: '#3b3026', t2: '#362b22', t3: '#403429', grain: '#2f261e', seam: '#231b14' },
    draw: (c) => {
      const r = seeded(23);
      const offsets = [0, 72, 24, 96, 48];
      let out = '';
      let grain = '';
      let joints = '';
      offsets.forEach((o, row) => {
        const b = boards(r, 240, row * 20, 20, 120, o, [c.t1!, c.t2!, c.t3!], c.grain!);
        out += b.boards;
        grain += b.grain;
        joints += b.joints + `M0 ${row * 20 + 0.4}H240`;
      });
      return out + grain + line(joints, c.seam!, 0.8);
    },
  },
  // Basketweave parquet: squares of three blocks, each square turned against its neighbours.
  parquet: {
    w: 72,
    h: 72,
    light: { t1: '#e7d7bd', t2: '#e4d3b8', t3: '#eadbc3', grain: '#ddcaab', seam: '#d2bc99' },
    dark: { t1: '#3d3127', t2: '#382c22', t3: '#42362b', grain: '#30271f', seam: '#241b14' },
    draw: (c) => {
      const r = seeded(31);
      let out = '';
      let grain = '';
      let seams = '';
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x = i * 36;
          const y = j * 36;
          const turned = (i + j) % 2 === 1;
          for (let k = 0; k < 3; k++) {
            const tone = pick(r, [c.t1!, c.t2!, c.t3!]);
            if (turned) {
              out += box(x + k * 12, y, 12, 36, tone);
              grain += `M${n1(x + k * 12 + 5 + r() * 2)} ${y + 4}v28`;
              seams += `M${x + k * 12 + 0.4} ${y}v36`;
            } else {
              out += box(x, y + k * 12, 36, 12, tone);
              grain += `M${x + 4} ${n1(y + k * 12 + 5 + r() * 2)}h28`;
              seams += `M${x} ${y + k * 12 + 0.4}h36`;
            }
          }
        }
      return out + line(grain, c.grain!, 0.6) + line(seams, c.seam!, 0.8);
    },
  },
  // Square ceramic tiles, each a touch different, on fine grout.
  tiles: {
    w: 144,
    h: 144,
    light: { grout: '#dadddb', t1: '#eff1ee', t2: '#edefec', t3: '#f1f2f0' },
    dark: { grout: '#202326', t1: '#2a2e32', t2: '#292d31', t3: '#2c3034' },
    draw: (c) => {
      const r = seeded(41);
      let out = box(0, 0, 144, 144, c.grout!);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          out += box(i * 48 + 0.75, j * 48 + 0.75, 46.5, 46.5, pick(r, [c.t1!, c.t2!, c.t3!]), 1);
      return out;
    },
  },
  // Book-matched marble slabs: fine, wandering veins over a softer cloud of them, slab joints at the edges.
  marble: {
    w: 192,
    h: 192,
    light: {
      base: '#f2f1ee',
      soft: '#ebe9e5',
      vein: '#d3d0c9',
      faint: '#e0ddd8',
      joint: '#dcd9d3',
    },
    dark: { base: '#26282c', soft: '#2b2d31', vein: '#45494f', faint: '#34373b', joint: '#1c1e21' },
    draw: (c) => {
      const main = 'M-4 34C14 44 30 34 50 46S82 54 100 62S124 76 136 92S166 112 196 141';
      const branch = 'M106 65C118 86 108 104 118 124S120 168 131 196';
      const minor = 'M-4 152C16 144 30 160 50 152S84 166 104 168';
      const hair = 'M40 0C46 12 40 20 44 30M150 104C166 96 180 100 196 96M62 50C56 70 70 84 62 106';
      return (
        box(0, 0, 192, 192, c.base!) +
        line(main + branch + minor, c.soft!, 3.5) +
        line(main, c.vein!, 0.8) +
        line(branch + minor + hair, c.faint!, 0.7) +
        `<path d='M0 0.5H192M0.5 0V192' stroke='${c.joint}' stroke-width='1'/>`
      );
    },
  },
  // Terrazzo: chips of stone, brick and sage set in a pale ground.
  terrazzo: {
    w: 120,
    h: 120,
    light: { base: '#efece6', c1: '#d2ccc2', c2: '#dfc3b2', c3: '#c3cdbb', c4: '#aeaba5' },
    dark: { base: '#2a2928', c1: '#3c3b39', c2: '#4a3d36', c3: '#38413a', c4: '#4f4d4a' },
    draw: (c) => {
      const r = seeded(53);
      const chips: Record<string, string> = { c1: '', c2: '', c3: '', c4: '' };
      const kinds = ['c1', 'c1', 'c2', 'c3', 'c3', 'c4'];
      for (let i = 0; i < 70; i++) {
        const x = r() * 120;
        const y = r() * 120;
        const size = 1.4 + r() * 2.8;
        const turn = r() * Math.PI;
        const kind = pick(r, kinds);
        const points = [0, 1, 2, 3].map((k) => {
          const a = turn + (k * Math.PI) / 2 + (r() - 0.5) * 0.8;
          const rr = size * (0.6 + r() * 0.5);
          return [Math.cos(a) * rr, Math.sin(a) * rr] as const;
        });
        for (const [a, b] of wraps(x, y, size * 1.2, 120, 120))
          chips[kind] += `M${points.map(([px, py]) => `${n1(a + px)} ${n1(b + py)}`).join('L')}z`;
      }
      return (
        box(0, 0, 120, 120, c.base!) +
        Object.entries(chips)
          .map(([k, d]) => fill(d, c[k]!))
          .join('')
      );
    },
  },
  // Polished concrete: soft mottling and fine aggregate, saw-cut joints between slabs.
  concrete: {
    w: 240,
    h: 240,
    light: {
      base: '#e3e2df',
      lt: '#e7e6e3',
      dk: '#dfdedb',
      s1: '#d5d4d0',
      s2: '#ecebe8',
      joint: '#d0cecb',
    },
    dark: {
      base: '#2a2b2d',
      lt: '#2d2e30',
      dk: '#27282a',
      s1: '#323336',
      s2: '#232426',
      joint: '#1c1d1f',
    },
    draw: (c) => {
      const r = seeded(61);
      return (
        box(0, 0, 240, 240, c.base!) +
        fill(blots(r, 12, 240, 240, [18, 44]), c.lt!, 0.6) +
        fill(blots(r, 12, 240, 240, [14, 36]), c.dk!, 0.6) +
        fill(specks(r, 140, 240, 240, 1), c.s1!) +
        fill(specks(r, 90, 240, 240, 1), c.s2!) +
        `<path d='M0 0.5H240M0.5 0V240' stroke='${c.joint}' stroke-width='1'/>`
      );
    },
  },
  // Outdoor decking: boards with dark gaps between them and screw heads over the joists.
  deck: {
    w: 240,
    h: 96,
    light: {
      gap: '#bfad90',
      t1: '#ddccb3',
      t2: '#d8c6ab',
      t3: '#e1d1ba',
      grain: '#d0bd9f',
      screw: '#bfab8c',
    },
    dark: {
      gap: '#1e1915',
      t1: '#3a3129',
      t2: '#352d25',
      t3: '#3e352c',
      grain: '#2f2821',
      screw: '#4c4238',
    },
    draw: (c) => {
      const r = seeded(71);
      let out = box(0, 0, 240, 96, c.gap!);
      let grain = '';
      let joints = '';
      let screws = '';
      [0, 160, 80, 40].forEach((o, row) => {
        const y = row * 24 + 1.5;
        const b = boards(r, 240, y, 21, 240, o, [c.t1!, c.t2!, c.t3!], c.grain!);
        out += b.boards;
        grain += b.grain;
        joints += b.joints;
        for (const sx of [40, 160])
          screws += `M${sx} ${y + 5}h1.6v1.6h-1.6zM${sx} ${y + 14.4}h1.6v1.6h-1.6z`;
      });
      return out + grain + line(joints, c.gap!, 1.5) + fill(screws, c.screw!);
    },
  },
  // Flagstones of mixed sizes in coursed rows, a fine grain over the stone.
  paving: {
    w: 192,
    h: 144,
    light: {
      mortar: '#cdc9c1',
      t1: '#dfdcd5',
      t2: '#dad7cf',
      t3: '#e2dfd9',
      t4: '#d7d3cb',
      grain: '#d0ccc4',
    },
    dark: {
      mortar: '#242528',
      t1: '#343539',
      t2: '#313236',
      t3: '#37383c',
      t4: '#2f3034',
      grain: '#2b2c2f',
    },
    draw: (c) => {
      const r = seeded(83);
      const rows: [number, number, number[], number][] = [
        [0, 48, [72, 56, 64], 0],
        [48, 40, [48, 80, 64], 30],
        [88, 56, [64, 72, 56], 58],
      ];
      let out = box(0, 0, 192, 144, c.mortar!);
      for (const [y, h, widths, offset] of rows) {
        let x = offset;
        for (const width of widths) {
          const tone = pick(r, [c.t1!, c.t2!, c.t3!, c.t4!]);
          for (const sx of x + width > 192 ? [x, x - 192] : [x])
            if (sx < 192) out += box(sx + 1.25, y + 1.25, width - 2.5, h - 2.5, tone, 1.5);
          x += width;
        }
      }
      return out + fill(specks(r, 120, 192, 144, 1), c.grain!);
    },
  },
  // Cobbles in running rows, each with a soft highlight so it reads as rounded.
  cobbles: {
    w: 144,
    h: 96,
    light: {
      mortar: '#d0cbc2',
      t1: '#dfdbd3',
      t2: '#dad5cc',
      t3: '#e2ded7',
      t4: '#d6d1c7',
      hi: '#e5e2dc',
    },
    dark: {
      mortar: '#242527',
      t1: '#343538',
      t2: '#313235',
      t3: '#37383b',
      t4: '#2f3033',
      hi: '#3a3b3e',
    },
    draw: (c) => {
      const r = seeded(97);
      let out = box(0, 0, 144, 96, c.mortar!);
      let highlights = '';
      for (let row = 0; row < 4; row++) {
        const y = row * 24;
        for (let k = 0; k < 4; k++) {
          const x = k * 36 + (row % 2) * 18;
          const tone = pick(r, [c.t1!, c.t2!, c.t3!, c.t4!]);
          const jx = (r() - 0.5) * 1.5;
          for (const sx of x + 34 > 144 ? [x, x - 144] : [x]) {
            out += box(sx + 1.5 + jx, y + 1.5, 33, 21, tone, 8);
            highlights += `M${n1(sx + 9 + jx)} ${y + 8}h14`;
          }
        }
      }
      return out + line(highlights, c.hi!, 5);
    },
  },
  // A lawn: short blades in three greens over a few lighter patches.
  grass: {
    w: 96,
    h: 96,
    light: { base: '#d8e6c6', patch: '#dce9cc', b1: '#c7daaf', b2: '#e4eed6', b3: '#bdd2a2' },
    dark: { base: '#1f2b1f', patch: '#212e21', b1: '#283828', b2: '#1a241a', b3: '#2e3f2c' },
    draw: (c) => {
      const r = seeded(101);
      const blades: Record<string, string> = { b1: '', b2: '', b3: '' };
      for (let i = 0; i < 320; i++) {
        const x = r() * 96;
        const y = r() * 96;
        const dx = (r() - 0.5) * 3;
        const len = 2.5 + r() * 2.5;
        const kind = pick(r, ['b1', 'b1', 'b2', 'b3']);
        for (const [a, b] of wraps(x, y, 6, 96, 96))
          blades[kind] += `M${n1(a)} ${n1(b)}l${n1(dx)} -${n1(len)}`;
      }
      return (
        box(0, 0, 96, 96, c.base!) +
        fill(blots(r, 8, 96, 96, [8, 18]), c.patch!, 0.5) +
        Object.entries(blades)
          .map(([k, d]) => line(d, c[k]!, 0.9))
          .join('')
      );
    },
  },
  // Wind-rippled sand, each ripple with a lit edge, and a scatter of grains.
  sand: {
    w: 120,
    h: 120,
    light: { base: '#efe5d1', ripple: '#e3d6bd', lit: '#f6efe1', grain: '#ddcfb4' },
    dark: { base: '#2f2a21', ripple: '#28231a', lit: '#373127', grain: '#3b3529' },
    draw: (c) => {
      const r = seeded(113);
      let ripples = '';
      let lit = '';
      for (let row = 0; row < 8; row++) {
        const y = row * 15 + 7;
        const shift = (row * 23) % 60;
        const wave = (dy: number) =>
          `M${-60 + shift} ${y + dy}q15 -4.5 30 0t30 0t30 0t30 0t30 0t30 0`;
        ripples += wave(0);
        lit += wave(1.4);
      }
      return (
        box(0, 0, 120, 120, c.base!) +
        line(lit, c.lit!, 1) +
        line(ripples, c.ripple!, 1.2) +
        fill(specks(r, 150, 120, 120, 0.9), c.grain!)
      );
    },
  },
  // Bare trodden earth: darker and lighter patches, small pebbles, fine grit.
  mud: {
    w: 128,
    h: 128,
    light: { base: '#ddd0bf', dk: '#d6c8b5', lt: '#e2d7c8', pebble: '#c8b7a0', grit: '#d0c2ad' },
    dark: { base: '#2c251e', dk: '#28221b', lt: '#302821', pebble: '#3e342a', grit: '#352d25' },
    draw: (c) => {
      const r = seeded(127);
      return (
        box(0, 0, 128, 128, c.base!) +
        fill(blots(r, 10, 128, 128, [10, 24]), c.dk!, 0.55) +
        fill(blots(r, 8, 128, 128, [8, 18]), c.lt!, 0.55) +
        fill(blots(r, 22, 128, 128, [1, 2.4]), c.pebble!) +
        fill(specks(r, 120, 128, 128, 1), c.grit!)
      );
    },
  },
};

const cache = new Map<string, FloorTile>();

/** A floor's tile in its light or dark version. Built once per floor and version. */
export function floorTile(floor: FloorPattern, dark: boolean): FloorTile {
  const key = `${floor}:${dark ? 'd' : 'l'}`;
  let tile = cache.get(key);
  if (!tile) {
    const spec = FLOORS[floor];
    tile = { w: spec.w, h: spec.h, inner: spec.draw(dark ? spec.dark : spec.light) };
    cache.set(key, tile);
  }
  return tile;
}

/** Whether a canvas colour is dark, so the floor on it takes its dark version. A colour this cannot read (a name,
 *  an rgb() function) counts as light, the canvas's usual half. */
export function isDarkCanvas(colour: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!m) return false;
  const hex = m[1]!.length === 3 ? [...m[1]!].map((ch) => ch + ch).join('') : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}
