import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, FreehandElement, Tab } from '@livediagram/document';
import type { ChangeLogEntry, RoomOp } from '@livediagram/api-schema';
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

  it('migrates a change-log entry', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const entry = {
      id: 'e',
      beforeState: { f1: legacyStroke },
      afterState: { f1: null },
    } as unknown as ChangeLogEntry;
    const op = migrateRoomOp({ kind: 'log', entry });
    packed((op as Extract<RoomOp, { kind: 'log' }>).entry.beforeState.f1);
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
});
