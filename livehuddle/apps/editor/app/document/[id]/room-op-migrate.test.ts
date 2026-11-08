import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import type { RoomOp } from '@livehuddle/api-schema';
import { storedFreehand } from '@/test/retired-elements';
import { migrateRoomOp } from './room-op-migrate';

// docs/specs/006-document/stroke-points.md "Migration of stored strokes": a peer whose browser
// loaded before a deploy can still send elements in a former stored shape; every op that carries
// elements is migrated on receipt, before it is applied. Here, a colour that could load something
// from outside the document (unsafe-colours.ts) is dropped on the way in.

const unsafe = {
  id: 's1',
  type: 'shape',
  shape: 'rect',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  fillColor: 'url(//e.example/x)',
} as unknown as Element;

const cleaned = (el: unknown) => expect(el).not.toHaveProperty('fillColor');

afterEach(() => vi.restoreAllMocks());

describe('migrateRoomOp', () => {
  it('migrates a whole tab', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tab = { id: 't1', name: 'T', elements: [unsafe] } as Tab;
    const op = migrateRoomOp({ kind: 'tab', tabId: 't1', tab });
    cleaned((op as Extract<RoomOp, { kind: 'tab' }>).tab.elements[0]);
  });

  it('migrates an added or updated element', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const elOp of [
      { kind: 'add', element: unsafe, at: 0 } as const,
      { kind: 'update', element: unsafe } as const,
    ]) {
      const op = migrateRoomOp({ kind: 'el', tabId: 't1', op: elOp });
      cleaned((op as { op: { element: Element } }).op.element);
    }
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: a stored pen stroke is
  // retired and kept exactly as stored, so its points are never rewritten on the way in.
  it('hands a stored pen stroke through as it came', () => {
    const stroke = {
      ...storedFreehand('f1', { x: 0, y: 0, width: 10, height: 10 }),
      points: [
        { nx: 0, ny: 0 },
        { nx: 1, ny: 1 },
      ],
    } as unknown as Element;
    const op: RoomOp = { kind: 'el', tabId: 't1', op: { kind: 'update', element: stroke } };
    expect(migrateRoomOp(op)).toBe(op);
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
