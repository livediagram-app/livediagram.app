import { describe, expect, it } from 'vitest';
import { RESIZE_HANDLE_CLASS, resizeCursor } from '@/components/canvas/element-parts';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_HOVER_CLASS,
} from '@/components/chrome/floating-controls';

// resizeCursor drives the inline cursor on every resize grip (single
// selection, edge handles, AND the union/group handles). The union
// handles call it with rotation = 0, so the corner -> diagonal-cursor
// mapping below is exactly what a multi-selection / group resize shows.
describe('resizeCursor', () => {
  it('maps the four corners to their diagonal cursors at rotation 0', () => {
    expect(resizeCursor('nw', 0)).toBe('nwse-resize');
    expect(resizeCursor('se', 0)).toBe('nwse-resize');
    expect(resizeCursor('ne', 0)).toBe('nesw-resize');
    expect(resizeCursor('sw', 0)).toBe('nesw-resize');
  });

  it('maps the edge handles to their orthogonal cursors at rotation 0', () => {
    expect(resizeCursor('n', 0)).toBe('ns-resize');
    expect(resizeCursor('s', 0)).toBe('ns-resize');
    expect(resizeCursor('e', 0)).toBe('ew-resize');
    expect(resizeCursor('w', 0)).toBe('ew-resize');
  });

  it('rotates the cursor with the element (90deg swaps the two axes)', () => {
    // A 90deg turn sends an n/s edge to e/w and a nw/se corner to ne/sw.
    expect(resizeCursor('n', 90)).toBe('ew-resize');
    expect(resizeCursor('e', 90)).toBe('ns-resize');
    expect(resizeCursor('nw', 90)).toBe('nesw-resize');
  });

  it('snaps to the nearest of the four cursors and stays stable across full turns', () => {
    expect(resizeCursor('e', 180)).toBe('ew-resize');
    expect(resizeCursor('nw', 360)).toBe('nwse-resize');
    // 22deg rounds back down to the 0deg (ew) bucket.
    expect(resizeCursor('e', 22)).toBe('ew-resize');
  });
});

// The corner resize handle (docs/specs/008-canvas/canvas-and-palette.md, Selection): in dark mode a
// #60a5fa square with a #1e3a8a border and a 1px radius; in light mode exactly the floating control
// it always was.
describe('RESIZE_HANDLE_CLASS', () => {
  const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean);
  const light = (cls: string) => tokens(cls).filter((t) => !t.startsWith('dark:'));

  it('keeps every light-mode class of the floating control', () => {
    expect(light(RESIZE_HANDLE_CLASS).sort()).toEqual(
      light(`${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS}`).sort(),
    );
  });

  it('is a blue square with a deep border in dark mode, and holds its fill on hover', () => {
    const dark = tokens(RESIZE_HANDLE_CLASS).filter((t) => t.startsWith('dark:'));
    expect(dark).toEqual(
      expect.arrayContaining([
        'dark:rounded-[1px]',
        'dark:border-blue-900',
        'dark:bg-blue-400',
        'dark:hover:border-blue-900',
        'dark:hover:bg-blue-400',
      ]),
    );
    // None of the floating control's dark slate plate survives.
    expect(dark).not.toContain('dark:bg-slate-900');
  });
});
