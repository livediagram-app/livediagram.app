// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Element } from '@livedesign/document';
import {
  getPaletteDragSnap,
  setPaletteDragPreview,
  setPaletteDragSnap,
} from '@/lib/palette-drag-preview';
import { usePaletteDragGuides } from './usePaletteDragGuides';

// A row of three 200x200 notes with 72 gaps: 0..200, 272..472, 544..744.
function note(id: string, x: number): Element {
  return { id, type: 'sticky', x, y: 0, width: 200, height: 200 };
}
const ROW = [note('a', 0), note('b', 272), note('c', 544)];

// The hook converts client coords through the wrapper rect; a 1:1 rect at the
// origin makes canvas coords and client coords the same number.
function wrapper() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  const main = document.createElement('main');
  main.appendChild(el);
  document.body.appendChild(main);
  return { current: el };
}

function dragOver(target: HTMLElement, clientX: number, clientY: number) {
  const event = new Event('dragover', { bubbles: true }) as DragEvent & {
    clientX: number;
    clientY: number;
  };
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  act(() => {
    target.dispatchEvent(event);
  });
}

function render() {
  const wrapperRef = wrapper();
  setPaletteDragPreview({ kind: 'square', width: 200, height: 200 });
  const view = renderHook(() =>
    usePaletteDragGuides({ elements: ROW, readZoom: () => 1, wrapperRef }),
  );
  return { ...view, wrapperRef };
}

afterEach(() => {
  setPaletteDragPreview(null);
  setPaletteDragSnap(null);
  document.body.innerHTML = '';
});

// docs/specs/010-palette/palette-drag-ghost.md: the drag's one snap, published for the ghost and the drop.
describe('usePaletteDragGuides', () => {
  it('publishes the alignment snap and its guide while the ghost is near a neighbour', () => {
    const { result, wrapperRef } = render();
    // The footprint is centred on the cursor: 3px right of note a's column.
    dragOver(wrapperRef.current, 103, 400);
    expect(getPaletteDragSnap()).toMatchObject({ dx: -3 });
    expect(result.current.guides.some((g) => g.axis === 'x')).toBe(true);
  });

  it('clears the snap when the drag leaves the window', () => {
    const { wrapperRef } = render();
    dragOver(wrapperRef.current, 103, 400);
    act(() => {
      document.dispatchEvent(new Event('dragleave', { bubbles: true }));
    });
    expect(getPaletteDragSnap()).toBeNull();
  });
});
