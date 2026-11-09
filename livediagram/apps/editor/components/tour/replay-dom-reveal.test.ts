// @vitest-environment jsdom
// Example never presses what nobody can see (docs/specs/007-editor/watch-it-built.md; owner, 2026-11-09): a control
// scrolled out of its sheet (a phone's Tab Style sheet holds Canvas below its looks) is brought into view, once.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@liveworkspace/workbench/components/tour/tour-reveal', () => ({
  revealInScrollers: vi.fn(() => true),
}));
import { revealInScrollers } from '@liveworkspace/workbench/components/tour/tour-reveal';
import { centreInView, resolveTarget } from './replay-dom';

const at = (top: number) => {
  const b = document.createElement('button');
  b.getBoundingClientRect = () =>
    ({ left: 0, top, width: 100, height: 40, right: 100, bottom: top + 40 }) as DOMRect;
  document.body.append(b);
  return b;
};
afterEach(() => {
  document.body.innerHTML = '';
  vi.mocked(revealInScrollers).mockClear();
});

describe('centreInView', () => {
  it('scrolls a control below the window into view, once, and answers its centre', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const canvas = at(1030);
    expect(centreInView(canvas)).toEqual({ x: 50, y: 1050 });
    expect(revealInScrollers).toHaveBeenCalledWith(canvas);
    centreInView(canvas);
    expect(revealInScrollers).toHaveBeenCalledTimes(1);
  });

  it('scrolls one above the window too, and leaves one on screen where it is', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    centreInView(at(-60));
    expect(revealInScrollers).toHaveBeenCalledTimes(1);
    centreInView(at(300));
    expect(revealInScrollers).toHaveBeenCalledTimes(1);
  });

  it('answers null for nothing, or a control not drawn', () => {
    expect(centreInView(null)).toBeNull();
    const hidden = document.createElement('button');
    hidden.getBoundingClientRect = () => ({ left: 0, top: 2000, width: 0, height: 0 }) as DOMRect;
    expect(centreInView(hidden)).toBeNull();
    expect(revealInScrollers).not.toHaveBeenCalled();
  });

  it('is what a found target resolves through', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const b = at(1200);
    b.className = 'canvas-row';
    expect(resolveTarget({ kind: 'find', selector: '.canvas-row' }, (p) => p)).toEqual({
      x: 50,
      y: 1220,
    });
    expect(revealInScrollers).toHaveBeenCalledWith(b);
  });
});
