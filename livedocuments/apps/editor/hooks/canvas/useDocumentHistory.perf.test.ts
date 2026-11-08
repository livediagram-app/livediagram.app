import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, ElementOp } from '@livedocuments/document';
import type { RoomOp } from '@livedocuments/api-schema';
import { remoteRoomOp } from '@/app/document/[id]/room-op-apply';
import {
  HISTORY_LIMIT,
  historyApplyRemoteOp,
  historyCommit,
  historyUndo,
  type History,
} from './useDocumentHistory';

// docs/specs/012-collaboration/realtime-conflict-resolution.md "Locked decisions" and
// docs/specs/024-agents/agent-changesets.md "In the editor": a peer's op and an agent's changeset cost one pass over
// the tab on screen, however deep the undo history. Applied to every snapshot on arrival, a 500-update changeset on a
// 2,000-element tab with 500 steps took 5.9 s and 20 peer `el` ops 251 ms; now about 1 ms and 0.2 ms.

const ELEMENTS = 2_000;
const STEPS = HISTORY_LIMIT;
const CHANGESET_BUDGET_MS = 50;
const PEER_SAVE_BUDGET_MS = 20;
const PEER_SAVE_OPS = 20;
const WARM_UP_PASSES = 2;
// A peer flood with nobody stepping: the log fills and the snapshots take its oldest half, run by run. Applied to
// every snapshot on arrival this cost about 12 ms per op (6 s per 500); measured about 0.8 ms per op here.
const FLOOD_OPS = 500;
const FLOOD_BUDGET_MS = 1_500;

// A plain box, with the fields these tests read.
type Box = Element & { x: number; y: number; label?: string };

const box = (i: number): Element => ({
  id: `e${i}`,
  type: 'shape',
  shape: 'square',
  x: i,
  y: i,
  width: 100,
  height: 60,
  label: `L${i}`,
});

// A 2,000-element tab and a second tab, with STEPS undo steps each moving one element of the first.
function deepHistory(): History {
  let h: History = {
    past: [],
    present: [
      { id: 't1', name: 'Board', elements: Array.from({ length: ELEMENTS }, (_, i) => box(i)) },
      { id: 't2', name: 'Other', elements: [box(0)] },
    ],
    future: [],
  };
  for (let s = 0; s < STEPS; s++) {
    h = historyCommit(h, (tabs) =>
      tabs.map((t) =>
        t.id === 't1'
          ? {
              ...t,
              elements: t.elements.map((e, i) =>
                i === s % ELEMENTS ? { ...e, x: (e as Box).x + 1 } : e,
              ),
            }
          : t,
      ),
    );
  }
  return h;
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

const applyOp = (h: History, op: RoomOp) => historyApplyRemoteOp(h, remoteRoomOp(op));

describe('remote ops against a deep history', () => {
  const h = deepHistory();
  const updates = Array.from({ length: 500 }, (_, k): ElementOp => ({
    kind: 'update',
    element: { ...box(k * 4), label: 'agent' } as Element,
  }));
  const peerOps = Array.from({ length: PEER_SAVE_OPS }, (_, k): RoomOp => ({
    kind: 'el',
    tabId: 't1',
    op: { kind: 'update', element: { ...box((k * 37) % ELEMENTS), y: 999 + k } as Element },
  }));

  it(`applies a 500-update changeset on ${ELEMENTS} elements and ${STEPS} steps inside ${cpuBudgetMs(CHANGESET_BUDGET_MS)} ms`, () => {
    for (let pass = 0; pass < WARM_UP_PASSES; pass++) applyOp(h, changeset(updates));
    const best = Math.min(
      ...[0, 1, 2].map(() => cpuMsOf(() => void applyOp(h, changeset(updates)))),
    );
    expect(best).toBeLessThan(cpuBudgetMs(CHANGESET_BUDGET_MS));
  });

  it(`applies a ${PEER_SAVE_OPS}-op peer save on ${ELEMENTS} elements and ${STEPS} steps inside ${cpuBudgetMs(PEER_SAVE_BUDGET_MS)} ms`, () => {
    const save = () => peerOps.reduce(applyOp, h);
    for (let pass = 0; pass < WARM_UP_PASSES; pass++) save();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(() => void save())));
    expect(best).toBeLessThan(cpuBudgetMs(PEER_SAVE_BUDGET_MS));
  });

  it(`takes ${FLOOD_OPS} peer ops past a full log on ${ELEMENTS} elements and ${STEPS} steps inside ${cpuBudgetMs(FLOOD_BUDGET_MS)} ms`, () => {
    const flood = Array.from({ length: 2 * FLOOD_OPS }, (_, k): RoomOp => ({
      kind: 'el',
      tabId: 't1',
      op: { kind: 'update', element: { ...box((k * 37) % ELEMENTS), y: k } as Element },
    }));
    const full = flood.slice(0, FLOOD_OPS).reduce(applyOp, h);
    const spent = cpuMsOf(() => void flood.slice(FLOOD_OPS).reduce(applyOp, full));
    expect(spent).toBeLessThan(cpuBudgetMs(FLOOD_BUDGET_MS));
    // The budget is CPU time; the wall-clock timeout only stops a hang. Filling the log first is untimed and can take
    // seconds on a loaded machine, past the 5 s default.
  }, 60_000);

  it('keeps the snapshots sharing a tab the peer changed and they did not', () => {
    // Fifty steps on the small tab, then a peer save on the big one: the big tab is the same array in every
    // snapshot. Rebasing on arrival gave each snapshot a fresh copy of it.
    let small: History = { past: [], present: h.present, future: [] };
    for (let s = 0; s < 50; s++) {
      small = historyCommit(small, (tabs) =>
        tabs.map((t) =>
          t.id === 't2' ? { ...t, elements: [{ ...box(0), x: s + 1 } as Element] } : t,
        ),
      );
    }
    const next = peerOps.reduce(applyOp, small);
    expect(next.present[0]!.elements).not.toBe(small.present[0]!.elements);
    for (let i = 0; i + 1 < next.past.length; i++) {
      expect(next.past[i]![0]!.elements).toBe(next.past[i + 1]![0]!.elements);
    }
  });

  it("still restores a snapshot with the peers' changes in it", () => {
    const next = historyUndo(peerOps.reduce(applyOp, applyOp(h, changeset(updates))));
    const els = next.present[0]!.elements as Box[];
    expect(els[4]!.label).toBe('agent');
    expect(els[(3 * 37) % ELEMENTS]!.y).toBe(1002);
    // The undone step moved element STEPS - 1 back.
    expect(els[STEPS - 1]!.x).toBe(STEPS - 1);
  });
});
