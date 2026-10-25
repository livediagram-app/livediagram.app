import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimHint, isHintWarm, releaseHint, resetHintRegistry } from './hint-registry';
import { PREVIEW_WARMUP_MS, TOOLTIP_WARMUP_MS } from './hint-constants';

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
    expect(isHintWarm('tooltip', 0)).toBe(false);
  });

  it('is warm while a tooltip is open', () => {
    claimHint({}, () => {}, 'tooltip');
    expect(isHintWarm('tooltip', 10_000)).toBe(true);
  });

  it('stays warm for the warm-up window after a tooltip closes, then cools', () => {
    const close = () => {};
    const closeToken = {};
    claimHint(closeToken, close, 'tooltip');
    releaseHint(closeToken, 'tooltip', 1_000);
    expect(isHintWarm('tooltip', 1_000 + TOOLTIP_WARMUP_MS - 1)).toBe(true);
    expect(isHintWarm('tooltip', 1_000 + TOOLTIP_WARMUP_MS)).toBe(false);
  });

  it('is not warmed by a hover card', () => {
    const close = () => {};
    const closeToken = {};
    claimHint(closeToken, close, 'hover-card');
    expect(isHintWarm('tooltip', 0)).toBe(false);
    releaseHint(closeToken, 'hover-card', 0);
    expect(isHintWarm('tooltip', 1)).toBe(false);
  });

  it('warms previews by previews, apart from tooltips', () => {
    const token = {};
    claimHint(token, () => {}, 'preview');
    expect(isHintWarm('preview', 0)).toBe(true);
    expect(isHintWarm('tooltip', 0)).toBe(false);
    releaseHint(token, 'preview', 1_000);
    expect(isHintWarm('preview', 1_000 + PREVIEW_WARMUP_MS - 1)).toBe(true);
    expect(isHintWarm('preview', 1_000 + PREVIEW_WARMUP_MS)).toBe(false);
    expect(isHintWarm('tooltip', 1_001)).toBe(false);
  });

  it('never warms a hover card, which has no delay', () => {
    claimHint({}, () => {}, 'hover-card');
    expect(isHintWarm('hover-card', 0)).toBe(false);
  });

  it('ignores a release from a hint that no longer holds the slot', () => {
    const first = () => {};
    const firstToken = {};
    const second = () => {};
    const secondToken = {};
    claimHint(firstToken, first, 'tooltip');
    claimHint(secondToken, second, 'tooltip');
    releaseHint(firstToken, 'tooltip', 0);
    expect(isHintWarm('tooltip', 10_000)).toBe(true); // second is still open
  });
});
