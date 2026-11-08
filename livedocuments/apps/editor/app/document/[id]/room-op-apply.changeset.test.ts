import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import {
  applyElementOp,
  mergeIncomingElement,
  type Element,
  type ElementOp,
  type Tab,
} from '@livedocuments/document';
import type { RoomOp } from '@livedocuments/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';

// docs/specs/024-agents/agent-changesets.md "In the editor": a changeset's element ops apply as a peer's `el` op
// would, each merged over our copy as the ops before it left it. They now apply in one pass; this holds them to the
// one-op-at-a-time loop they replaced, over random changesets.

const ids = Array.from({ length: 14 }, (_, i) => `e${i}`);

function randomElement(rand: () => number): Element {
  const id = ids[Math.floor(rand() * ids.length)]!;
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: Math.floor(rand() * 50),
    y: 0,
    width: 10,
    height: 10,
    // Ticks are kept from our copy (mergeIncomingElement).
    ...(rand() < 0.4 ? { checklistItems: [{ text: 'a', done: rand() < 0.5 }] } : {}),
  };
}

function randomOps(rand: () => number): ElementOp[] {
  return Array.from({ length: Math.floor(rand() * 30) }, (): ElementOp => {
    const roll = rand();
    if (roll < 0.5) return { kind: 'update', element: randomElement(rand) };
    if (roll < 0.75)
      return { kind: 'add', element: randomElement(rand), at: Math.floor(rand() * 16) };
    if (roll < 0.93) return { kind: 'remove', id: ids[Math.floor(rand() * ids.length)]! };
    return {
      kind: 'reorder',
      ids: Array.from(
        { length: Math.floor(rand() * 10) },
        () => ids[Math.floor(rand() * ids.length)]!,
      ),
    };
  });
}

// The loop the changeset case ran before.
function oneAtATime(elements: Element[], ops: ElementOp[]): Element[] {
  let out = elements;
  for (const op of ops) {
    if (op.kind === 'update' || op.kind === 'add') {
      const local = out.find((e) => e.id === op.element.id);
      out = applyElementOp(
        out,
        local ? { ...op, element: mergeIncomingElement(local, op.element) } : op,
      );
    } else out = applyElementOp(out, op);
  }
  return out;
}

const changeset = (elementOps: ElementOp[]): RoomOp => ({
  kind: 'changeset',
  tabId: 't1',
  id: 'cs_0000000001',
  rev: 2,
  prevRev: null,
  author: { name: 'Webber', color: '#0ea5e9' },
  counts: { added: 0, changed: elementOps.length, removed: 0 },
  elementOps,
});

describe('applyRoomOpToTabs: changeset in one pass', () => {
  it('equals the one-op-at-a-time loop over random changesets', () => {
    const rand = seededRandom(11);
    for (let n = 0; n < 3000; n++) {
      // Ids may repeat in a tab: a racing double-add can leave one there twice.
      const elements = Array.from({ length: Math.floor(rand() * 12) }, () => randomElement(rand));
      const ops = randomOps(rand);
      const tabs: Tab[] = [{ id: 't1', name: 'Tab', elements }];
      const expected = oneAtATime(elements, ops);
      const next = applyRoomOpToTabs(tabs, changeset(ops));
      expect(next[0]!.elements).toEqual(expected);
      if (expected === elements) expect(next).toBe(tabs);
    }
  });
});
