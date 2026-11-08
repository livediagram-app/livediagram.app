import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import {
  graftLiveTabState,
  type DashboardLayout,
  type Element,
  type ElementOp,
  type Tab,
} from '@liveplanner/project';
import type { RoomOp } from '@liveplanner/api-schema';
import { applyRoomOpToTabs, remoteRoomOp } from '@/app/project/[id]/room-op-apply';
import {
  HISTORY_LIMIT,
  historyApplyRemoteOp,
  historyCancel,
  historyClearRedo,
  historyCommit,
  historyMarkCheckpoint,
  historyRedo,
  historyUndo,
  sameTabs,
  type History,
} from './useProjectHistory';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Locked decisions": a peer's op lands in every undo
// and redo snapshot. Snapshots now take it when restored rather than on arrival; what the person sees must be what
// the eager history showed, over random interleavings of their own steps (canvas commits, checkpoints, a card
// change clearing redo) and peers' ops of every kind that changes the tabs.

// The eager history, as it was, kept here as the reference.
type Eager = { past: Tab[][]; present: Tab[]; future: Tab[][]; depth: number; branch: number };
const step = (h: Eager, present: Tab[]): Eager => ({
  past: [...h.past, h.present].slice(-HISTORY_LIMIT),
  present,
  future: [],
  depth: h.depth + 1,
  branch: h.branch + 1,
});
const eager = {
  commit: (h: Eager, map: (t: Tab[]) => Tab[]): Eager => {
    const present = map(h.present);
    return sameTabs(h.present, present) ? h : step(h, present);
  },
  checkpoint: (h: Eager): Eager => step(h, h.present),
  clearRedo: (h: Eager): Eager => ({ ...h, future: [], branch: h.branch + 1 }),
  undo: (h: Eager): Eager =>
    h.past.length === 0
      ? h
      : {
          past: h.past.slice(0, -1),
          present: graftLiveTabState(h.present, h.past[h.past.length - 1]!),
          future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
          depth: h.depth - 1,
          branch: h.branch,
        },
  cancel: (h: Eager): Eager =>
    h.past.length === 0
      ? h
      : {
          past: h.past.slice(0, -1),
          present: graftLiveTabState(h.present, h.past[h.past.length - 1]!),
          future: h.future,
          depth: h.depth - 1,
          branch: h.branch,
        },
  redo: (h: Eager): Eager =>
    h.future.length === 0
      ? h
      : {
          past: [...h.past, h.present].slice(-HISTORY_LIMIT),
          present: graftLiveTabState(h.present, h.future[0]!),
          future: h.future.slice(1),
          depth: h.depth + 1,
          branch: h.branch,
        },
  remote: (h: Eager, apply: (t: Tab[]) => Tab[]): Eager => ({
    ...h,
    past: h.past.map(apply),
    present: apply(h.present),
    future: h.future.map(apply),
  }),
};

const ids = Array.from({ length: 10 }, (_, i) => `e${i}`);
const tabIds = ['t1', 't2', 't3'];

const pick = <T>(rand: () => number, list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)]!;

function randomElement(rand: () => number, id = pick(rand, ids)): Element {
  return {
    id,
    type: 'shape',
    shape: 'square',
    x: Math.floor(rand() * 100),
    y: Math.floor(rand() * 100),
    width: 10,
    height: 10,
    // Answers: kept from our copy on merge (same round), grafted from the present on undo.
    ...(rand() < 0.3
      ? { responses: [{ participantId: 'p', value: `r${Math.floor(rand() * 5)}`, at: 1 }] }
      : {}),
    // Ticks: kept from our copy on merge.
    ...(rand() < 0.2 ? { checklistItems: [{ text: 'a', done: rand() < 0.5 }] } : {}),
    // A board's set-up: ours on a person's `el`, the agent's on a changeset.
    ...(rand() < 0.2
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

function randomElementOp(rand: () => number): ElementOp {
  const roll = rand();
  if (roll < 0.5) return { kind: 'update', element: randomElement(rand) };
  if (roll < 0.75)
    return { kind: 'add', element: randomElement(rand), at: Math.floor(rand() * 12) };
  if (roll < 0.93) return { kind: 'remove', id: pick(rand, ids) };
  return { kind: 'reorder', ids: [...ids].sort(() => rand() - 0.5).slice(0, 6) };
}

const layout = (height: number): DashboardLayout => ({
  rows: [{ id: 'r1', height, slots: [{ id: 's1', span: 12 }] }],
});

function randomRemoteOp(rand: () => number): RoomOp {
  const tabId = pick(rand, tabIds);
  const roll = rand();
  if (roll < 0.4) return { kind: 'el', tabId, op: randomElementOp(rand) };
  if (roll < 0.45)
    return { kind: 'el', tabId, op: { kind: 'patch', id: pick(rand, ids), set: { label: 'p' } } };
  if (roll < 0.65) {
    const elementOps = Array.from({ length: 1 + Math.floor(rand() * 12) }, () =>
      randomElementOp(rand),
    );
    const extra = rand();
    return {
      kind: 'changeset',
      tabId,
      id: 'cs_0000000001',
      rev: 2,
      prevRev: null,
      author: { name: 'Webber', color: '#0ea5e9' },
      counts: { added: 0, changed: elementOps.length, removed: 0 },
      elementOps,
      // Now and then a created tab or a rebuilt Dashboard, which is applied alone, not in a run.
      ...(extra < 0.1 ? { tab: { id: tabId, name: `agent ${tabId}` } } : {}),
      ...(extra > 0.9 ? { dashboard: layout(100 + Math.floor(rand() * 5)) } : {}),
    };
  }
  if (roll < 0.72) {
    return {
      kind: 'el-delta',
      tabId,
      elementId: pick(rand, ids),
      delta: { kind: 'response', participantId: 'q', value: `v${Math.floor(rand() * 3)}`, at: 2 },
    };
  }
  if (roll < 0.78) {
    return {
      kind: 'dashboard-delta',
      tabId,
      patch: { rows: { r1: { set: { height: 200 + Math.floor(rand() * 9) } } } },
    };
  }
  if (roll < 0.9) {
    const elements = Array.from({ length: Math.floor(rand() * 6) }, () => randomElement(rand));
    return {
      kind: 'tab',
      tabId,
      tab: {
        id: tabId,
        name: `peer ${tabId}`,
        elements,
        ...(rand() < 0.3 ? { kind: 'dashboard' as const, dashboard: layout(320) } : {}),
      },
    };
  }
  if (roll < 0.96)
    return { kind: 'tab-meta', tabId, patch: { name: `renamed ${Math.floor(rand() * 3)}` } };
  // A peer's tab list: reordered, sometimes a tab dropped or added.
  return {
    kind: 'project-meta',
    name: 'Plan',
    tabs: [...tabIds]
      .sort(() => rand() - 0.5)
      .slice(0, 2 + Math.floor(rand() * 2))
      .map((id, orderIndex) => ({ id, name: id, orderIndex })),
  };
}

// One of my own edits: move, add or delete an element on a tab.
function randomLocalEdit(rand: () => number): (tabs: Tab[]) => Tab[] {
  const tabId = pick(rand, tabIds);
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
  { id: 't2', name: 'Two', elements: [], kind: 'dashboard', dashboard: layout(320) },
];

const sameAs = (lz: History, eg: Eager) => {
  expect(lz.present).toEqual(eg.present);
  expect(lz.past.length).toBe(eg.past.length);
  expect(lz.future.length).toBe(eg.future.length);
  expect(lz.depth ?? 0).toBe(eg.depth);
  expect(lz.branch ?? 0).toBe(eg.branch);
};

describe('history rebasing, lazily against eagerly', () => {
  for (const [seed, remoteShare, steps] of [
    [1, 0.5, 1500],
    [2, 0.8, 1500],
    [3, 0.3, 1500],
  ] as const) {
    it(`shows what the eager history showed (seed ${seed})`, () => {
      const rand = seededRandom(seed);
      let lz: History = { past: [], present: start(), future: [] };
      let eg: Eager = { past: [], present: start(), future: [], depth: 0, branch: 0 };
      for (let n = 0; n < steps; n++) {
        if (rand() < remoteShare) {
          const op = randomRemoteOp(rand);
          // As the editor logs it (remoteRoomOp: element ops in runs), against the plain op on every snapshot.
          lz = historyApplyRemoteOp(lz, remoteRoomOp(op));
          eg = eager.remote(eg, (tabs) => applyRoomOpToTabs(tabs, op));
        } else {
          const action = Math.floor(rand() * 7);
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
          } else if (action === 5) {
            lz = historyMarkCheckpoint(lz);
            eg = eager.checkpoint(eg);
          } else {
            // A card change (useItemUndo): a new step that is not a snapshot.
            lz = historyClearRedo(lz);
            eg = eager.clearRedo(eg);
          }
        }
        sameAs(lz, eg);
      }
      // Every step back and forward again restores what the eager history restored.
      while (eg.past.length > 0) {
        lz = historyUndo(lz);
        eg = eager.undo(eg);
        sameAs(lz, eg);
      }
      while (eg.future.length > 0) {
        lz = historyRedo(lz);
        eg = eager.redo(eg);
        sameAs(lz, eg);
      }
    });
  }
});
