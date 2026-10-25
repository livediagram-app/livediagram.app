// @vitest-environment jsdom

import { render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { useElementPopIn } from './useElementPopIn';
import { CanvasArrivalProvider } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';

// Canvas motion is out of the chrome budget (docs/specs/004-interface-design/motion.md):
// a newly added element keeps its own 360ms spring (app/canvas-motion.test.ts)
// even though the chrome pop-in runs at the 150ms micro token.
describe('canvas element entry', () => {
  it('pops a new element in with the canvas token, not the chrome one', () => {
    const { result } = renderHook(() => useElementPopIn());
    expect(result.current).toBe('animate-element-pop-in');
  });
});

// Opening animates nothing across the board (docs/specs/008-canvas/canvas-and-palette.md "Motion and
// animations"): the elements a tab opens with arrive with it; only one added later pops in.
function Probe({ id, seen }: { id: string; seen: Map<string, string> }) {
  seen.set(id, useElementPopIn());
  return null;
}

function Board({
  tabId,
  ids,
  loaded = true,
  seen,
}: {
  tabId: string;
  ids: string[];
  loaded?: boolean;
  seen: Map<string, string>;
}) {
  const probes = ids.map((id) => createElement(Probe, { key: id, id, seen }));
  return createElement(CanvasArrivalProvider, { tabId, loaded, children: probes });
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

  it('shows a never-opened tab at once when its content lands after the placeholder', () => {
    const seen = new Map<string, string>();
    const { rerender } = render(createElement(Board, { tabId: 't1', ids: ['a'], seen }));
    rerender(createElement(Board, { tabId: 't2', ids: [], loaded: false, seen }));
    rerender(createElement(Board, { tabId: 't2', ids: ['c', 'd'], seen }));
    expect(seen.get('c')).toBe('');
    expect(seen.get('d')).toBe('');
    rerender(createElement(Board, { tabId: 't2', ids: ['c', 'd', 'e'], seen }));
    expect(seen.get('e')).toBe('animate-element-pop-in');
  });
});
