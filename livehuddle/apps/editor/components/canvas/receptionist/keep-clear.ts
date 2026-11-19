// What the Receptionist's bubble keeps clear of (docs/specs/008-canvas/receptionist.md "His bubble", Work Tracker
// 1256): a control on the canvas that must stay pressable while he talks, such as a Reception Desk's Welcome bubble
// with its Ring Bell. Each one carries KEEP_CLEAR_ATTR; his card moves sideways off it, or, when no side has the room,
// stands taller over his head until it clears it.

/** Marks a control his bubble never covers. */
export const KEEP_CLEAR_ATTR = 'data-bubble-keep-clear';

/** A box on the screen, in px. */
export type ScreenBox = { left: number; right: number; top: number; bottom: number };

// Screen px the card keeps from a control it moves off.
const CLEAR_GAP = 8;

const overlaps = (a: ScreenBox, b: ScreenBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The card's sideways nudge (screen px) that keeps it off every box in `keep`. `card` is where the card stands with no
 * nudge; `nudge` is the one that keeps it inside the canvas (`minX` to `maxX`). Returns that nudge when the card covers
 * no box there; else the nearest nudge to it whose card covers none and stays inside, the card's edge `CLEAR_GAP` from
 * a box's. `null` when no such nudge fits (a phone's narrow canvas): the caller trims the card instead.
 */
export function clearNudge(
  card: ScreenBox,
  nudge: number,
  keep: readonly ScreenBox[],
  minX: number,
  maxX: number,
): number | null {
  const at = (n: number): ScreenBox => ({ ...card, left: card.left + n, right: card.right + n });
  const clear = (n: number) => keep.every((box) => !overlaps(at(n), box));
  if (clear(nudge)) return nudge;
  let best: number | null = null;
  for (const box of keep) {
    for (const n of [box.right + CLEAR_GAP - card.left, box.left - CLEAR_GAP - card.right]) {
      const placed = at(n);
      if (placed.left < minX || placed.right > maxX || !clear(n)) continue;
      if (best === null || Math.abs(n - nudge) < Math.abs(best - nudge)) best = n;
    }
  }
  return best;
}

/**
 * How much (screen px) to take off the card's top so it stands clear of every box in `keep` it covers, or 0. The
 * card's foot stays on his head (its tail points at him), so it can only stand shorter: the caller caps its height
 * and its replies scroll inside.
 */
export function clearTrim(card: ScreenBox, keep: readonly ScreenBox[]): number {
  let trim = 0;
  for (const box of keep)
    if (overlaps(card, box)) trim = Math.max(trim, box.bottom + CLEAR_GAP - card.top);
  return trim;
}
