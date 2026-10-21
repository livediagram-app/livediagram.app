import { PREVIEW_WARMUP_MS, TOOLTIP_WARMUP_MS, type HintKind } from './hint-constants';

// Page-wide hint state: the one open hint (spec: one at a time) and the
// warm-up clocks of the hints that wait before opening (tooltip, preview). Module state, because hints are independent React
// trees with no common provider.

// A hint identifies itself with a token that lives as long as it does, so
// its close callback may change identity between renders.
export type HintToken = object;

type Holder = { token: HintToken; close: () => void; kind: HintKind };

let holder: Holder | null = null;
// The kinds with an open delay, and how long each stays warm after one of them closes.
const WARMUP_MS: Partial<Record<HintKind, number>> = {
  tooltip: TOOLTIP_WARMUP_MS,
  preview: PREVIEW_WARMUP_MS,
};
const closedAt = new Map<HintKind, number>();

// Take the open slot, closing whichever hint held it.
export function claimHint(token: HintToken, close: () => void, kind: HintKind): void {
  const previous = holder;
  holder = { token, close, kind };
  if (previous && previous.token !== token) previous.close();
}

// Give the slot back. A delayed kind closing starts its warm-up window.
export function releaseHint(token: HintToken, kind: HintKind, now: number): void {
  if (WARMUP_MS[kind] !== undefined) {
    closedAt.set(kind, Math.max(closedAt.get(kind) ?? Number.NEGATIVE_INFINITY, now));
  }
  if (holder?.token === token) holder = null;
}

// A tooltip or a preview may skip its delay while another of its kind is open
// or has just closed: scanning a row of controls reads each name at once, and
// moving down a table shows each row's preview at once. A hover card has no
// delay to skip.
export function isHintWarm(kind: HintKind, now: number): boolean {
  const warmup = WARMUP_MS[kind];
  if (warmup === undefined) return false;
  if (holder?.kind === kind) return true;
  return now - (closedAt.get(kind) ?? Number.NEGATIVE_INFINITY) < warmup;
}

export function resetHintRegistry(): void {
  holder = null;
  closedAt.clear();
}
