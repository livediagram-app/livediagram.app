import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import { graftLiveTabState, type Element, type ElementOp, type Tab } from '@livehuddle/document';
import type { RoomOp } from '@livehuddle/api-schema';
import { applyRoomOpToTabs, remoteRoomOp } from '@/app/document/[id]/room-op-apply';
import {
  HISTORY_LIMIT,
  historyApplyRemoteOp,
  historyCancel,
  historyCommit,
  historyMarkCheckpoint,
  historyRedo,
  historyUndo,
  sameTabs,
  type History,
} from './useDocumentHistory';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Locked decisions": a peer's op lands in every undo
// and redo snapshot. Snapshots now take it when restored rather than on arrival; what the person sees must be what
// the eager history showed, over random interleavings of their own steps and peers' ops.

// The eager history, as it was, kept here as the reference.
type Eager = { past: Tab[][]; present: Tab[]; future: Tab[][] };
const eager = {
  commit: (h: Eager, map: (t: Tab[]) => Tab[]): Eager => {
    const present = map(h.present);
    if (sameTabs(h.present, present)) return h;
    return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present, future: [] };
  },
  checkpoint: (h: Eager): Eager => ({
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: h.present,
    future: [],
  }),
  undo: (h: Eager): Eager =>
    h.past.length === 0
      ? h
      : {
          past: h.past.slice(0, -1),
          present: graftLiveTabState(h.present, h.past[h.past.length - 1]!),
          future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
        },
  cancel: (h: Eager): Eager =>
    h.past.length === 0
      ? h
      : {
          past: h.past.slice(0, -1),
          present: graftLiveTabState(h.present, h.past[h.past.length - 1]!),
          future: h.future,
        },
  redo: (h: Eager): Eager =>
    h.future.length === 0
      ? h
      : {
          past: [...h.past, h.present].slice(-HISTORY_LIMIT),
          present: graftLiveTabState(h.present, h.future[0]!),
          future: h.future.slice(1),
        },
  remote: (h: Eager, apply: (t: Tab[]) => Tab[]): Eager => ({
    past: h.past.map(apply),
    present: apply(h.present),
    future: h.future.map(apply),
  }),
};

const ids = Array.from({ length: 10 }, (_, i) => `e${i}`);
const tabIds = ['t1', 't2', 't3'];

const note = (id: string) => ({ id, text: id, author: 'A', by: 'a', at: 0 });

function randomElement(rand: () => number, id = ids[Math.floor(rand() * ids.length)]!): Element {
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: Math.floor(rand() * 100),
    y: Math.floor(rand() * 100),
    width: 10,
    height: 10,
    // A notice board's notes are kept from our copy on merge; a comment thread is carried from the present on undo.
    ...(rand() < 0.3 ? { noticeNotes: [note(`n${Math.floor(rand() * 5)}`)] } : {}),
    ...(rand() < 0.2 ? { commentThread: { comments: [], resolved: rand() < 0.5 } } : {}),
  };
}

function randomElementOp(rand: () => number): ElementOp {
  const roll = rand();
  if (roll < 0.5) return { kind: 'update', element: randomElement(rand) };
  if (roll < 0.75)
    return { kind: 'add', element: randomElement(rand), at: Math.floor(rand() * 12) };
  if (roll < 0.93) return { kind: 'remove', id: ids[Math.floor(rand() * ids.length)]! };
  return { kind: 'reorder', ids: [...ids].sort(() => rand() - 0.5).slice(0, 6) };
}

function randomRemoteOp(rand: () => number): RoomOp {
  const tabId = tabIds[Math.floor(rand() * tabIds.length)]!;
  const roll = rand();
  if (roll < 0.55) return { kind: 'el', tabId, op: randomElementOp(rand) };
  if (roll < 0.8) {
    const elementOps = Array.from({ length: 1 + Math.floor(rand() * 12) }, () =>
      randomElementOp(rand),
    );
    return {
      kind: 'changeset',
      tabId,
      id: 'cs_0000000001',
      rev: 2,
      prevRev: null,
      author: { name: 'Webber', color: '#0ea5e9' },
      counts: { added: 0, changed: elementOps.length, removed: 0 },
      elementOps,
    };
  }
  if (roll < 0.95) {
    const elements = Array.from({ length: Math.floor(rand() * 6) }, () => randomElement(rand));
    return { kind: 'tab', tabId, tab: { id: tabId, name: `peer ${tabId}`, elements } };
  }
  return { kind: 'tab-meta', tabId, patch: { name: `renamed ${Math.floor(rand() * 3)}` } };
}

// One of my own edits: move, add or delete an element on a tab.
function randomLocalEdit(rand: () => number): (tabs: Tab[]) => Tab[] {
  const tabId = tabIds[Math.floor(rand() * tabIds.length)]!;
  const roll = rand();
  const element = randomElement(rand);
  return (tabs) =>
    tabs.map((t) => {
      if (t.id !== tabId) return t;
      if (roll < 0.4) {
        return {
          ...t,
          elements: t.elements.map((e) =>
            e.id === element.id ? { ...e, x: (element as Element & { x: number }).x } : e,
          ),
        };
      }
      if (roll < 0.75)
        return { ...t, elements: [...t.elements.filter((e) => e.id !== element.id), element] };
      return { ...t, elements: t.elements.filter((e) => e.id !== element.id) };
    });
}

const start = (): Tab[] => [
  { id: 't1', name: 'One', elements: [] },
  { id: 't2', name: 'Two', elements: [] },
];

describe('history rebasing, lazily against eagerly', () => {
  for (const [seed, remoteShare, steps] of [
    [1, 0.5, 1500],
    [2, 0.8, 1500],
    [3, 0.3, 1500],
  ] as const) {
    it(`shows what the eager history showed (seed ${seed})`, () => {
      const rand = seededRandom(seed);
      let lz: History = { past: [], present: start(), future: [] };
      let eg: Eager = { past: [], present: start(), future: [] };
      for (let n = 0; n < steps; n++) {
        if (rand() < remoteShare) {
          const op = randomRemoteOp(rand);
          // As the editor logs it (remoteRoomOp: element ops in runs), against the plain op on every snapshot.
          lz = historyApplyRemoteOp(lz, remoteRoomOp(op));
          eg = eager.remote(eg, (tabs) => applyRoomOpToTabs(tabs, op));
        } else {
          const action = Math.floor(rand() * 6);
          if (action <= 1) {
            const edit = randomLocalEdit(rand);
            lz = historyCommit(lz, edit);
            eg = eager.commit(eg, edit);
          } else if (action === 2) {
            lz = historyUndo(lz);
            eg = eager.undo(eg);
          } else if (action === 3) {
            lz = historyRedo(lz);
            eg = eager.redo(eg);
          } else if (action === 4) {
            lz = historyCancel(lz);
            eg = eager.cancel(eg);
          } else {
            lz = historyMarkCheckpoint(lz);
            eg = eager.checkpoint(eg);
          }
        }
        expect(lz.present).toEqual(eg.present);
        expect(lz.past.length).toBe(eg.past.length);
        expect(lz.future.length).toBe(eg.future.length);
      }
      // Every step back and forward again restores what the eager history restored.
      while (eg.past.length > 0) {
        lz = historyUndo(lz);
        eg = eager.undo(eg);
        expect(lz.present).toEqual(eg.present);
      }
      while (eg.future.length > 0) {
        lz = historyRedo(lz);
        eg = eager.redo(eg);
        expect(lz.present).toEqual(eg.present);
      }
    });
  }
});
