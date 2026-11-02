// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activeTour, setActiveTour, useActiveTour } from './tour-active';

// One guided tour at a time (docs/specs/007-editor/editor-tour.md).

afterEach(() => {
  setActiveTour('welcome', false);
  setActiveTour('draw', false);
  setActiveTour('workshop', false);
});

describe('tour-active', () => {
  it('starts empty, and holds the tour that claimed it', () => {
    expect(activeTour()).toBeNull();
    setActiveTour('welcome', true);
    expect(activeTour()).toBe('welcome');
  });

  it('is released only by the tour holding it', () => {
    setActiveTour('welcome', true);
    setActiveTour('draw', false);
    expect(activeTour()).toBe('welcome');
    setActiveTour('welcome', false);
    expect(activeTour()).toBeNull();
  });

  it('holds the Workshop tour like the others', () => {
    setActiveTour('workshop', true);
    setActiveTour('welcome', false);
    expect(activeTour()).toBe('workshop');
  });

  it('re-renders a reader when it changes', () => {
    const { result } = renderHook(() => useActiveTour());
    expect(result.current).toBeNull();
    act(() => setActiveTour('draw', true));
    expect(result.current).toBe('draw');
    act(() => setActiveTour('draw', false));
    expect(result.current).toBeNull();
  });
});
