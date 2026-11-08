import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import {
  applyElementOp,
  mergeIncomingElement,
  type Element,
  type ElementOp,
  type Tab,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { applyRoomOpToTabs, remoteRoomOp } from './room-op-apply';

// docs/specs/024-agents/agent-changesets.md "In the editor": a changeset's element ops apply as a peer's `el` op
// would, each merged over our copy as the ops before it left it (an agent's board set-up taken, `keepBoard: false`).
// They now apply in one pass; this holds them to the one-op-at-a-time loop they replaced, over random changesets,
// and holds a run of peers' `el` ops (as an undo snapshot takes them together) to applying them one by one.

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
    // Answers are kept from our copy (mergeIncomingElement); a board's set-up is ours unless an agent sends it.
    ...(rand() < 0.4
      ? { responses: [{ participantId: 'p', value: `r${Math.floor(rand() * 5)}`, at: 1 }] }
      : {}),
    ...(rand() < 0.3
      ? {
          planBoard: {
            title: `b${Math.floor(rand() * 4)}`,
            columns: [],
            swimlaneBy: 'none',
            cardFields: [],
            hideWriting: false,
          },
        }
      : {}),
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
function oneAtATime(elements: Element[], ops: ElementOp[], keepBoard: boolean): Element[] {
  let out = elements;
  for (const op of ops) {
    if (op.kind === 'update' || op.kind === 'add') {
      const local = out.find((e) => e.id === op.element.id);
      out = applyElementOp(
        out,
        local
          ? {
              ...op,
              element: mergeIncomingElement(
                local,
                op.element,
                keepBoard ? {} : { keepBoard: false },
              ),
            }
          : op,
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
      const expected = oneAtATime(elements, ops, false);
      const next = applyRoomOpToTabs(tabs, changeset(ops));
      expect(next[0]!.elements).toEqual(expected);
      if (expected === elements) expect(next).toBe(tabs);
    }
  });
});

describe('remoteRoomOp: a run of element ops in one pass', () => {
  it("applies a run of peers' el ops as applying each op in turn", () => {
    const rand = seededRandom(12);
    for (let n = 0; n < 1500; n++) {
      const elements = Array.from({ length: Math.floor(rand() * 12) }, () => randomElement(rand));
      const ops = randomOps(rand);
      const tabs: Tab[] = [{ id: 't1', name: 'Tab', elements }];
      const roomOps = ops.map((op): RoomOp => ({ kind: 'el', tabId: 't1', op }));
      const expected = roomOps.reduce(applyRoomOpToTabs, tabs);
      expect(expected[0]!.elements).toEqual(oneAtATime(elements, ops, true));
      const logged = roomOps.map((op) => remoteRoomOp(op));
      if (logged.length === 0) continue;
      const run = logged[0]!.run!;
      const together = run.applyAll(
        tabs,
        run.key,
        logged.flatMap((op) => op.run!.items),
      );
      expect(together).toEqual(expected);
    }
  });

  it("keeps a person's el run and an agent's changeset run apart", () => {
    const el = remoteRoomOp({ kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'e1' } });
    const cs = remoteRoomOp(changeset([{ kind: 'remove', id: 'e1' }]));
    expect(el.run!.key).toBe(cs.run!.key);
    expect(el.run!.applyAll).not.toBe(cs.run!.applyAll);
    // A patch, a created tab or a rebuilt Dashboard is applied alone.
    expect(
      remoteRoomOp({ kind: 'el', tabId: 't1', op: { kind: 'patch', id: 'e1', set: {} } }).run,
    ).toBeUndefined();
    expect(
      remoteRoomOp({ ...changeset([]), tab: { id: 't1', name: 'New' } } as RoomOp).run,
    ).toBeUndefined();
    expect(
      remoteRoomOp({ ...changeset([]), dashboard: { rows: [] } } as RoomOp).run,
    ).toBeUndefined();
  });
});
