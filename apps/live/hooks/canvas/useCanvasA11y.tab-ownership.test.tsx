// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { useCanvasA11y } from './useCanvasA11y';

// Tab means two things on a focused canvas: walk to the next element
// (docs/specs/004-interface-design/canvas-accessibility.md) and, on a selected mind node, grow a child (docs/specs/009-elements/mind-node.md). Both
// listeners sit on window, and this one is mounted first, so the traversal
// silently ate every Tab: pressing it on a mind node cycled the tab's
// elements instead of adding a node, which is exactly what got reported.
//
// These pin the hand-off rather than the growth itself, because the growth
// lives in the shortcuts hub and only ever runs if traversal declines first.

const NODE = (id: string): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 }) as Element;

const ELEMENTS = [NODE('a'), NODE('b'), NODE('c')];

function harness(over: Partial<Parameters<typeof useCanvasA11y>[0]> = {}) {
  const selectElement = vi.fn();
  // Traversal only engages while the canvas surface itself holds focus.
  const root = document.createElement('div');
  root.tabIndex = 0;
  root.dataset.canvasA11yRoot = '';
  document.body.append(root);
  root.focus();
  renderHook(() =>
    useCanvasA11y({
      enabled: true,
      elements: ELEMENTS,
      selectedId: 'b',
      multiSelectedIds: new Set<string>(),
      editingId: null,
      selectElement,
      lockedByOther: () => false,
      layerInertIds: new Set<string>(),
      scrollIntoView: () => {},
      ownsTabKey: () => false,
      ...over,
    }),
  );
  return { selectElement };
}

function pressTab(shiftKey = false) {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
  window.dispatchEvent(e);
  return e;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('useCanvasA11y Tab ownership', () => {
  it('walks to the next element when the selection does not claim Tab', () => {
    const h = harness();
    const e = pressTab();
    expect(h.selectElement).toHaveBeenCalledWith('c');
    expect(e.defaultPrevented).toBe(true);
  });

  it('stands aside when the selected element claims Tab', () => {
    // Left unprevented as well as unhandled, so the shortcuts hub still sees
    // the keystroke it is going to grow a mind node from.
    const h = harness({ ownsTabKey: (id) => id === 'b' });
    const e = pressTab();
    expect(h.selectElement).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('keeps Shift+Tab as traversal, which nothing else binds', () => {
    const h = harness({ ownsTabKey: () => true });
    pressTab(true);
    expect(h.selectElement).toHaveBeenCalledWith('a');
  });

  it('still traverses when several elements are selected', () => {
    // Growth needs one node to grow from, so a multi-selection has no claim.
    const h = harness({ ownsTabKey: () => true, multiSelectedIds: new Set(['a', 'b']) });
    pressTab();
    expect(h.selectElement).toHaveBeenCalledWith('c');
  });
});
