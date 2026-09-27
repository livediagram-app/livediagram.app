import { TOOLTIP_WARMUP_MS, type HintKind } from './hint-constants';

// Page-wide hint state: the one open hint (spec: one at a time) and the
// tooltip warm-up clock. Module state, because hints are independent React
// trees with no common provider.

// A hint identifies itself with a token that lives as long as it does, so
// its close callback may change identity between renders.
export type HintToken = object;

type Holder = { token: HintToken; close: () => void; kind: HintKind };

let holder: Holder | null = null;
let tooltipClosedAt = Number.NEGATIVE_INFINITY;

// Take the open slot, closing whichever hint held it.
export function claimHint(token: HintToken, close: () => void, kind: HintKind): void {
  const previous = holder;
  holder = { token, close, kind };
  if (previous && previous.token !== token) previous.close();
}

// Give the slot back. A tooltip closing starts the warm-up window.
export function releaseHint(token: HintToken, kind: HintKind, now: number): void {
  if (kind === 'tooltip') tooltipClosedAt = Math.max(tooltipClosedAt, now);
  if (holder?.token === token) holder = null;
}

// A tooltip may skip its delay while another tooltip is open or has just
// closed: scanning a row of controls reads each name at once.
export function isTooltipWarm(now: number): boolean {
  if (holder?.kind === 'tooltip') return true;
  return now - tooltipClosedAt < TOOLTIP_WARMUP_MS;
}

export function resetHintRegistry(): void {
  holder = null;
  tooltipClosedAt = Number.NEGATIVE_INFINITY;
}
