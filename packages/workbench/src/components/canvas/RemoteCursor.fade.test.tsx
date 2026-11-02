// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasZoomProvider } from './CanvasZoomContext';
import { RemoteCursors, type RemoteCursorRow } from './RemoteCursor';

// Cursors Step Aside (docs/specs/012-collaboration/collaborator-enhancements.md): a remote cursor under or near
// this screen's pointer fades out until the pointer leaves, and none ever takes a click.

const paint = (color: string) => ({ '--identity': color }) as React.CSSProperties;
const ada: RemoteCursorRow = { id: 'a', name: 'Ada', color: '#0ea5e9', x: 100, y: 100 };
const bo: RemoteCursorRow = { id: 'b', name: 'Bo', color: '#10b981', x: 400, y: 300 };

// jsdom lays nothing out: the anchor at canvas (0, 0) sits at (20, 10) on screen.
let rectReads = 0;
beforeEach(() => {
  rectReads = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
    rectReads++;
    return {
      left: 20,
      top: 10,
      right: 20,
      bottom: 10,
      width: 0,
      height: 0,
      x: 20,
      y: 10,
    } as DOMRect;
  });
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function move(x: number, y: number, pointerType = 'mouse') {
  act(() => {
    const e = new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(e, 'pointerType', { value: pointerType });
    window.dispatchEvent(e);
    vi.advanceTimersToNextFrame();
  });
}

const faded = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-faded]')].map((el) =>
    el.getAttribute('data-remote-cursor'),
  );

describe('RemoteCursors stepping aside', () => {
  it('fades the cursor the pointer is over and brings it back when the pointer leaves', () => {
    const { container } = render(<RemoteCursors cursors={[ada, bo]} paint={paint} />);
    // Ada's tip is at (120, 110) on screen.
    move(125, 115);
    expect(faded(container)).toEqual(['a']);
    const el = container.querySelector('[data-remote-cursor="a"]') as HTMLElement;
    expect(el.className).toContain('opacity-0');
    expect(el.className).toContain('pointer-events-none');
    move(700, 700);
    expect(faded(container)).toEqual([]);
  });

  it('counts the name pill and a little room around it', () => {
    const { container } = render(<RemoteCursors cursors={[ada]} paint={paint} />);
    move(120 + 30, 110 + 22);
    expect(faded(container)).toEqual(['a']);
    move(120 - 6, 110 - 6);
    expect(faded(container)).toEqual(['a']);
  });

  it('places cursors by the canvas zoom', () => {
    const { container } = render(
      <CanvasZoomProvider zoom={2}>
        <RemoteCursors cursors={[ada]} paint={paint} />
      </CanvasZoomProvider>,
    );
    // At zoom 2, Ada's tip is at (220, 210).
    move(125, 115);
    expect(faded(container)).toEqual([]);
    move(222, 212);
    expect(faded(container)).toEqual(['a']);
  });

  it('steps a cursor aside when it moves under a still pointer', () => {
    const { container, rerender } = render(<RemoteCursors cursors={[ada]} paint={paint} />);
    move(420, 310);
    expect(faded(container)).toEqual([]);
    rerender(<RemoteCursors cursors={[{ ...ada, x: 400, y: 300 }]} paint={paint} />);
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(faded(container)).toEqual(['a']);
  });

  it('ignores a touch, which has no hover, and lets it clear a pen', () => {
    const { container } = render(<RemoteCursors cursors={[ada]} paint={paint} />);
    move(125, 115, 'touch');
    expect(faded(container)).toEqual([]);
    move(125, 115, 'pen');
    expect(faded(container)).toEqual(['a']);
    move(125, 115, 'touch');
    expect(faded(container)).toEqual([]);
  });

  it('brings everything back when the pointer leaves the page or the window', () => {
    const { container } = render(<RemoteCursors cursors={[ada]} paint={paint} />);
    move(125, 115);
    act(() => {
      document.documentElement.dispatchEvent(new Event('pointerleave'));
      vi.advanceTimersToNextFrame();
    });
    expect(faded(container)).toEqual([]);
    move(125, 115);
    act(() => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersToNextFrame();
    });
    expect(faded(container)).toEqual([]);
  });

  it('checks once a frame however many moves arrive, and re-checks on a wheel', () => {
    render(<RemoteCursors cursors={[ada, bo]} paint={paint} />);
    act(() => {
      for (let i = 0; i < 20; i++) {
        const e = new MouseEvent('pointermove', { clientX: i, clientY: i });
        Object.defineProperty(e, 'pointerType', { value: 'mouse' });
        window.dispatchEvent(e);
      }
      vi.advanceTimersToNextFrame();
    });
    expect(rectReads).toBe(1);
    act(() => {
      window.dispatchEvent(new Event('wheel'));
      vi.advanceTimersToNextFrame();
    });
    expect(rectReads).toBe(2);
  });

  it('listens to nothing while no cursor is drawn', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const { container, rerender } = render(<RemoteCursors cursors={[]} paint={paint} />);
    expect(container.childElementCount).toBe(0);
    expect(add.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(0);
    rerender(<RemoteCursors cursors={[ada]} paint={paint} />);
    move(125, 115);
    expect(faded(container)).toEqual(['a']);
    // The last cursor leaving drops its fade, so one coming back is drawn whole until the pointer finds it.
    rerender(<RemoteCursors cursors={[]} paint={paint} />);
    rerender(<RemoteCursors cursors={[ada]} paint={paint} />);
    expect(faded(container)).toEqual([]);
  });
});
