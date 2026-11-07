import { describe, expect, it } from 'vitest';
import type { ArcadeScore, ElementDelta, ShapeElement, Tab } from './index';
import {
  applyElementDelta,
  ARCADE_SCORES_MAX,
  elementChangeIsDeltaOnly,
  graftLiveTabState,
  ledgerKey,
  mergeIncomingElement,
  mergeLedgerAnswersIntoTab,
  mergeLedgerIntoTab,
  recordInLedger,
  tabLedgerFrom,
  type ElementLedger,
  type TabLedger,
} from './index';

// An Arcade Machine's High Scores travel as deltas (docs/specs/009-elements/social-pieces.md "High Scores";
// docs/specs/012-collaboration/collab-race-hardening.md).

const machine = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'arcade',
  type: 'shape',
  shape: 'arcade-machine',
  x: 0,
  y: 0,
  width: 64,
  height: 112,
  ...over,
});

const score = (id: string, points: number, at = 1): ArcadeScore => ({
  id,
  name: 'Ann',
  score: points,
  ms: 60_000,
  by: 'adder-a',
  at,
});

const post = (s: ArcadeScore): ElementDelta => ({ kind: 'arcade-score', score: s });
const CLEAR: ElementDelta = { kind: 'arcade-clear' };
const apply = (el: ShapeElement, ...deltas: ElementDelta[]) =>
  deltas.reduce<ShapeElement>((e, d) => applyElementDelta(e, d) as ShapeElement, el);
const ids = (el: ShapeElement | Tab['elements'][number]) =>
  ((el as ShapeElement).arcadeScores ?? []).map((s) => s.id);
const ten = Array.from({ length: ARCADE_SCORES_MAX }, (_, i) => score(`s${i}`, 500 - i * 10));

describe('arcade-score and arcade-clear', () => {
  it('puts a posted score in its place, best first', () => {
    const el = apply(machine(), post(score('a', 30)), post(score('b', 50)), post(score('c', 40)));
    expect(ids(el)).toEqual(['b', 'c', 'a']);
  });
  it('cuts the table to ten and drops a score that does not make it', () => {
    const full = machine({ arcadeScores: ten });
    const better = apply(full, post(score('x', 455)));
    expect(ids(better)).toHaveLength(ARCADE_SCORES_MAX);
    expect(ids(better)[5]).toBe('x');
    expect(ids(better)).not.toContain('s9');
    expect(applyElementDelta(full, post(score('y', 410)))).toBe(full);
  });
  it('changes nothing for a replay, a bad score or another kind of piece', () => {
    const one = apply(machine(), post(score('a', 30)));
    expect(applyElementDelta(one, post(score('a', 90)))).toBe(one);
    expect(applyElementDelta(one, post({ ...score('b', 30), score: 1e9 }))).toBe(one);
    const board = machine({ shape: 'notice-board' });
    expect(applyElementDelta(board, post(score('a', 30)))).toBe(board);
    expect(applyElementDelta(board, CLEAR)).toBe(board);
    const sticky = { id: 's', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as never;
    expect(applyElementDelta(sticky, post(score('a', 30)))).toBe(sticky);
  });
  it('takes a score on a locked machine (a lock fixes where it stands)', () => {
    expect(ids(apply(machine({ locked: true }), post(score('a', 30))))).toEqual(['a']);
  });
  it('empties the table on a clear, and a clear of an empty one changes nothing', () => {
    const cleared = apply(machine({ arcadeScores: ten }), CLEAR);
    expect(cleared.arcadeScores).toBeUndefined();
    expect('arcadeScores' in cleared).toBe(false);
    const empty = machine();
    expect(applyElementDelta(empty, CLEAR)).toBe(empty);
  });
  it('lands two scores posted at once in either order', () => {
    const a = post(score('a', 30));
    const b = post(score('b', 30, 0));
    expect(apply(machine(), a, b)).toEqual(apply(machine(), b, a));
  });
});

describe('whole-element changes keep the table', () => {
  it("keeps the receiver's table over a peer's update, and its absence", () => {
    const local = machine({ arcadeScores: [score('a', 30)] });
    const moved = machine({ x: 40, arcadeScores: [] });
    const merged = mergeIncomingElement(local, moved) as ShapeElement;
    expect(merged.x).toBe(40);
    expect(ids(merged)).toEqual(['a']);
    const none = mergeIncomingElement(machine(), moved) as ShapeElement;
    expect('arcadeScores' in none).toBe(false);
  });
  it('sends no update for a scores-only change', () => {
    const before = machine();
    expect(elementChangeIsDeltaOnly(before, apply(before, post(score('a', 30))))).toBe(true);
    expect(elementChangeIsDeltaOnly(before, machine({ x: 5 }))).toBe(false);
  });
  it('keeps the live table over an undo or redo', () => {
    const live: Tab[] = [
      { id: 't', name: 'T', elements: [machine({ arcadeScores: [score('a', 30)] })] },
    ];
    const snapshot: Tab[] = [{ id: 't', name: 'T', elements: [machine({ x: 9 })] }];
    const grafted = graftLiveTabState(live, snapshot)[0]!.elements[0] as ShapeElement;
    expect(grafted.x).toBe(9);
    expect(ids(grafted)).toEqual(['a']);
    const back = graftLiveTabState(
      [{ id: 't', name: 'T', elements: [machine()] }],
      [{ id: 't', name: 'T', elements: [machine({ arcadeScores: [score('a', 30)] })] }],
    )[0]!.elements[0] as ShapeElement;
    expect('arcadeScores' in back).toBe(false);
  });
});

describe('the ledger', () => {
  const op = (d: ElementDelta) => ({ kind: 'el-delta', tabId: 't', elementId: 'arcade', delta: d });
  function ledgerOf(deltas: ElementDelta[]): { ledger: TabLedger; entry: ElementLedger } {
    const store = new Map<string, unknown>();
    deltas.forEach((d, i) => {
      const key = ledgerKey(op(d))!;
      const next = recordInLedger(store.get(key) as ElementLedger | undefined, op(d), i + 1);
      if (next) store.set(key, next);
    });
    const ledger = tabLedgerFrom('t', store);
    return { ledger, entry: ledger.elements.arcade! };
  }
  const tab = (el: ShapeElement): Tab => ({ id: 't', name: 'T', elements: [el] });

  it('keeps only the ten best scores, however many are posted', () => {
    const many = Array.from({ length: 40 }, (_, i) => post(score(`p${i}`, 10 + i)));
    const { entry } = ledgerOf(many);
    const kept = Object.values(entry.arcade!.scores).map((e) => e.score.score);
    expect(kept).toHaveLength(ARCADE_SCORES_MAX);
    expect(Math.min(...kept)).toBe(10 + 30);
  });
  it('records a clear on a machine with nothing yet', () => {
    expect(recordInLedger(undefined, op(CLEAR), 4)).toEqual({ arcade: { scores: {}, cleared: 4 } });
  });
  it('refuses a bad score or a replay, and keeps the latest clear', () => {
    expect(recordInLedger(undefined, op(post({ ...score('a', 1), ms: 0 })), 1)).toBe(null);
    const { entry } = ledgerOf([
      post(score('a', 30)),
      post(score('a', 60)),
      CLEAR,
      post(score('b', 20)),
    ]);
    expect(entry.arcade!.cleared).toBe(3);
    expect(Object.keys(entry.arcade!.scores)).toEqual(['b']);
  });
  it("merges what a save hadn't seen into it, in the room's order", () => {
    const { ledger } = ledgerOf([post(score('a', 30)), CLEAR, post(score('b', 20))]);
    // A save from before everything: the clear and b.
    const old = mergeLedgerIntoTab(tab(machine({ arcadeScores: [score('z', 99)] })), ledger, 0);
    expect(ids(old.elements[0]!)).toEqual(['b']);
    // A save that saw the clear already: only b.
    const late = mergeLedgerIntoTab(tab(machine()), ledger, 2);
    expect(ids(late.elements[0]!)).toEqual(['b']);
    // A save that saw it all: nothing to do.
    const current = tab(machine({ arcadeScores: [score('b', 20)] }));
    expect(mergeLedgerIntoTab(current, ledger, 3)).toBe(current);
  });
  it("writes a Participant's scores into the stored machine with its answers", () => {
    const { ledger } = ledgerOf([post(score('a', 30)), post(score('b', 50))]);
    const stored = mergeLedgerAnswersIntoTab(tab(machine()), ledger);
    expect(ids(stored.elements[0]!)).toEqual(['b', 'a']);
    // Idempotent: written again, nothing changes.
    expect(mergeLedgerAnswersIntoTab(stored, ledger)).toBe(stored);
  });
  it('never rewrites the stored tab for a clear it already holds (every later flush replays it from 0)', () => {
    const { ledger } = ledgerOf([
      post(score('a', 30)),
      CLEAR,
      post(score('b', 20)),
      post(score('c', 40)),
    ]);
    const stored = mergeLedgerAnswersIntoTab(
      tab(machine({ arcadeScores: [score('a', 30)] })),
      ledger,
    );
    expect(ids(stored.elements[0]!)).toEqual(['c', 'b']);
    // A later flush, say for somebody's reaction on the tab: the clear and the scores rebuild the same table.
    expect(mergeLedgerAnswersIntoTab(stored, ledger)).toBe(stored);
    // A clear with nothing after it, on a machine already empty: the same tab too.
    const empty = tab(machine());
    expect(mergeLedgerAnswersIntoTab(empty, ledgerOf([post(score('a', 30)), CLEAR]).ledger)).toBe(
      empty,
    );
  });
});
