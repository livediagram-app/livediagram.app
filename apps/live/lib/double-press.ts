// The double-press rule (docs/specs/008-canvas/arrow-bending.md, blueprint
// docs/specs/008-canvas/blueprints/arrow-bending.md).
//
// A fast double-click on an element means "edit this element". The first
// click selects it, which makes handles appear under the pointer; the second
// click must not operate them. So every element press is recorded, and a
// press that pairs with the previous one never starts a drag, and a press on a
// handle that only appeared because of the previous press (an echo) is routed
// to the element's edit instead.
//
// Counted from presses rather than the browser's `dblclick`, which is
// unreliable on touch and targets whatever sits under the second click.

/** Milliseconds between two presses that still count as one double-press. The
 *  platform default sits around 500ms; a touch below that keeps a deliberate
 *  double-tap comfortable without pairing two unrelated clicks. */
export const DOUBLE_PRESS_MS = 450;
/** Screen pixels the second press may land from the first. */
export const DOUBLE_PRESS_SLOP_PX = 8;

export type ElementPress = {
  id: string;
  // Event timestamp (ms, monotonic).
  t: number;
  // Screen position.
  x: number;
  y: number;
  // Whether the element was already selected when pressed: if it was, its
  // handles were already showing and a press on one is deliberate.
  wasSelected: boolean;
};

export function pairsWith(prev: ElementPress | null, next: ElementPress): boolean {
  if (!prev || prev.id !== next.id) return false;
  const dt = next.t - prev.t;
  return (
    dt >= 0 &&
    dt <= DOUBLE_PRESS_MS &&
    Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_PRESS_SLOP_PX
  );
}

export function isEchoPress(prev: ElementPress | null, next: ElementPress): boolean {
  return pairsWith(prev, next) && !prev!.wasSelected;
}

export type PressVerdict = { pairs: boolean; echo: boolean };

export function createPressLedger() {
  let last: ElementPress | null = null;
  const judge = (p: ElementPress): PressVerdict => ({
    pairs: pairsWith(last, p),
    echo: isEchoPress(last, p),
  });
  return {
    // Judge a press against the previous one, then record it. A press that
    // completed a pair is not recorded, so a third press starts afresh.
    press(p: ElementPress): PressVerdict {
      const verdict = judge(p);
      last = verdict.pairs ? null : p;
      if (verdict.pairs) console.debug('[double-press]', p.id, verdict.echo ? 'echo' : 'pair');
      return verdict;
    },
    peek: judge,
  };
}

// One canvas per page, so one ledger: presses on boxes, arrows, labels and
// handles all land here.
export const pressLedger = createPressLedger();
