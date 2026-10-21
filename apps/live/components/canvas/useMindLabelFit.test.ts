// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PADDING_PX, createShape } from '@liveplanner/document';
import { useMindLabelFit } from './useMindLabelFit';

// docs/specs/009-elements/mind-node.md "A node grows to fit its label": while typing, the node is
// drawn as tall as its lines need. jsdom lays nothing out, so the measured block is stubbed.

const venue = { ...createShape('mind-node', 0, 0), id: 'venue' };

function linesMeasure(height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height,
  } as DOMRect);
}

const editorWith = (text: string) => {
  const editor = document.createElement('div');
  editor.textContent = text;
  return editor;
};

afterEach(() => vi.restoreAllMocks());

describe('useMindLabelFit', () => {
  it('draws the node as tall as its lines while typing', () => {
    const hook = renderHook(({ editing }) => useMindLabelFit(venue, editing, undefined), {
      initialProps: { editing: true },
    });
    expect(hook.result.current.height).toBeNull();
    linesMeasure(150);
    act(() => hook.result.current.onLiveText!(editorWith('One\nTwo\nThree\nFour\nFive')));
    expect(hook.result.current.height).toBe(150 + 2 * PADDING_PX.sm);
  });

  it('keeps the stored height while the lines still fit', () => {
    const hook = renderHook(() => useMindLabelFit(venue, true, undefined));
    linesMeasure(20);
    act(() => hook.result.current.onLiveText!(editorWith('Venue')));
    expect(hook.result.current.height).toBeNull();
  });

  it('forgets the live height once the edit ends', () => {
    const hook = renderHook(({ editing }) => useMindLabelFit(venue, editing, undefined), {
      initialProps: { editing: true },
    });
    linesMeasure(150);
    act(() => hook.result.current.onLiveText!(editorWith('One\nTwo\nThree\nFour\nFive')));
    hook.rerender({ editing: false });
    expect(hook.result.current.height).toBeNull();
    hook.rerender({ editing: true });
    expect(hook.result.current.height).toBeNull();
  });

  it('does nothing for any other element', () => {
    const square = createShape('square', 0, 0);
    const hook = renderHook(() => useMindLabelFit(square, true, undefined));
    expect(hook.result.current).toEqual({ height: null, onLiveText: undefined });
  });
});
