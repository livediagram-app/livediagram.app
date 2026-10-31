// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPath, pathOfContours, type PathAnchor, type PathElement } from '@livedesign/design';
import { usePathContour } from './usePathContour';

// docs/specs/023-draw-mode/path-tool.md "Combined paths".

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const square = (o: number, w: number) => [
  corner(o, o),
  corner(o + w, o),
  corner(o + w, o + w),
  corner(o, o + w),
];
// A 100 px frame with a 50 px hole, and a separate island to its right.
const ring = pathOfContours({ id: 'ring', type: 'path', closed: true }, [
  square(0, 100),
  square(25, 50),
  [corner(200, 0), corner(240, 0), corner(240, 40)],
]);

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function setup() {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  const target = document.createElement('div');
  target.setAttribute('data-element-id', 'ring');
  const initialProps: { editing: PathElement | null } = { editing: null };
  const hook = renderHook(
    (p: { editing: PathElement | null }) =>
      usePathContour({
        editing: p.editing,
        elements: [ring],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
      }),
    { initialProps },
  );
  const notePress = (x: number, y: number, on: Element = target) =>
    act(() =>
      hook.result.current.notePress({
        target: on,
        clientX: x,
        clientY: y,
      } as unknown as ReactPointerEvent),
    );
  return { hook, notePress };
}

describe('usePathContour', () => {
  it('opens on the contour nearest the press that opened it', () => {
    const s = setup();
    s.notePress(28, 50);
    s.hook.rerender({ editing: ring });
    expect(s.hook.result.current).toMatchObject({ compound: true, index: 1, count: 3 });
    expect(s.hook.result.current.element!.nodes).toHaveLength(4);
    expect(s.hook.result.current.element!.subpaths).toBeUndefined();
    // The others: two outlines, their seven nodes to snap to.
    expect(s.hook.result.current.others!.d.match(/M /g)).toHaveLength(2);
    expect(s.hook.result.current.others!.points).toHaveLength(7);
  });

  it('keeps its contour when it reopens with no new press (after Undo)', () => {
    const s = setup();
    s.notePress(238, 20);
    s.hook.rerender({ editing: ring });
    expect(s.hook.result.current.index).toBe(2);
    s.hook.rerender({ editing: null });
    s.hook.rerender({ editing: ring });
    expect(s.hook.result.current.index).toBe(2);
  });

  it('opens on the first contour without a press on the path', () => {
    const s = setup();
    s.notePress(28, 50, document.createElement('div'));
    s.hook.rerender({ editing: ring });
    expect(s.hook.result.current.index).toBe(0);
  });

  it('switches on a press on another contour, and steps round with the toolbar', () => {
    const s = setup();
    s.hook.rerender({ editing: ring });
    let took = false;
    act(() => {
      took = s.hook.result.current.pickAt({ x: 220, y: 10 }, false);
    });
    expect(took).toBe(true);
    expect(s.hook.result.current.index).toBe(2);
    act(() => {
      took = s.hook.result.current.pickAt({ x: 239, y: 20 }, true);
    });
    expect(took).toBe(false);
    act(() => s.hook.result.current.step());
    expect(s.hook.result.current.index).toBe(0);
  });

  it('is the path itself for a plain path', () => {
    const s = setup();
    const plain = createPath(square(0, 10), true);
    s.hook.rerender({ editing: plain });
    expect(s.hook.result.current).toMatchObject({ compound: false, index: 0, others: null });
    expect(s.hook.result.current.element).toBe(plain);
    let took = true;
    act(() => {
      took = s.hook.result.current.pickAt({ x: 5, y: 5 }, false);
      s.hook.result.current.step();
    });
    expect(took).toBe(false);
  });
});
