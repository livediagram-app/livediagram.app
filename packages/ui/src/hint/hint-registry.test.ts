import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimHint, isTooltipWarm, releaseHint, resetHintRegistry } from './hint-registry';
import { TOOLTIP_WARMUP_MS } from './hint-constants';

afterEach(() => resetHintRegistry());

describe('hint registry', () => {
  it('closes the previous hint when another opens', () => {
    const first = vi.fn();
    const firstToken = {};
    const second = vi.fn();
    const secondToken = {};
    claimHint(firstToken, first, 'tooltip');
    claimHint(secondToken, second, 'hover-card');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('does not close a hint that claims again', () => {
    const close = vi.fn();
    const closeToken = {};
    claimHint(closeToken, close, 'tooltip');
    claimHint(closeToken, close, 'tooltip');
    expect(close).not.toHaveBeenCalled();
  });

  it('is cold until a tooltip has opened', () => {
    expect(isTooltipWarm(0)).toBe(false);
  });

  it('is warm while a tooltip is open', () => {
    claimHint({}, () => {}, 'tooltip');
    expect(isTooltipWarm(10_000)).toBe(true);
  });

  it('stays warm for the warm-up window after a tooltip closes, then cools', () => {
    const close = () => {};
    const closeToken = {};
    claimHint(closeToken, close, 'tooltip');
    releaseHint(closeToken, 'tooltip', 1_000);
    expect(isTooltipWarm(1_000 + TOOLTIP_WARMUP_MS - 1)).toBe(true);
    expect(isTooltipWarm(1_000 + TOOLTIP_WARMUP_MS)).toBe(false);
  });

  it('is not warmed by a hover card', () => {
    const close = () => {};
    const closeToken = {};
    claimHint(closeToken, close, 'hover-card');
    expect(isTooltipWarm(0)).toBe(false);
    releaseHint(closeToken, 'hover-card', 0);
    expect(isTooltipWarm(1)).toBe(false);
  });

  it('ignores a release from a hint that no longer holds the slot', () => {
    const first = () => {};
    const firstToken = {};
    const second = () => {};
    const secondToken = {};
    claimHint(firstToken, first, 'tooltip');
    claimHint(secondToken, second, 'tooltip');
    releaseHint(firstToken, 'tooltip', 0);
    expect(isTooltipWarm(10_000)).toBe(true); // second is still open
  });
});
