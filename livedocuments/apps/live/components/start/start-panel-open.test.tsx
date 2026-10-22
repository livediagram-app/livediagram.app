// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  noteStartPanelLeft,
  setStartPanelOpen,
  startPanelJustLeft,
  useStartPanelOpen,
} from './start-panel-open';

// docs/specs/007-editor/start-diagramming.md "The tours wait"
describe('start panel open', () => {
  afterEach(() => setStartPanelOpen(false));

  it('tells its readers when a start panel opens and closes', () => {
    const { result } = renderHook(() => useStartPanelOpen());
    expect(result.current).toBe(false);
    act(() => setStartPanelOpen(true));
    expect(result.current).toBe(true);
    act(() => setStartPanelOpen(false));
    expect(result.current).toBe(false);
  });
});

// Moving from one empty tab to another swaps one start panel for another: the new one stays in place.
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
