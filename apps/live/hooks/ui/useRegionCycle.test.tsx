// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextRegion, shownRegions, useRegionCycle } from './useRegionCycle';

// docs/specs/004-interface-design/canvas-accessibility.md "F6 moves between regions". jsdom lays nothing out, so a
// region counts as on screen unless it is hidden.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.closest('.hidden') ? [] : [{}]) as unknown as DOMRectList;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Editor({ viewer = false }: { viewer?: boolean }) {
  return (
    <>
      <header data-region="header">
        <button>Title</button>
        <button>Share</button>
      </header>
      <main data-region="canvas" tabIndex={0} aria-label="Canvas">
        <div data-region="palette" className={viewer ? 'hidden' : ''}>
          <button>Shapes</button>
        </div>
        <div data-region="controls">
          <button disabled>Undo</button>
          <button>Tidy Up</button>
        </div>
      </main>
      <nav data-region="tabs">
        <button>Tab 1</button>
      </nav>
    </>
  );
}

const press = (shift = false) => fireEvent.keyDown(window, { key: 'F6', shiftKey: shift });
const focused = () =>
  document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent;

describe('F6 between regions', () => {
  it('walks header, palette, canvas, controls and tabs in screen order, wrapping round', () => {
    render(<Editor />);
    renderHook(() => useRegionCycle());
    const seen = [];
    for (let i = 0; i < 6; i++) {
      press();
      seen.push(focused());
    }
    // The canvas lands on itself; the others on their first enabled control.
    expect(seen).toEqual(['Title', 'Shapes', 'Canvas', 'Tidy Up', 'Tab 1', 'Title']);
  });

  it('walks back with Shift+F6', () => {
    render(<Editor />);
    renderHook(() => useRegionCycle());
    press(true);
    expect(focused()).toBe('Tab 1');
    press(true);
    expect(focused()).toBe('Tidy Up');
  });

  it('skips a region not on screen (a viewer has no palette)', () => {
    render(<Editor viewer />);
    renderHook(() => useRegionCycle());
    press();
    press();
    expect(focused()).toBe('Canvas');
    expect(shownRegions(document).map((r) => r.dataset.region)).toEqual([
      'header',
      'canvas',
      'controls',
      'tabs',
    ]);
  });

  it('moves on from the innermost region (the palette sits inside the canvas)', () => {
    render(<Editor />);
    const regions = shownRegions(document);
    const shapes = document.querySelector('[data-region="palette"] button');
    expect(nextRegion(regions, shapes, false)?.dataset.region).toBe('canvas');
    expect(nextRegion(regions, shapes, true)?.dataset.region).toBe('header');
  });

  it('leaves a modal dialog its own focus', () => {
    render(
      <>
        <Editor />
        <div role="dialog" aria-modal="true">
          <button>Inside</button>
        </div>
      </>,
    );
    renderHook(() => useRegionCycle());
    const inside = document.querySelector<HTMLButtonElement>('[role="dialog"] button')!;
    inside.focus();
    press();
    expect(document.activeElement).toBe(inside);
  });
});
