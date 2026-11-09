// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activeTour, setActiveTour, useActiveTour } from './tour-active';

// One guided tour at a time (docs/specs/007-editor/watch-it-built.md).

afterEach(() => {
  setActiveTour('welcome', false);
  setActiveTour('show-me', false);
  setActiveTour('element', false);
});

describe('tour-active', () => {
  it('starts empty, and holds the tour that claimed it', () => {
    expect(activeTour()).toBeNull();
    setActiveTour('welcome', true);
    expect(activeTour()).toBe('welcome');
  });

  it('is released only by the tour holding it', () => {
    setActiveTour('welcome', true);
    setActiveTour('show-me', false);
    expect(activeTour()).toBe('welcome');
    setActiveTour('welcome', false);
    expect(activeTour()).toBeNull();
  });

  it('holds an element tour like the others', () => {
    setActiveTour('element', true);
    setActiveTour('welcome', false);
    expect(activeTour()).toBe('element');
  });

  it('re-renders a reader when it changes', () => {
    const { result } = renderHook(() => useActiveTour());
    expect(result.current).toBeNull();
    act(() => setActiveTour('show-me', true));
    expect(result.current).toBe('show-me');
    act(() => setActiveTour('show-me', false));
    expect(result.current).toBeNull();
  });
});
