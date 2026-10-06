// @vitest-environment jsdom

import { render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoxedElement } from '@livediagram/document';
import { createElement, type ReactNode } from 'react';
import { useBoxedElementAnimation } from './useBoxedElementAnimation';
import { CanvasStillProvider } from './CanvasStillContext';
import { CanvasArrivalProvider } from './CanvasArrivalContext';

// Canvas motion is out of the chrome budget (docs/specs/004-interface-design/motion.md):
// a newly added element keeps its own 360ms spring (app/canvas-motion.test.ts)
// even though the chrome pop-in runs at the 150ms micro token.
const square = {
  id: 'a',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
} as unknown as BoxedElement;

describe('canvas element entry', () => {
  it('pops a new element in with the canvas token, not the chrome one', () => {
    const { result } = renderHook(() => useBoxedElementAnimation(square, '#000'));
    expect(result.current.wrapperAnimClass).toBe('animate-element-pop-in');
  });
});

describe('a still canvas (a whiteboard, docs/specs/023-draw-mode/draw-mode.md)', () => {
  it('lets a new element appear as drawn, with no entry animation', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CanvasStillProvider, { still: true, children });
    const { result } = renderHook(() => useBoxedElementAnimation(square, '#000'), { wrapper });
    expect(result.current.wrapperAnimClass).toBe('');
  });
});

// Opening animates nothing across the board (docs/specs/008-canvas/canvas-and-palette.md "Motion and
// animations"): the elements a tab opens with arrive with it; only one added later pops in.
function Probe({ element, seen }: { element: BoxedElement; seen: Map<string, string> }) {
  const { wrapperAnimClass } = useBoxedElementAnimation(element, '#000');
  seen.set(element.id, wrapperAnimClass);
  return null;
}

function Board({
  tabId,
  ids,
  still = false,
  seen,
}: {
  tabId: string;
  ids: string[];
  still?: boolean;
  seen: Map<string, string>;
}) {
  const probes = ids.map((id) =>
    createElement(Probe, { key: id, element: { ...square, id }, seen }),
  );
  return createElement(CanvasStillProvider, {
    still,
    children: createElement(CanvasArrivalProvider, { tabId, children: probes }),
  });
}

describe('the board a tab opens with', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows its elements at once, with no pop-in and no timer', () => {
    vi.useFakeTimers();
    const seen = new Map<string, string>();
    render(createElement(Board, { tabId: 't1', ids: ['a', 'b'], seen }));
    expect(seen.get('a')).toBe('');
    expect(seen.get('b')).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pops in an element added after the board arrived', () => {
    const seen = new Map<string, string>();
    const { rerender } = render(createElement(Board, { tabId: 't1', ids: ['a'], seen }));
    rerender(createElement(Board, { tabId: 't1', ids: ['a', 'b'], seen }));
    expect(seen.get('a')).toBe('');
    expect(seen.get('b')).toBe('animate-element-pop-in');
  });

  it('shows the destination tab at once on a tab switch', () => {
    const seen = new Map<string, string>();
    const { rerender } = render(createElement(Board, { tabId: 't1', ids: ['a'], seen }));
    rerender(createElement(Board, { tabId: 't2', ids: ['c', 'd'], seen }));
    expect(seen.get('c')).toBe('');
    expect(seen.get('d')).toBe('');
  });

  it('arms no timer for an element added to a still canvas', () => {
    vi.useFakeTimers();
    const seen = new Map<string, string>();
    const { rerender } = render(
      createElement(Board, { tabId: 't1', ids: ['a'], still: true, seen }),
    );
    rerender(createElement(Board, { tabId: 't1', ids: ['a', 'b'], still: true, seen }));
    expect(seen.get('b')).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps an element drawn on a still canvas settled when the tab switches to Diagram mode', () => {
    const seen = new Map<string, string>();
    const { rerender } = render(
      createElement(Board, { tabId: 't1', ids: ['a'], still: true, seen }),
    );
    rerender(createElement(Board, { tabId: 't1', ids: ['a', 'b'], still: true, seen }));
    rerender(createElement(Board, { tabId: 't1', ids: ['a', 'b'], still: false, seen }));
    expect(seen.get('b')).toBe('');
  });
});
