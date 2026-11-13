// A focused country's far land in insets (docs/specs/009-elements/map.md "What it shows"; blueprint "Insets"): the
// United States frames on its lower 48, and Alaska and Hawaii are drawn again, smaller, in the frame's lower left, as
// an atlas draws them, so a highlighted United States still shows every state. Pure: each inset is the country's own
// rings that lie in the inset's box, moved and scaled into the frame as one absolute SVG path in plane units, so the
// renderers draw it as any country (MapDrawing, svgMap). Each sits on a paper plate, so the faint land behind the frame's
// corner (Mexico) never runs into it.
import { projectLonLat, unprojectPoint } from './map-model';

type Box = readonly [number, number, number, number];

export type MapInsetDef = {
  // Names the inset among the country's (a React key, `data-map-inset`).
  part: string;
  // The plane box (x0, y0, x1, y1) its rings lie in, where the country's path draws them.
  box: Box;
  // Its size in the frame against the frame's own land: Alaska is drawn smaller, Hawaii a little larger.
  scale: number;
};

// The insets each country draws when it is the focus, left to right along the frame's foot (D-insets).
export const MAP_INSETS: Readonly<Record<string, readonly MapInsetDef[]>> = {
  US: [
    { part: 'AK', box: [540, 60, 940, 235], scale: 0.4 },
    { part: 'HI', box: [280, 640, 330, 700], scale: 1.5 },
  ],
};

// How far the insets sit in from the frame's lower left, how far apart, and how much paper each plate keeps round its
// land, as a share of the frame's width.
const INSET_MARGIN = 0.015;
const INSET_GAP = 0.015;
const INSET_PAD = 0.012;

/** One inset: its land, and the paper plate under it (a rounded box) that keeps the context land beneath out of it. */
export type MapInset = { part: string; d: string; plate: string };

type Ring = { points: [number, number][]; box: [number, number, number, number] };

/** The rings of a path written as the geometry writes them (`M x y l dx dy ... z m dx dy l ... z`) or as an inset
 *  is (`M x yLx y ... Z`), in absolute plane units. Read left to right, one number at a time. */
export function pathRings(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring | null = null;
  let start: [number, number] = [0, 0];
  let cmd = '';
  const nums: number[] = [];
  const flush = () => {
    if (cmd === 'M' || cmd === 'm') {
      const x = (cmd === 'm' ? start[0] : 0) + (nums[0] ?? 0);
      const y = (cmd === 'm' ? start[1] : 0) + (nums[1] ?? 0);
      start = [x, y];
      ring = { points: [[x, y]], box: [x, y, x, y] };
      rings.push(ring);
    } else if ((cmd === 'l' || cmd === 'L') && ring) {
      let [x, y] = ring.points[ring.points.length - 1]!;
      const relative = cmd === 'l';
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x = (relative ? x : 0) + nums[i]!;
        y = (relative ? y : 0) + nums[i + 1]!;
        ring.points.push([x, y]);
        ring.box[0] = Math.min(ring.box[0], x);
        ring.box[1] = Math.min(ring.box[1], y);
        ring.box[2] = Math.max(ring.box[2], x);
        ring.box[3] = Math.max(ring.box[3], y);
      }
    }
    nums.length = 0;
  };
  let token = '';
  const endToken = () => {
    if (token && token !== '-') nums.push(Number(token));
    token = '';
  };
  for (const ch of d) {
    if (ch === 'M' || ch === 'm' || ch === 'l' || ch === 'L' || ch === 'z' || ch === 'Z') {
      endToken();
      flush();
      cmd = ch === 'Z' ? 'z' : ch;
    } else if (ch === ' ' || ch === ',') endToken();
    else if (ch === '-') {
      endToken();
      token = '-';
    } else token += ch;
  }
  endToken();
  flush();
  return rings;
}

const inside = (b: Box, box: Box) =>
  b[0] >= box[0] && b[1] >= box[1] && b[2] <= box[2] && b[3] <= box[3];

const r1 = (n: number) => Math.round(n * 10) / 10;

// Insets by country and frame: the frame is fixed per country, so one entry each.
const made = new Map<string, MapInset[]>();

/** The focused country `code`'s insets in the frame `win` (plane units), from its path `d`. Empty for a country
 *  that has none. */
export function mapInsets(
  code: string,
  d: string,
  win: { x: number; y: number; w: number; h: number },
): MapInset[] {
  const defs = MAP_INSETS[code];
  if (!defs) return [];
  const key = `${code}|${r1(win.x)},${r1(win.y)},${r1(win.w)},${r1(win.h)}|${d.length}`;
  const hit = made.get(key);
  if (hit) return hit;
  const rings = pathRings(d);
  const out: MapInset[] = [];
  const pad = win.w * INSET_PAD;
  let x = win.x + win.w * INSET_MARGIN;
  const foot = win.y + win.h - win.w * INSET_MARGIN;
  for (const def of defs) {
    const own = rings.filter((r) => inside(r.box, def.box));
    if (own.length === 0) continue;
    // Re-projected about its own middle meridian, so far land sits upright rather than leaning as the world's
    // projection leans it near its edge.
    const mid = unprojectPoint((def.box[0] + def.box[2]) / 2, (def.box[1] + def.box[3]) / 2).lon;
    const upright = own.map((r) =>
      r.points.map(([px, py]) => {
        const { lon, lat } = unprojectPoint(px, py);
        return projectLonLat(lon - mid, lat);
      }),
    );
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of upright)
      for (const [px, py] of ring) {
        b[0] = Math.min(b[0]!, px);
        b[1] = Math.min(b[1]!, py);
        b[2] = Math.max(b[2]!, px);
        b[3] = Math.max(b[3]!, py);
      }
    const s = def.scale;
    const w = (b[2]! - b[0]!) * s;
    const h = (b[3]! - b[1]!) * s;
    const left = x + pad;
    const top = foot - pad - h;
    const at = ([px, py]: [number, number]) =>
      `${r1(left + (px - b[0]!) * s)} ${r1(top + (py - b[1]!) * s)}`;
    const path = upright.map((ring) => `M${ring.map(at).join('L')}Z`).join('');
    const plate = { x, y: top - pad, w: w + pad * 2, h: h + pad * 2 };
    out.push({ part: def.part, d: path, plate: platePath(plate, pad) });
    x += plate.w + win.w * INSET_GAP;
  }
  if (made.size >= 16) made.clear();
  made.set(key, out);
  return out;
}

// A rounded box as an absolute path, its corners `r` round.
function platePath(b: { x: number; y: number; w: number; h: number }, r: number): string {
  const { x, y, w, h } = b;
  const q = (n: number) => r1(n);
  return (
    `M${q(x + r)} ${q(y)}H${q(x + w - r)}Q${q(x + w)} ${q(y)} ${q(x + w)} ${q(y + r)}` +
    `V${q(y + h - r)}Q${q(x + w)} ${q(y + h)} ${q(x + w - r)} ${q(y + h)}` +
    `H${q(x + r)}Q${q(x)} ${q(y + h)} ${q(x)} ${q(y + h - r)}V${q(y + r)}Q${q(x)} ${q(y)} ${q(x + r)} ${q(y)}Z`
  );
}
