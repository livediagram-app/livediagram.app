// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activeTour, setActiveTour, useActiveTour } from './tour-active';

// One guided tour at a time (docs/specs/007-editor/pages-tour.md "Where it appears").

afterEach(() => {
  setActiveTour('pages', false);
  setActiveTour('element', false);
});

describe('tour-active', () => {
  it('starts empty, and holds the tour that claimed it', () => {
    expect(activeTour()).toBeNull();
    setActiveTour('pages', true);
    expect(activeTour()).toBe('pages');
  });

  it('is released only by the tour holding it', () => {
    setActiveTour('pages', true);
    setActiveTour('element', false);
    expect(activeTour()).toBe('pages');
    setActiveTour('pages', false);
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
