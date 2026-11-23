// Whether a walkthrough met a tier's limit (liveworkspace/docs/specs/006-media/walkthroughs.md "With Pro on"), from
// the numbers the server answered. Apart from limit-words.ts on purpose: the dock and the list read these in the
// editor's first load, and the sentences (with the contract's tier table behind them) load with the notices.

import type { WalkthroughLimits } from '@liveworkspace/media/walkthrough';

/** "5 minutes", "1 minute". */
export const minutesOf = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
};

/** A recording that ran to its limit, give or take the clock's last tick. */
export function stoppedAtLimit(durationMs: number, maxMs: number): boolean {
  return durationMs >= maxMs - 1000;
}

/** Whether the person already keeps as many walkthroughs as they may. */
export function storedFull(limits: WalkthroughLimits | null | undefined): boolean {
  return !!limits && limits.storedLimit !== null && limits.stored >= limits.storedLimit;
}

/** The save card's note for a recording that ran to its limit. With the server's limit it says the minutes; without
 *  one (Pro off) it is the line it always was. */
export function stoppedNote(maxMs: number, tiered: boolean): string {
  return tiered
    ? `Stopped at ${minutesOf(maxMs)}, the longest this may record.`
    : 'Stopped at 10 minutes, the longest a walkthrough may be.';
}
