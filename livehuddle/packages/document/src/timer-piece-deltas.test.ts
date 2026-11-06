import { describe, expect, it } from 'vitest';
import type { ElementDelta, PieceTimer, ShapeElement, Tab } from './index';
import {
  applyElementDelta,
  elementChangeIsDeltaOnly,
  mergeIncomingElement,
  mergeLedgerAnswersIntoTab,
  mergeLedgerIntoTab,
  recordInLedger,
  type ElementLedger,
  type TabLedger,
} from './index';

// A Timer's or Stopwatch's clock travels as one `piece-timer` delta carrying the whole new state
// (docs/specs/009-elements/timer-and-stopwatch.md "How a change travels").

const piece = (shape: 'timer' | 'stopwatch', over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'clock',
  type: 'shape',
  shape,
  x: 0,
  y: 0,
  width: 128,
  height: 88,
  ...over,
});

const running: PieceTimer = {
  running: true,
  startedAt: 1_000,
  accumulatedMs: 0,
  durationMs: 300_000,
};
const paused: PieceTimer = {
  running: false,
  startedAt: 0,
  accumulatedMs: 4_000,
  durationMs: 300_000,
};
const watch: PieceTimer = { running: true, startedAt: 1_000, accumulatedMs: 0, durationMs: 0 };
const press = (state: PieceTimer): ElementDelta => ({ kind: 'piece-timer', state });

describe('piece-timer', () => {
  it('sets the whole clock, last press wins', () => {
    const started = applyElementDelta(piece('timer'), press(running)) as ShapeElement;
    expect(started.pieceTimer).toEqual(running);
    const later = applyElementDelta(started, press(paused)) as ShapeElement;
    expect(later.pieceTimer).toEqual(paused);
    expect(
      (applyElementDelta(piece('stopwatch'), press(watch)) as ShapeElement).pieceTimer,
    ).toEqual(watch);
  });

  it('runs on a locked piece: a lock fixes it in place, not its clock', () => {
    const locked = piece('timer', { locked: true });
    expect((applyElementDelta(locked, press(running)) as ShapeElement).pieceTimer).toEqual(running);
  });

  it('keeps identity when nothing changes, and stores only the four fields', () => {
    const started = applyElementDelta(piece('timer'), press(running));
    expect(applyElementDelta(started, press({ ...running }))).toBe(started);
    const extra = { ...running, note: 'x' } as unknown as PieceTimer;
    const set = applyElementDelta(piece('timer'), press(extra)) as ShapeElement;
    expect(Object.keys(set.pieceTimer!).sort()).toEqual(
      ['accumulatedMs', 'durationMs', 'running', 'startedAt'].sort(),
    );
  });

  it('refuses another kind, a mismatched clock and a malformed one', () => {
    const board = { ...piece('timer'), shape: 'notice-board' } as ShapeElement;
    expect(applyElementDelta(board, press(running))).toBe(board);
    const sticky = { id: 's', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as never;
    expect(applyElementDelta(sticky, press(running))).toBe(sticky);
    const timer = piece('timer');
    const watchEl = piece('stopwatch');
    for (const bad of [
      watch, // a Stopwatch's clock on a Timer (no length)
      { ...running, durationMs: 30_000 }, // under a minute
      { ...running, durationMs: 121 * 60_000 }, // over two hours
      { ...running, accumulatedMs: -1 },
      { ...running, accumulatedMs: 1.5 },
      { ...running, startedAt: Number.NaN },
      { ...running, running: 'yes' },
      null,
    ])
      expect(applyElementDelta(timer, press(bad as PieceTimer))).toBe(timer);
    expect(applyElementDelta(watchEl, press(running))).toBe(watchEl);
  });

  it("keeps the receiver's clock when a peer's whole-element update arrives (a move never stops it)", () => {
    const local = piece('timer', { pieceTimer: running });
    const moved = piece('timer', { x: 50, pieceTimer: paused });
    const merged = mergeIncomingElement(local, moved) as ShapeElement;
    expect(merged.x).toBe(50);
    expect(merged.pieceTimer).toEqual(running);
    const stale = piece('timer', { x: 60 });
    expect((mergeIncomingElement(local, stale) as ShapeElement).pieceTimer).toEqual(running);
    expect(mergeIncomingElement(piece('timer'), moved)).not.toHaveProperty('pieceTimer');
  });

  it('sends no element update when only the clock changed', () => {
    const before = piece('timer');
    expect(elementChangeIsDeltaOnly(before, { ...before, pieceTimer: running })).toBe(true);
    expect(elementChangeIsDeltaOnly(before, { ...before, x: 5, pieceTimer: running })).toBe(false);
  });
});

describe('the ledger keeps the latest clock', () => {
  const op = (delta: ElementDelta) => ({ kind: 'el-delta', tabId: 't', elementId: 'clock', delta });
  const record = (...steps: [ElementDelta, number][]) =>
    steps.reduce<ElementLedger | undefined>(
      (prev, [delta, seq]) => recordInLedger(prev, op(delta), seq) ?? prev,
      undefined,
    );
  const ledgerOf = (entry: ElementLedger | undefined): TabLedger => ({
    elements: entry ? { clock: entry } : {},
  });
  const tabOf = (el: ShapeElement): Tab => ({ id: 't', name: 'T', elements: [el] });
  const clockIn = (tab: Tab) => (tab.elements[0] as ShapeElement).pieceTimer;

  it('records the latest press, refusing a malformed one', () => {
    const entry = record([press(running), 1], [press(paused), 2]);
    expect(entry?.timer).toEqual({ state: paused, seq: 2 });
    expect(recordInLedger(undefined, op(press({ ...running, durationMs: -1 })), 3)).toBeNull();
    expect(record([press(watch), 4])?.timer?.state).toEqual(watch);
  });

  it('merges a press the saver had not seen, and leaves one it had', () => {
    const entry = record([press(paused), 5]);
    const saved = tabOf(piece('timer', { pieceTimer: running }));
    expect(clockIn(mergeLedgerIntoTab(saved, ledgerOf(entry), 4))).toEqual(paused);
    expect(mergeLedgerIntoTab(saved, ledgerOf(entry), 5)).toBe(saved);
  });

  it("writes a Participant's press into the stored tab, and again is a no-op", () => {
    const entry = record([press(running), 7]);
    const stored = tabOf(piece('timer'));
    const written = mergeLedgerAnswersIntoTab(stored, ledgerOf(entry));
    expect(clockIn(written)).toEqual(running);
    expect(mergeLedgerAnswersIntoTab(written, ledgerOf(entry))).toBe(written);
  });
});
