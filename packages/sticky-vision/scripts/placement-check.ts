import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import {
  eventStormingNote,
  isOnLane,
  laneIndexAt,
  reconcilePhoto,
  type BoardNote,
  type PhotoAddition,
  type PhotoNote,
} from '@livediagram/diagram';
import { clusterRows } from '../src/rows';
import { truthDir, truthFor } from './truth';

// Where a photographed wall LANDS on the board, checked against the labelled
// walls (docs/specs/021-event-storming/event-storming.md "Always on a lane", Photo import).
//
// The labels are the ground truth of where every note sat on a real wall, so
// they are the realistic input the placement has to survive: rows closer than
// a lane, lapped notes, sagging rows, 272 notes on one whiteboard. For each wall
// this prints the invariants (every note on a lane, nothing overlapping, row
// order kept) and writes an SVG of the result, so a change to the placement can
// be judged by eye as well as by number.
//
//   pnpm --filter @livediagram/sticky-vision exec tsx scripts/placement-check.ts [outDir]
//
// The labels live outside this repository (see truth.ts); with none present
// the script says so and exits.

const outDir = process.argv[2] ?? '/tmp/es-lanes/placement';
mkdirSync(outDir, { recursive: true });

const walls = existsSync(truthDir())
  ? readdirSync(truthDir()).filter((f) => f.endsWith('.json'))
  : [];
if (walls.length === 0) {
  console.log(`no labelled walls in ${truthDir()}`);
  process.exit(0);
}

const SQUARE_KINDS = new Set(['domain-event', 'command', 'read-model', 'hotspot']);
let failures = 0;

for (const file of walls) {
  const truth = truthFor(file)!;
  const { width: W, height: H } = truth.labelledOn;
  // The detector's own row clustering, on the labelled boxes in pixels.
  const boxes = truth.notes.map((n, i) => ({
    id: i,
    x: n.x * W,
    y: n.y * H,
    w: n.w * W,
    h: n.h * H,
    kind: n.kind,
  }));
  const squares = boxes.filter((b) => SQUARE_KINDS.has(b.kind)).map((b) => b.w);
  const noteSize = median(squares.length > 0 ? squares : boxes.map((b) => b.w));
  const rowed = clusterRows(boxes as never, noteSize) as unknown as ((typeof boxes)[number] & {
    row: number;
    order: number;
  })[];
  const detected: PhotoNote[] = rowed.map((b) => ({
    id: b.id,
    text: '',
    kind: b.kind === 'unknown' ? 'unknown' : (b.kind as PhotoNote['kind']),
    size: 'square',
    // Fractions of the photo's WIDTH on both axes, as toNormalised hands them.
    cx: (b.x + b.w / 2) / W,
    cy: (b.y + b.h / 2) / W,
    w: b.w / W,
    h: b.h / W,
    row: b.row,
    order: b.order,
  }));
  // The board a fresh workshop starts with: the seed note on lane 0.
  const seed: BoardNote = {
    id: 'seed',
    text: 'Board Created',
    kind: 'domain-event',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  };
  for (const [label, existing] of [
    ['empty', [] as BoardNote[]],
    ['seeded', [seed]],
  ] as const) {
    const started = performance.now();
    const { additions } = reconcilePhoto(detected, existing);
    const took = performance.now() - started;
    const photoCy = new Map(
      detected.map((d) => [d.id, d.cy * (200 / (median(detected.map((n) => n.w)) || 1))]),
    );
    const problems = invariants(additions, existing, photoCy);
    failures += problems.length;
    const lanes = new Set(additions.map((a) => laneIndexAt(a.y + a.height / 2, { originY: 0 })));
    const photoLanes =
      Math.round((Math.max(...photoCy.values()) - Math.min(...photoCy.values())) / 240) + 1;
    console.log(
      `${file.padEnd(26)} ${label.padEnd(6)} notes ${String(additions.length).padStart(3)} photo spans ~${String(photoLanes).padStart(2)} lanes, uses ${String(lanes.size).padStart(2)} ${took.toFixed(1).padStart(6)}ms ${problems.length === 0 ? 'ok' : problems.join('; ')}`,
    );
    if (label === 'seeded')
      writeFileSync(`${outDir}/${file.replace('.json', '')}.svg`, render(additions, existing));
  }
}
process.exit(failures === 0 ? 0 : 1);

function invariants(
  out: PhotoAddition[],
  existing: BoardNote[],
  photoCy: Map<number, number>,
): string[] {
  const problems: string[] = [];
  const offLane = out.filter((n) => !isOnLane(n)).length;
  if (offLane > 0) problems.push(`${offLane} off a lane`);
  let clashes = 0;
  for (let i = 0; i < out.length; i += 1) {
    for (const e of existing) if (overlaps(out[i]!, e)) clashes += 1;
    for (let j = i + 1; j < out.length; j += 1) if (overlaps(out[i]!, out[j]!)) clashes += 1;
  }
  if (clashes > 0) problems.push(`${clashes} overlaps`);
  const lane = (a: PhotoAddition) => laneIndexAt(a.y + a.height / 2, { originY: 0 });
  // Order: a note clearly lower in the photo (half a note or more) never
  // lands on a lane above one it lay under.
  let inversions = 0;
  for (const a of out) {
    for (const b of out) {
      const da = photoCy.get(a.detectedId)!;
      const db = photoCy.get(b.detectedId)!;
      if (db - da >= 100 && lane(b) < lane(a)) inversions += 1;
    }
  }
  if (inversions > 0) problems.push(`${inversions} order inversions`);
  return problems;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 1;
}

function render(out: PhotoAddition[], existing: BoardNote[]): string {
  const all = [...out, ...existing];
  const minX = Math.min(...all.map((n) => n.x)) - 40;
  const minY = Math.min(...all.map((n) => n.y)) - 40;
  const maxX = Math.max(...all.map((n) => n.x + n.width)) + 40;
  const maxY = Math.max(...all.map((n) => n.y + n.height)) + 40;
  const lanes: string[] = [];
  for (
    let i = laneIndexAt(minY, { originY: 0 }) - 1;
    i <= laneIndexAt(maxY, { originY: 0 }) + 1;
    i += 1
  ) {
    lanes.push(
      `<rect x="${minX}" y="${i * 240}" width="${maxX - minX}" height="200" fill="#1e293b"/>`,
    );
  }
  const notes = all.map((n) => {
    const fill = eventStormingNote(n.kind === 'unknown' ? 'domain-event' : n.kind).fill;
    const stroke = 'id' in n ? '#f8fafc' : '#0f172a';
    return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" fill="${fill}" stroke="${stroke}" stroke-width="${'id' in n ? 10 : 3}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${Math.round((maxX - minX) / 4)}" height="${Math.round((maxY - minY) / 4)}"><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#0f172a"/>${lanes.join('')}${notes.join('')}</svg>`;
}
