// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activeTour, setActiveTour, useActiveTour } from './tour-active';

// One guided tour at a time (docs/specs/026-plan/plan-tour.md "Where it appears").

afterEach(() => {
  setActiveTour('welcome', false);
  setActiveTour('plan', false);
});

describe('tour-active', () => {
  it('starts empty, and holds the tour that claimed it', () => {
    expect(activeTour()).toBeNull();
    setActiveTour('welcome', true);
    expect(activeTour()).toBe('welcome');
  });

  it('is released only by the tour holding it', () => {
    setActiveTour('welcome', true);
    setActiveTour('plan', false);
    expect(activeTour()).toBe('welcome');
    setActiveTour('welcome', false);
    expect(activeTour()).toBeNull();
  });

  it('re-renders a reader when it changes', () => {
    const { result } = renderHook(() => useActiveTour());
    expect(result.current).toBeNull();
    act(() => setActiveTour('plan', true));
    expect(result.current).toBe('plan');
    act(() => setActiveTour('plan', false));
    expect(result.current).toBeNull();
  });
});
