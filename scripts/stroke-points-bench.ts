// The stroke points bench (docs/specs/006-document/stroke-points.md "Measured wins"): a synthesised
// whiteboard shaped like the largest real board measured (3,300 pen strokes, 66,000 points, a
// pressure on every point), stored the former way (`{ nx, ny }` objects and a pressure list, full
// doubles) and packed, compared on tab bytes, parse time, objects allocated at load, first-draw
// time (whole board, and one viewport's worth) and accuracy. Data-free: everything is generated
// here from a fixed seed, so a run is reproducible and nothing personal is ever read.
//   pnpm bench:stroke-points
import {
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  createFreehand,
  decodeStrokePoints,
  freehandGeometry,
  migrateStoredTab,
  penStrokePath,
  penStrokeSvg,
  type Element,
  type FreehandElement,
} from '../packages/document/src/index';
import { clearStrokePointsCache } from '../packages/document/src/stroke-points-cache';

const STROKES = 3_300;
const POINTS = 66_000;
const BOARD = { width: 12_000, height: 8_000 };
const VIEWPORT = { x: 4_000, y: 3_000, width: 1_920, height: 1_080 };
const RUNS = 15;
// Cloudflare D1's row cap: one tab is one row.
const D1_MAX_ROW_BYTES = 2_000_000;

// Deterministic pseudo-random numbers (mulberry32), so every run draws the same board.
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Sample = { x: number; y: number; p: number };

// One hand-drawn stroke: a wandering line of `count` samples with a varying pressure.
function strokeSamples(next: () => number, count: number): Sample[] {
  const origin = { x: next() * BOARD.width, y: next() * BOARD.height };
  const step = 2 + next() * 10;
  let heading = next() * Math.PI * 2;
  let { x, y } = origin;
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    heading += (next() - 0.5) * 0.6;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    out.push({ x, y, p: 0.3 + 0.5 * Math.abs(Math.sin(i / 7 + next())) });
  }
  return out;
}

// The same strokes as the editor writes them now, and as it wrote them before packed points.
function boards() {
  const next = random(20_261_001);
  const perStroke = POINTS / STROKES;
  const samples: Sample[][] = [];
  for (let i = 0; i < STROKES; i++) {
    const count = Math.max(2, Math.round(perStroke * (0.3 + next() * 1.4)));
    samples.push(strokeSamples(next, count));
  }
  // Even the total out to exactly POINTS.
  let total = samples.reduce((n, s) => n + s.length, 0);
  for (let i = 0; total !== POINTS; i = (i + 1) % STROKES) {
    if (total < POINTS) {
      samples[i]!.push({ ...samples[i]!.at(-1)!, x: samples[i]!.at(-1)!.x + 3 });
      total++;
    } else if (samples[i]!.length > 2) {
      samples[i]!.pop();
      total--;
    }
  }
  const style = { penWidth: 2.5, streamline: 0.2, penColour: 'blue' as const };
  const packed: Element[] = [];
  const former: Record<string, unknown>[] = [];
  samples.forEach((s, i) => {
    const id = `stroke-${i.toString(36).padStart(4, '0')}-${'x'.repeat(28)}`;
    const raw = s.map(({ x, y }) => ({ x, y }));
    const pressures = s.map((q) => q.p);
    packed.push({ ...createFreehand(raw, false, pressures), id, ...style } as FreehandElement);
    const geometry = freehandGeometry(raw);
    former.push({ id, type: 'freehand', ...geometry, closed: false, pressures, ...style });
  });
  const tab = (elements: unknown[]) => ({ theme: 'default', kind: 'whiteboard', elements });
  return { samples, packed: tab(packed), former: tab(former) };
}

// The migration logs how many strokes it converted; timed repeatedly, that is noise.
function timeQuietly(run: () => void): number {
  const info = console.info;
  console.info = () => {};
  try {
    return time(run);
  } finally {
    console.info = info;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function time(run: () => void): number {
  const times: number[] = [];
  run(); // warm up
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    run();
    times.push(performance.now() - t0);
  }
  return median(times);
}

// Every object and array JSON.parse built: what a loaded tab costs the garbage collector.
function countObjects(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0;
  let n = 1;
  for (const v of Array.isArray(value) ? value : Object.values(value)) n += countObjects(v);
  return n;
}

function heapAfterParse(text: string): number {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) return Number.NaN;
  gc();
  const before = process.memoryUsage().heapUsed;
  const kept = JSON.parse(text) as unknown;
  gc();
  const after = process.memoryUsage().heapUsed;
  if (!kept) throw new Error('unreachable');
  return after - before;
}

function inViewport(el: { x: number; y: number; width: number; height: number }): boolean {
  return (
    el.x < VIEWPORT.x + VIEWPORT.width &&
    el.x + el.width > VIEWPORT.x &&
    el.y < VIEWPORT.y + VIEWPORT.height &&
    el.y + el.height > VIEWPORT.y
  );
}

type FormerStroke = Pick<
  FreehandElement,
  'x' | 'y' | 'width' | 'height' | 'penWidth' | 'streamline'
> & {
  points: { nx: number; ny: number }[];
  pressures?: number[];
};

// The pen outline exactly as the editor drew a former-shape stroke (its freehandPenStroke before
// packed points): a point object per sample, mapped from the stored objects.
function formerPath(el: FormerStroke): string {
  const w = Math.max(el.width, 1);
  const h = Math.max(el.height, 1);
  return penStrokePath({
    points: el.points.map((p) => ({ x: el.x + p.nx * w, y: el.y + p.ny * h })),
    pressures: el.pressures,
    width: el.penWidth ?? 1,
    streamline: el.streamline ?? 0,
  });
}

function drawFormer(text: string, visibleOnly: boolean): number {
  const tab = JSON.parse(text) as { elements: FormerStroke[] };
  let length = 0;
  for (const el of tab.elements)
    if (!visibleOnly || inViewport(el)) length += formerPath(el).length;
  return length;
}

// A freshly loaded tab: the decode cache starts empty, as it does when a document opens.
function drawPacked(text: string, visibleOnly: boolean): number {
  clearStrokePointsCache();
  const tab = JSON.parse(text) as { elements: FreehandElement[] };
  let length = 0;
  for (const el of tab.elements)
    if (!visibleOnly || inViewport(el)) length += penStrokeSvg(el).d.length;
  return length;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const share = (bytes: number) => `${((bytes / D1_MAX_ROW_BYTES) * 100).toFixed(0)}%`;
const ms = (n: number) => `${n.toFixed(1)} ms`;

function main() {
  const { samples, packed, former } = boards();
  const formerText = JSON.stringify(former);
  const packedText = JSON.stringify(packed);
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const pointsBytes = (text: string, total: number) => {
    const tab = JSON.parse(text) as { elements: Record<string, unknown>[] };
    const rest = tab.elements.map(({ points: _p, pressures: _q, packedPoints: _b, ...el }) => el);
    return (bytes(text) - bytes(JSON.stringify({ ...tab, elements: rest }))) / total;
  };

  // Accuracy: every packed point and pressure against the sample it was drawn from.
  let worstPx = 0;
  let worstBoundPx = 0;
  let worstPressure = 0;
  (packed.elements as FreehandElement[]).forEach((el, i) => {
    const decoded = decodeStrokePoints(el.packedPoints);
    samples[i]!.forEach((s, k) => {
      const dx = Math.abs(el.x + decoded.nx[k]! * el.width - s.x);
      const dy = Math.abs(el.y + decoded.ny[k]! * el.height - s.y);
      worstPx = Math.max(worstPx, dx, dy);
      worstPressure = Math.max(worstPressure, Math.abs(decoded.pressures![k]! - s.p));
    });
    worstBoundPx = Math.max(worstBoundPx, Math.max(el.width, el.height) * STROKE_POINT_MAX_ERROR);
  });
  if (worstPx > worstBoundPx || worstPressure > STROKE_PRESSURE_MAX_ERROR) {
    throw new Error(
      `[stroke-points-bench] precision bound broken: ${worstPx} px, ${worstPressure}`,
    );
  }

  const rows: [string, string, string][] = [
    ['Tab bytes', kb(bytes(formerText)), kb(bytes(packedText))],
    ['Share of one D1 row (2,000,000 bytes)', share(bytes(formerText)), share(bytes(packedText))],
    [
      'Bytes per point (pressure included)',
      pointsBytes(formerText, POINTS).toFixed(1),
      pointsBytes(packedText, POINTS).toFixed(1),
    ],
    ['Objects allocated by JSON.parse', `${countObjects(former)}`, `${countObjects(packed)}`],
    ['Heap held after parse', kb(heapAfterParse(formerText)), kb(heapAfterParse(packedText))],
    ['JSON.parse', ms(time(() => JSON.parse(formerText))), ms(time(() => JSON.parse(packedText)))],
    [
      'Parse + draw one viewport',
      ms(time(() => drawFormer(formerText, true))),
      ms(time(() => drawPacked(packedText, true))),
    ],
    [
      'Parse + draw the whole board',
      ms(time(() => drawFormer(formerText, false))),
      ms(time(() => drawPacked(packedText, false))),
    ],
    [
      'Migrate the former tab on load',
      ms(timeQuietly(() => migrateStoredTab(JSON.parse(formerText) as never))),
      '-',
    ],
  ];
  console.log(
    `[stroke-points-bench] ${STROKES} strokes, ${POINTS} points, pressure on every point`,
  );
  console.log('| Measure | Before (`{ nx, ny }`) | After (packed) |');
  console.log('| --- | --- | --- |');
  for (const [name, a, b] of rows) console.log(`| ${name} | ${a} | ${b} |`);
  console.log(
    `[stroke-points-bench] worst position error ${worstPx.toFixed(4)} px (bound on these strokes ${worstBoundPx.toFixed(4)} px), worst pressure error ${worstPressure.toFixed(4)}`,
  );
}

main();
