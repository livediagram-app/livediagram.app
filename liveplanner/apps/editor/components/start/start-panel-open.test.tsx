import { describe, expect, it, vi } from 'vitest';
import { noteStartPanelLeft, startPanelJustLeft } from './start-panel-open';

// A mode change on an empty tab swaps one start panel for another: the new one turns in place.
describe('a start panel swapped for another', () => {
  it('counts as a swap only just after one left', () => {
    vi.useFakeTimers();
    noteStartPanelLeft();
    expect(startPanelJustLeft()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(startPanelJustLeft()).toBe(false);
    vi.useRealTimers();
  });
});
