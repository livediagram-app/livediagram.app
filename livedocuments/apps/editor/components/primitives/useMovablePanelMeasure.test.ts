// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bottomPanelTopLimit } from './useMovablePanelMeasure';

// docs/specs/007-editor/panel-docking.md "Default layout": a bottom-right panel on a short window grows up to the
// canvas's top, and below the palette strip where the two overlap across.
const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function layout() {
  document.body.innerHTML = `
    <main aria-label="Canvas" id="c"></main>
    <div data-toolbar-palette><div data-tour-id="palette" id="strip"></div></div>`;
  const boxes: Record<string, DOMRect> = {
    c: rect(0, 56, 720, 400),
    strip: rect(280, 66, 700, 118),
  };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxes[this.id] ?? rect(0, 0, 0, 0);
  });
}

describe('bottomPanelTopLimit', () => {
  it('stops below the palette strip where the panel overlaps it across', () => {
    layout();
    expect(bottomPanelTopLimit({ left: 450, right: 704 })).toBe(118);
  });

  it('stops at the canvas top where the strip is off to the side', () => {
    layout();
    expect(bottomPanelTopLimit({ left: 16, right: 270 })).toBe(56);
  });

  it('falls back to the window top with no canvas', () => {
    expect(bottomPanelTopLimit({ left: 0, right: 100 })).toBe(0);
  });
});
