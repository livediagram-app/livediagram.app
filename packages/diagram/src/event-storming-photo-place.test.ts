import { describe, expect, it } from 'vitest';
import { PHOTO_COLUMN_RADIUS, placeNewNotes } from './event-storming-photo-place';
import { groupRows } from './event-storming-lane-landing';
import type { BoardNote } from './event-storming-photo-match';
import type { PhotoAddition } from './event-storming-photo';
import { eventStormingNoteSize, type EventStormingNoteKind } from './event-storming';
import { ES_LANE_PITCH, ES_NOTE_GAP, isOnLane, laneIndexAt } from './event-storming-lanes';

// Photo import placement (docs/specs/021-event-storming/event-storming.md "Always on a lane", Photo import).
// The photographs that matter are the dense ones: rows closer together than a
// lane, notes lapped over each other, rows that sag. Those are built here from
// the measurements of the eight labelled real walls (row gaps of 0.46 to 2.4
// lanes, a third of the notes in a row overlapping a neighbour once every kind
// takes its own silhouette).

let seq = 0;
// A note as the transform hands it over: CENTRED on the photo centre (cx, cy).
function add(cx: number, cy: number, kind: EventStormingNoteKind = 'domain-event'): PhotoAddition {
  const size = eventStormingNoteSize(kind);
  seq += 1;
  return {
    detectedId: seq,
    kind,
    text: '',
    x: cx - size.width / 2,
    y: cy - size.height / 2,
    ...size,
  };
}

const board = (id: string, x: number, y: number): BoardNote => ({
  id,
  text: '',
  kind: 'domain-event',
  x,
  y,
  width: 200,
  height: 200,
});

type Box = { x: number; y: number; width: number; height: number };
const overlapsX = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width;
const overlaps = (a: Box, b: Box) =>
  overlapsX(a, b) && a.y < b.y + b.height && b.y < a.y + a.height;
const lane = (a: Box) => laneIndexAt(a.y + a.height / 2, { originY: 0 });

describe('placeNewNotes', () => {
  it('lands a lone note on its nearest lane and leaves x where the photo had it', () => {
    const [out] = placeNewNotes([add(407, 250)], []);
    expect(out).toMatchObject({ x: 307, y: 240 });
  });

  it('keeps two rows closer than a lane on two lanes, in their order', () => {
    // 110px apart, both nearest to lane 0.
    const out = placeNewNotes([add(100, 100), add(100, 210)], []);
    expect(out.map(lane)).toEqual([0, 1]);
  });

  it('lets two rows that do not overlap share a lane', () => {
    const out = placeNewNotes([add(100, 100), add(600, 210)], []);
    expect(out.map(lane)).toEqual([0, 0]);
  });

  it('keeps a dense wall of twelve rows in order, one lane each', () => {
    const notes: PhotoAddition[] = [];
    for (let r = 0; r < 12; r += 1) {
      for (let c = 0; c < 4; c += 1) notes.push(add(c * 230 + (r % 2) * 90, 100 + r * 158));
    }
    const out = placeNewNotes(notes, []);
    for (let r = 0; r < 12; r += 1) {
      expect(new Set(out.slice(r * 4, r * 4 + 4).map(lane))).toEqual(new Set([r]));
    }
  });

  it('keeps a row sagging less than half a lane on one lane', () => {
    const out = placeNewNotes([add(100, 100), add(330, 140), add(560, 190), add(790, 125)], []);
    expect(new Set(out.map(lane))).toEqual(new Set([0]));
  });

  it('slides lapped notes of one row apart along the lane, in the photo order', () => {
    const out = placeNewNotes([add(100, 100), add(250, 100), add(400, 110)], []);
    expect(out.map((n) => n.x)).toEqual([0, 200 + ES_NOTE_GAP, 2 * (200 + ES_NOTE_GAP)]);
    expect(new Set(out.map(lane))).toEqual(new Set([0]));
  });

  it('pushes a row landing on a board note down a lane, with every row below it', () => {
    const existing = [board('down', 600, 0)];
    const frozen = JSON.stringify(existing);
    const out = placeNewNotes(
      [add(100, 100), add(700, 100), add(100, 340), add(100, 580)],
      existing,
    );
    expect(out.map(lane)).toEqual([1, 1, 2, 3]);
    expect(JSON.stringify(existing)).toBe(frozen);
    for (const n of out) for (const e of existing) expect(overlaps(n, e)).toBe(false);
  });

  it('slides past a board note that only the slide runs into', () => {
    const existing = [board('down', 400, 0)];
    const out = placeNewNotes([add(100, 100), add(250, 100)], existing);
    expect(out.map((n) => n.x)).toEqual([0, 400 + 200 + ES_NOTE_GAP]);
  });

  it('lines up notes of different rows within a quarter note into one column, on the top one', () => {
    const out = placeNewNotes([add(100, 100), add(100 + PHOTO_COLUMN_RADIUS, 340)], []);
    expect(out[1]!.x).toBe(out[0]!.x);
  });

  it('leaves notes further apart than a quarter note in their own columns', () => {
    const out = placeNewNotes([add(100, 100), add(100 + PHOTO_COLUMN_RADIUS + 10, 340)], []);
    expect(out[1]!.x).toBe(out[0]!.x + PHOTO_COLUMN_RADIUS + 10);
  });

  it('lines a wide note up on its left edge under a square one', () => {
    const out = placeNewNotes([add(100, 100), add(130, 340, 'policy')], []);
    expect(out[1]!.x).toBe(out[0]!.x);
    expect(out[1]!.width).toBe(300);
  });

  it('never moves a board note, whatever the photo says', () => {
    const existing = [board('a', 0, 0), board('b', 216, 240)];
    const frozen = JSON.stringify(existing);
    placeNewNotes([add(100, 100), add(316, 340), add(200, 220)], existing);
    expect(JSON.stringify(existing)).toBe(frozen);
  });

  it('places the densest labelled wall (272 notes) quickly', () => {
    const notes = denseWall(mulberry32(7), { rows: 16, perRow: 17 });
    const started = performance.now();
    placeNewNotes(notes, []);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

// The invariants, over walls shaped like the labelled ones. A single counter
// example is a bug, so the seed is part of the failure message.
describe('placeNewNotes on dense, imperfect walls', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    it(`keeps every invariant on wall #${seed}`, () => {
      const rand = mulberry32(seed);
      const notes = denseWall(rand, {
        rows: 2 + Math.floor(rand() * 10),
        perRow: 3 + Math.floor(rand() * 12),
      });
      const existing =
        rand() < 0.5
          ? []
          : [board('e1', rand() * 1500, 0), board('e2', rand() * 1500, ES_LANE_PITCH)];
      const out = placeNewNotes(notes, existing);
      const at = `seed ${seed}`;

      expect(out).toHaveLength(notes.length);
      for (const n of out) expect(isOnLane(n), at).toBe(true);
      for (let i = 0; i < out.length; i += 1) {
        for (const e of existing) expect(overlaps(out[i]!, e), at).toBe(false);
        for (let j = i + 1; j < out.length; j += 1) {
          expect(overlaps(out[i]!, out[j]!), `${at} ${i}/${j}`).toBe(false);
        }
      }
      // Row order: a row never lands above the row before it, and a note
      // lying over a note of an earlier row lands strictly below it.
      const rows = groupRows(notes);
      const rowLane = rows.map((row) => lane(out[row[0]!]!));
      for (let k = 1; k < rows.length; k += 1) {
        expect(rowLane[k]!, at).toBeGreaterThanOrEqual(rowLane[k - 1]!);
        for (const i of rows[k]!) {
          for (let m = 0; m < k; m += 1) {
            for (const j of rows[m]!) {
              if (overlapsX(notes[i]!, notes[j]!))
                expect(lane(out[i]!), at).toBeGreaterThan(lane(out[j]!));
            }
          }
        }
      }
    });
  }
});

const KINDS: EventStormingNoteKind[] = [
  'domain-event',
  'domain-event',
  'domain-event',
  'command',
  'policy',
  'actor',
  'hotspot',
  'read-model',
  'aggregate',
];

// A wall like the labelled ones: rows 0.45 to 1.4 lanes apart, notes 150 to
// 260 canvas px apart along a row (lapped below 200), rows sagging up to 40px.
function denseWall(rand: () => number, shape: { rows: number; perRow: number }): PhotoAddition[] {
  const out: PhotoAddition[] = [];
  let cy = 100 + rand() * 200;
  for (let r = 0; r < shape.rows; r += 1) {
    let cx = rand() * 300;
    const sag = (rand() - 0.5) * 80;
    for (let c = 0; c < shape.perRow; c += 1) {
      const kind = KINDS[Math.floor(rand() * KINDS.length)]!;
      const drift = (sag * c) / shape.perRow + (rand() - 0.5) * 20;
      out.push(add(cx, cy + drift, kind));
      cx += 150 + rand() * 110;
    }
    cy += ES_LANE_PITCH * (0.45 + rand() * 0.95);
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
