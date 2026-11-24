import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTINUOUS_PAGE_WIDTH,
  type Element,
  type FreehandElement,
  type Tab,
} from '@liveknowledge/document';
import type { RoomOp } from '@liveknowledge/api-schema';
import { migrateRoomOp } from './room-op-migrate';

// docs/specs/006-document/stroke-points.md "Migration of stored strokes": a peer whose browser
// loaded before a deploy still sends strokes in the former `{ nx, ny }` shape; every op that
// carries elements is migrated on receipt, before it is applied.

const legacyStroke = {
  id: 'f1',
  type: 'freehand',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  closed: false,
  points: [
    { nx: 0, ny: 0 },
    { nx: 1, ny: 1 },
  ],
  pressures: [0.5, 0.5],
} as unknown as Element;

const packed = (el: unknown) => {
  const f = el as FreehandElement & { points?: unknown };
  expect(typeof f.packedPoints).toBe('string');
  expect(f.points).toBeUndefined();
};

afterEach(() => vi.restoreAllMocks());

describe('migrateRoomOp', () => {
  it('migrates a whole tab', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = { id: 't1', name: 'T', elements: [legacyStroke] } as Tab;
    const op = migrateRoomOp({ kind: 'tab', tabId: 't1', tab });
    packed((op as Extract<RoomOp, { kind: 'tab' }>).tab.elements[0]);
  });

  it('migrates an added or updated element', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    for (const elOp of [
      { kind: 'add', element: legacyStroke, at: 0 } as const,
      { kind: 'update', element: legacyStroke } as const,
    ]) {
      const op = migrateRoomOp({ kind: 'el', tabId: 't1', op: elOp });
      packed((op as { op: { element: Element } }).op.element);
    }
  });

  it('returns every other op, and an op with nothing to migrate, as it came', () => {
    const remove: RoomOp = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'f1' } };
    expect(migrateRoomOp(remove)).toBe(remove);
    const focus: RoomOp = { kind: 'tab-focus', tabId: 't1' };
    expect(migrateRoomOp(focus)).toBe(focus);
    const current: RoomOp = {
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: { id: 's', type: 'text' } as Element },
    };
    expect(migrateRoomOp(current)).toBe(current);
  });

  // Work Tracker 1418: a peer loaded before the wider page sends its pages at the first width.
  it("reads a peer's continuous page at the continuous width, its height kept, and leaves every other page", () => {
    const first = {
      id: 'p1',
      orientation: 'portrait',
      kind: 'article',
      flow: 'art-1',
      size: 'fit',
      fit: { width: 856, height: 2400 },
    } as const;
    const paper = { id: 'p2', orientation: 'portrait', kind: 'article', flow: 'art-2' } as const;
    const op: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { pages: [first, paper], name: 'A' },
    };
    const out = migrateRoomOp(op) as Extract<RoomOp, { kind: 'tab-meta' }>;
    expect(out.patch.pages![0]!.fit).toEqual({ width: CONTINUOUS_PAGE_WIDTH, height: 2400 });
    expect(out.patch.pages![1]).toBe(paper);
    expect(out.patch.name).toBe('A');
    const now: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { pages: [{ ...first, fit: { width: CONTINUOUS_PAGE_WIDTH, height: 2400 } }] },
    };
    expect(migrateRoomOp(now)).toBe(now);
    const noPages: RoomOp = { kind: 'tab-meta', tabId: 't1', patch: { name: 'B' } };
    expect(migrateRoomOp(noPages)).toBe(noPages);
    const junk = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { pages: [null, { ...first, fit: 'wide' }] },
    };
    expect(migrateRoomOp(junk as unknown as RoomOp)).toBe(junk);
  });
});
