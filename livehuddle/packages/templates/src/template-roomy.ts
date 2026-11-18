// Roomier templates (docs/specs/007-editor/templates-by-mode.md "Room to move"): the owner, 2026-11-18, "in templates
// rooms should generally be bigger and less cramped". Every Space's plan is drawn at its old size and then opened out
// here, one rule for all of them, so no builder carries its own spacing: the rooms, corridors and lawns grow by
// TEMPLATE_ROOMY about the template's centre, and the furniture keeps its size, moved as groups (a desk and its
// chair, a sofa on its rug never come apart). A group near a wall keeps its distance from that wall (a counter, a
// board, a Door stay on it); one out in the floor keeps its place as a share of the room. Pure: no React, no DOM.

import type { Element } from '@livehuddle/document';

/** How much bigger a template's rooms are than the plan it was drawn at. */
export const TEMPLATE_ROOMY = 1.25;
/** How close two pieces stand to move together, in canvas px. */
const GROUP_GAP = 16;
/** How near a wall a group stands to keep its distance from it, in canvas px. */
const NEAR_WALL = 64;

type Box = { x: number; y: number; width: number; height: number };
type Boxed = Element & Box;

// The plan's structure: what grows. A Room, a Corridor and a lawn grow both ways; a Garden Path or a Fence (thin)
// grows along its length only.
const GROWS = new Set(['room', 'corridor', 'grass', 'garden-path', 'garden-fence', 'car-park']);
// What a group can stand in, the smallest first.
const HOLDS = new Set(['room', 'corridor', 'grass', 'car-park']);
// What belongs to a wall on its own, never grouped with the furniture beside it.
const ON_A_WALL = new Set([
  'door',
  'window',
  // What hangs on a wall in the 3D view (3d-view.md "Wall pieces hang on the wall").
  'notice-board',
  'world-clock',
  'dartboard',
  'calendar-wall',
  'photo-wall',
  'hand-dryer',
  'screen',
  'room-sign',
]);
const THIN = 40;
// What stands against a wall: drawn to stand on its foot with its back to the wall (a counter, a bookshelf, lockers).
const AGAINST_A_WALL = new Set([
  'kitchen-counter',
  'kitchen-sink',
  'fridge',
  'drinks-fridge',
  'drinks-cabinet',
  'bookshelf',
  'lockers',
  'fireplace',
  'vending-machine',
  'arcade-machine',
  'jukebox',
  'coat-rack',
  'umbrella-stand',
  'copier',
  'printer',
]);
// What follows another piece rather than its room: a Room Sign its Door, Bring Focus its stage.
const FOLLOWS: Record<string, string> = { 'room-sign': 'door', 'focus-button': 'stage' };
// What stands on a counter, and a pet's bed by the fire.
const ON_A_COUNTER = new Set(['microwave', 'kettle', 'coffee-machine', 'pet-bed']);
// Two wall pieces in one run along a wall (a counter and a sink at one height) stay in line however far apart.
function oneRun(a: Boxed, b: Boxed): boolean {
  const ka = shapeOf(a);
  const kb = shapeOf(b);
  if (!ka || !kb || !AGAINST_A_WALL.has(ka) || !AGAINST_A_WALL.has(kb)) return false;
  return Math.abs(a.y - b.y) < 1 || Math.abs(a.y + a.height - (b.y + b.height)) < 1;
}

function togetherAtAWall(a: string | null, b: string | null): boolean {
  const wa = !!a && AGAINST_A_WALL.has(a);
  const wb = !!b && AGAINST_A_WALL.has(b);
  if (!wa && !wb) return true;
  const fits = (k: string | null) => !!k && (AGAINST_A_WALL.has(k) || ON_A_COUNTER.has(k));
  return fits(a) && fits(b);
}

/** How far from a wall a wall piece may stand and be pushed back onto it, in canvas px. */
const PUSH_REACH = 200;
/** How far out a wall piece stands and still counts as against its wall, in canvas px. */
const PUSH_FROM = 96;
// A back wall's face is drawn this deep (ROOM_BACK_FACE); a side or front wall is half a wall (ROOM_WALL / 2) in.
const BACK_FACE = 36;
const SIDE_IN = 5;
// The gap a wall piece is pushed to: just off the wall.
const PUSH_GAP = 2;

const shapeOf = (el: Element): string | null =>
  el.type === 'shape' ? (el as { shape: string }).shape : null;
const isBoxed = (el: Element): el is Boxed =>
  typeof (el as Partial<Box>).x === 'number' && typeof (el as Partial<Box>).width === 'number';

function grow(b: Box, cx: number, cy: number, k: number): Box {
  const thinW = b.width < THIN && b.height >= THIN;
  const thinH = b.height < THIN && b.width >= THIN;
  const width = thinW ? b.width : b.width * k;
  const height = thinH ? b.height : b.height * k;
  const mx = cx + (b.x + b.width / 2 - cx) * k;
  const my = cy + (b.y + b.height / 2 - cy) * k;
  return { x: mx - width / 2, y: my - height / 2, width, height };
}

// Where a group's edge goes along one axis of its room: kept off the near wall, else its centre at its share.
function along(
  lo: number,
  size: number,
  from: [number, number],
  to: [number, number],
  // Where the group's biggest piece starts within it, and its size.
  bigAt = 0,
  bigSize = size,
): number {
  const [a, len] = from;
  const [b, len2] = to;
  const dLo = lo - a;
  const dHi = a + len - (lo + size);
  if (dLo <= NEAR_WALL) return b + dLo;
  if (dHi <= NEAR_WALL) return b + len2 - dHi - size;
  const mid = lo + bigAt + bigSize / 2;
  return b + ((mid - a) / len) * len2 - bigAt - bigSize / 2;
}

const near = (a: Box, b: Box) =>
  a.x <= b.x + b.width + GROUP_GAP &&
  b.x <= a.x + a.width + GROUP_GAP &&
  a.y <= b.y + b.height + GROUP_GAP &&
  b.y <= a.y + a.height + GROUP_GAP;
const area = (b: Box) => b.width * b.height;
const holds = (r: Box, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** The template's elements opened out by `k` about (cx, cy): rooms bigger, furniture its size, groups kept together. */
export function roomier(
  elements: Element[],
  cx: number,
  cy: number,
  k = TEMPLATE_ROOMY,
): Element[] {
  const out = elements.slice();
  const grown = new Map<number, { from: Box; to: Box }>();
  elements.forEach((el, i) => {
    const kind = shapeOf(el);
    if (!kind || !GROWS.has(kind) || !isBoxed(el)) return;
    const to = grow(el, cx, cy, k);
    grown.set(i, { from: el, to });
    out[i] = { ...el, ...to };
  });
  // A plan with no rooms or lawns (a Blank Space's lone pad) is left as drawn.
  if (grown.size === 0) return elements;
  const holders = [...grown.entries()]
    .filter(([i]) => HOLDS.has(shapeOf(elements[i]!)!))
    .map(([, g]) => g)
    .sort((a, b) => area(a.from) - area(b.from));
  const holderOf = (b: Box) =>
    holders.find((h) => holds(h.from, b.x + b.width / 2, b.y + b.height / 2)) ?? null;
  // The title, sticker and description over the plan (above every room and lawn) move as one, never tied to what
  // stands beside the rooms (the Team Pod's Team Board, which the description's line once dragged along with it).
  const planTop = Math.min(...holders.map((h) => h.from.y));
  const above = (b: Box) => b.y + b.height <= planTop;
  // The furniture's groups: pieces standing within GROUP_GAP of each other in the same room.
  const loose = elements.map((_, i) => i).filter((i) => !grown.has(i) && isBoxed(elements[i]!));
  const parent = new Map<number, number>(loose.map((i) => [i, i]));
  const find = (i: number): number => {
    let r = i;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(i, r);
    return r;
  };
  const home = new Map(loose.map((i) => [i, holderOf(elements[i] as Boxed)]));
  for (let a = 0; a < loose.length; a++) {
    const ia = loose[a]!;
    if (ON_A_WALL.has(shapeOf(elements[ia]!) ?? '')) continue;
    for (let b = a + 1; b < loose.length; b++) {
      const ib = loose[b]!;
      if (ON_A_WALL.has(shapeOf(elements[ib]!) ?? '')) continue;
      if (home.get(ia) !== home.get(ib)) continue;
      if (above(elements[ia] as Boxed) !== above(elements[ib] as Boxed)) continue;
      // A wall piece moves with what stands on it or beside it along the wall (a microwave on a counter, a sink
      // beside it), never with the floor's furniture in front of it.
      if (!togetherAtAWall(shapeOf(elements[ia]!), shapeOf(elements[ib]!))) continue;
      if (
        near(elements[ia] as Boxed, elements[ib] as Boxed) ||
        oneRun(elements[ia] as Boxed, elements[ib] as Boxed)
      )
        parent.set(find(ia), find(ib));
    }
  }
  const groups = new Map<number, number[]>();
  for (const i of loose) {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }

  const placed: { members: number[]; room: Box | null }[] = [];
  const signs: number[] = [];
  for (const members of groups.values()) {
    // A Room Sign by a door goes where that door goes, Bring Focus where its stage goes, below.
    if (members.length === 1 && FOLLOWS[shapeOf(elements[members[0]!]!) ?? ''] !== undefined) {
      signs.push(members[0]!);
      continue;
    }
    const boxes = members.map((i) => elements[i] as Boxed);
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.width));
    const y1 = Math.max(...boxes.map((b) => b.y + b.height));
    const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    const h = home.get(members[0]!) ?? null;
    // Out in the floor, a group keeps its biggest piece's share of the room (a stage centred in its hall stays so).
    const big = boxes.reduce((a, b) => (area(b) > area(a) ? b : a));
    let nx: number;
    let ny: number;
    if (h) {
      nx = along(
        box.x,
        box.width,
        [h.from.x, h.from.width],
        [h.to.x, h.to.width],
        big.x - box.x,
        big.width,
      );
      ny = along(
        box.y,
        box.height,
        [h.from.y, h.from.height],
        [h.to.y, h.to.height],
        big.y - box.y,
        big.height,
      );
    } else {
      nx = cx + (box.x + box.width / 2 - cx) * k - box.width / 2;
      ny = cy + (box.y + box.height / 2 - cy) * k - box.height / 2;
    }
    shift(out, members, nx - box.x, ny - box.y);
    placed.push({ members, room: h?.to ?? null });
  }
  // Each Room Sign keeps its place beside the Door nearest it (it names the room that door opens; Work Tracker 638),
  // and Bring Focus its place by the stage.
  for (const i of signs) {
    const sign = elements[i] as Boxed;
    const leaders = loose.filter((j) => shapeOf(elements[j]!) === FOLLOWS[shapeOf(sign)!]);
    const at = nearest(
      sign,
      leaders.map((d) => elements[d] as Boxed),
    );
    const d = at === null ? null : leaders[at]!;
    if (d === null) {
      shift(
        out,
        [i],
        (sign.x + sign.width / 2 - cx) * (k - 1),
        (sign.y + sign.height / 2 - cy) * (k - 1),
      );
    } else {
      const was = elements[d] as Boxed;
      const now = out[d] as Boxed;
      shift(out, [i], now.x - was.x, now.y - was.y);
    }
  }
  const solid = solidOf(out);
  // A sign moved with its door keeps off a path that grew under it.
  const paths = new Set(out.flatMap((el, i) => (shapeOf(el) === 'garden-path' ? [i] : [])));
  for (const g of placed) if (g.room) pushToWall(out, g.members, g.room, solid);
  for (const g of placed) settle(out, g.members, g.room, solid);
  for (const i of signs) settle(out, [i], null, new Set([...solid, ...paths]), true);
  return out;
}

function shift(out: Element[], members: readonly number[], dx: number, dy: number) {
  if (dx === 0 && dy === 0) return;
  for (const i of members) {
    const el = out[i] as Boxed;
    out[i] = { ...el, x: el.x + dx, y: el.y + dy } as Element;
  }
}

function nearest(b: Box, others: Box[]): number | null {
  let best: number | null = null;
  let bestD = 640;
  others.forEach((o, i) => {
    const d = Math.hypot(
      o.x + o.width / 2 - (b.x + b.width / 2),
      o.y + o.height / 2 - (b.y + b.height / 2),
    );
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// The pieces that take up floor, which nothing else may stand on: not the floors, a Door, a Window or a Room Sign.
const FLOOR = new Set([
  'room',
  'corridor',
  'rug',
  'avatar-pad',
  'stage',
  'garden-path',
  'grass',
  'car-park',
]);
const NOT_SOLID = new Set(['door', 'window', 'room-sign', 'sticker']);
function solidOf(out: Element[]): Set<number> {
  const solid = new Set<number>();
  out.forEach((el, i) => {
    const kind = shapeOf(el);
    if (kind && !FLOOR.has(kind) && !NOT_SOLID.has(kind) && isBoxed(el)) solid.add(i);
  });
  return solid;
}
// What may overlap on purpose: a microwave or kettle on a worktop, a podium under the stage curtains.
function mayOverlap(a: string, b: string): boolean {
  const on = (x: string, y: string) =>
    (['microwave', 'kettle'].includes(x) && ['kitchen-counter', 'kitchen-sink'].includes(y)) ||
    (x === 'podium' && y === 'stage-curtains');
  return on(a, b) || on(b, a);
}
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Whether the group, moved by (dx, dy), would stand on anything else, or out of its room.
function blocked(
  out: Element[],
  members: readonly number[],
  dx: number,
  dy: number,
  room: Box | null,
  solid: ReadonlySet<number>,
  always = false,
): boolean {
  const mine = new Set(members);
  for (const i of members) {
    const el = out[i] as Boxed;
    const kind = shapeOf(el) ?? '';
    const at = { x: el.x + dx, y: el.y + dy, width: el.width, height: el.height };
    if (
      room &&
      solid.has(i) &&
      // Inside its walls, clear of their lines (half a wall in).
      (at.x < room.x + SIDE_IN ||
        at.y < room.y ||
        at.x + at.width > room.x + room.width - SIDE_IN ||
        at.y + at.height > room.y + room.height - SIDE_IN)
    )
      return true;
    if (!solid.has(i) && !always) continue;
    for (const j of solid) {
      if (mine.has(j)) continue;
      const other = out[j] as Boxed;
      if (overlaps(at, other) && !mayOverlap(kind, shapeOf(other) ?? '')) return true;
    }
  }
  return false;
}

// A group standing on something after the plan opened out slides to the nearest free spot, a few steps at most.
function settle(
  out: Element[],
  members: readonly number[],
  room: Box | null,
  solid: ReadonlySet<number>,
  // A sign is not itself solid, but keeps off what is.
  always = false,
) {
  if (!blocked(out, members, 0, 0, room, solid, always)) return;
  const STEP = 8;
  const REACH = 12;
  let best: [number, number] | null = null;
  // A sign slides along its wall first, so it stays on it.
  if (always)
    for (let r = 1; r <= REACH && !best; r++)
      for (const ix of [-r, r])
        if (!best && !blocked(out, members, ix * STEP, 0, room, solid, always))
          best = [ix * STEP, 0];
  for (let r = 1; r <= REACH && !best; r++)
    for (let ix = -r; ix <= r && !best; ix++)
      for (const iy of [-r, r, ...Array.from({ length: 2 * r - 1 }, (_, n) => n - r + 1)]) {
        if (Math.abs(ix) !== r && Math.abs(iy) !== r) continue;
        if (!blocked(out, members, ix * STEP, iy * STEP, room, solid, always)) {
          best = [ix * STEP, iy * STEP];
          break;
        }
      }
  if (best) shift(out, members, best[0], best[1]);
}

// The box a piece covers on the plan: a quarter-turned one's sides swapped about its centre.
function seen(b: Boxed): Box {
  const r = ((((b as { rotation?: number }).rotation ?? 0) % 180) + 180) % 180;
  if (r !== 90) return b;
  return {
    x: b.x + b.width / 2 - b.height / 2,
    y: b.y + b.height / 2 - b.width / 2,
    width: b.height,
    height: b.width,
  };
}

// A group with a wall piece in it is pushed back so that piece stands against its nearest wall (the owner, 2026-11-18:
// pieces "often floating in the middle of a room"), unless it is far out in the floor, where it was put on purpose.
function pushToWall(out: Element[], members: number[], room: Box, solid: ReadonlySet<number>) {
  let best: { dx: number; dy: number; gap: number } | null = null;
  for (const i of members) {
    const kind = shapeOf(out[i]!);
    if (
      !kind ||
      (!AGAINST_A_WALL.has(kind) && !ON_A_WALL.has(kind)) ||
      kind === 'door' ||
      kind === 'window'
    )
      continue;
    const b = seen(out[i] as Boxed);
    const hangs = ON_A_WALL.has(kind);
    const sides = [
      { gap: b.y - (room.y + BACK_FACE), dx: 0, dy: -1 },
      // A hung piece hangs on the back wall or, its foot on it, the front wall (3d-view.md "hang across"); a standing
      // one stands against the back or a side wall, its face to the room, never the front wall with its back to you.
      ...(hangs
        ? [{ gap: room.y + room.height - SIDE_IN - (b.y + b.height), dx: 0, dy: 1 }]
        : [
            { gap: b.x - (room.x + SIDE_IN), dx: -1, dy: 0 },
            { gap: room.x + room.width - SIDE_IN - (b.x + b.width), dx: 1, dy: 0 },
          ]),
    ];
    for (const side of sides) {
      if (side.gap < -BACK_FACE || side.gap > PUSH_REACH) continue;
      const move = side.gap - PUSH_GAP;
      // Already against it: a counter run's foot in line with a tall fridge's stands a little out.
      if (side.gap <= PUSH_FROM) continue;
      if (!best || side.gap < best.gap)
        best = { dx: side.dx * move, dy: side.dy * move, gap: side.gap };
    }
  }
  if (!best) return;
  // As far toward the wall as it goes without standing on anything.
  const steps = 8;
  for (let n = steps; n > 0; n--) {
    const dx = (best.dx * n) / steps;
    const dy = (best.dy * n) / steps;
    if (!blocked(out, members, dx, dy, room, solid)) {
      shift(out, members, dx, dy);
      return;
    }
  }
}
