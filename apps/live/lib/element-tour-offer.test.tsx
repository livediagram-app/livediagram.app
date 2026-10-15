// @vitest-environment jsdom

// The stores behind element tours (docs/specs/007-editor/element-tours.md): the offer the selection toolbar reads,
// and the part a Sankey tour step lifts. Each reader hears only about its own element.

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementTourOffer, setElementTourOffer, useElementTourOffer } from './element-tour-offer';
import { setSankeyTourFocus, useSankeyTourFocus } from './sankey-tour-focus';

afterEach(() => {
  act(() => setElementTourOffer(null));
  act(() => setSankeyTourFocus(null));
});

const offer = { elementId: 'a', kind: 'sankey' as const, play: vi.fn(), dismiss: vi.fn() };

describe('element tour offer', () => {
  it('reaches the selection it is for, and no other', () => {
    const mine = renderHook(() => useElementTourOffer('a'));
    const other = renderHook(() => useElementTourOffer('b'));
    const none = renderHook(() => useElementTourOffer(null));
    act(() => setElementTourOffer(offer));
    expect(mine.result.current).toBe(offer);
    expect(other.result.current).toBeNull();
    expect(none.result.current).toBeNull();
    expect(elementTourOffer()).toBe(offer);
    act(() => setElementTourOffer(null));
    expect(mine.result.current).toBeNull();
  });
});

describe('sankey tour focus', () => {
  it('reaches only its diagram, and ignores a repeat of the same lift', () => {
    let renders = 0;
    const mine = renderHook(() => {
      renders += 1;
      return useSankeyTourFocus('a');
    });
    const other = renderHook(() => useSankeyTourFocus('b'));
    act(() => setSankeyTourFocus({ elementId: 'a', part: 'band', index: 2 }));
    expect(mine.result.current).toEqual({ elementId: 'a', part: 'band', index: 2 });
    expect(other.result.current).toBeNull();
    const before = renders;
    act(() => setSankeyTourFocus({ elementId: 'a', part: 'band', index: 2 }));
    expect(renders).toBe(before);
  });
});
