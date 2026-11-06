// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activeTour, setActiveTour, useActiveTour } from './tour-active';

// One guided tour at a time (docs/specs/007-editor/editor-tour.md).

afterEach(() => {
  setActiveTour('avatar', false);
  setActiveTour('element', false);
});

describe('tour-active', () => {
  it('starts empty, and holds the tour that claimed it', () => {
    expect(activeTour()).toBeNull();
    setActiveTour('avatar', true);
    expect(activeTour()).toBe('avatar');
  });

  it('is released only by the tour holding it', () => {
    setActiveTour('avatar', true);
    setActiveTour('element', false);
    expect(activeTour()).toBe('avatar');
    setActiveTour('avatar', false);
    expect(activeTour()).toBeNull();
  });

  it('re-renders a reader when it changes', () => {
    const { result } = renderHook(() => useActiveTour());
    expect(result.current).toBeNull();
    act(() => setActiveTour('element', true));
    expect(result.current).toBe('element');
    act(() => setActiveTour('element', false));
    expect(result.current).toBeNull();
  });
});
