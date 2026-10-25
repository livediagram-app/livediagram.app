// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REVEAL_MARGIN_PX, revealInScrollers } from './tour-reveal';

// A tour step's target below a scrolling panel's fold (the Forms tour's Add bar under a long form) is scrolled to
// before the ring lands; jsdom does no layout, so boxes and scroll sizes are stubbed.

type Rect = { top: number; height: number; left?: number; width?: number };

function box(el: HTMLElement, r: Rect) {
  const left = r.left ?? 0;
  const width = r.width ?? 300;
  el.getBoundingClientRect = () =>
    ({
      top: r.top,
      bottom: r.top + r.height,
      left,
      right: left + width,
      width,
      height: r.height,
    }) as DOMRect;
}

// A panel that scrolls (or only clips, as the canvas does) holding a target at `targetTop`.
function panel(overflow: 'auto' | 'hidden', targetTop: number, targetHeight = 40) {
  const scroller = document.createElement('div');
  scroller.style.overflowY = overflow;
  Object.defineProperty(scroller, 'scrollHeight', { value: 2000 });
  Object.defineProperty(scroller, 'clientHeight', { value: 500 });
  box(scroller, { top: 100, height: 500 });
  const scrollBy = vi.fn();
  scroller.scrollBy = scrollBy;
  const target = document.createElement('div');
  box(target, { top: targetTop, height: targetHeight });
  scroller.append(target);
  document.body.append(scroller);
  return { target, scrollBy };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('revealInScrollers', () => {
  // Centred, not hugging an edge: a phone's undo and redo float over the foot of a form's panel.
  it('centres a target below the fold in its panel', () => {
    const { target, scrollBy } = panel('auto', 900);
    expect(revealInScrollers(target)).toBe(true);
    // Its middle (920) lands on the panel's (350).
    expect(scrollBy).toHaveBeenCalledWith({ top: 920 - 350, left: 0, behavior: 'smooth' });
  });

  it('centres a target above the top', () => {
    const { target, scrollBy } = panel('auto', -200);
    revealInScrollers(target);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: -180 - 350 }));
  });

  // Inside the panel but within the margin of its edge: the ring would be clipped, so it moves.
  it('moves a target that sits in the margin at an edge', () => {
    const { target, scrollBy } = panel('auto', 600 - REVEAL_MARGIN_PX - 30);
    expect(revealInScrollers(target)).toBe(true);
    expect(scrollBy).toHaveBeenCalled();
  });

  it('leaves a target already in view alone', () => {
    const { target, scrollBy } = panel('auto', 300);
    expect(revealInScrollers(target)).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("brings a 'start' target to the top even when it shows", () => {
    const { target, scrollBy } = panel('auto', 300);
    revealInScrollers(target, 'start');
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 300 - (100 + REVEAL_MARGIN_PX) }),
    );
  });

  it('aligns a target taller than the panel to its top', () => {
    const { target, scrollBy } = panel('auto', 700, 900);
    revealInScrollers(target);
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 700 - (100 + REVEAL_MARGIN_PX) }),
    );
  });

  // The canvas clips with overflow:hidden and pans by its own transform: scrolling it would shift the board.
  it('never scrolls a box that only clips', () => {
    const { target, scrollBy } = panel('hidden', 900);
    expect(revealInScrollers(target)).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls instantly when motion is reduced', () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') })) as typeof matchMedia;
    try {
      const { target, scrollBy } = panel('auto', 900);
      revealInScrollers(target);
      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  // A page that scrolls for the person (a standalone page) is scrolled too; the editor pins its page, so it never is.
  it('scrolls the page only when its overflow is not hidden', () => {
    const page = document.scrollingElement ?? document.documentElement;
    Object.defineProperty(page, 'scrollHeight', { value: 3000, configurable: true });
    const pageBy = vi.fn();
    page.scrollBy = pageBy;
    const target = document.createElement('div');
    box(target, { top: 1500, height: 40 });
    document.body.append(target);
    expect(revealInScrollers(target)).toBe(true);
    expect(pageBy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1520 - window.innerHeight / 2 }),
    );
    pageBy.mockClear();
    // The longhand: jsdom does not expand the shorthand as a browser's computed style does.
    document.body.style.overflowY = 'hidden';
    try {
      expect(revealInScrollers(target)).toBe(false);
      expect(pageBy).not.toHaveBeenCalled();
    } finally {
      document.body.style.overflowY = '';
      Object.defineProperty(page, 'scrollHeight', { value: 0, configurable: true });
    }
  });

  // An outer panel aims for where the inner scroll will leave the target, not where it is mid-way.
  it('accounts for an inner scroll when an outer panel scrolls too', () => {
    const { target, scrollBy: inner } = panel('auto', 900);
    const innerPanel = target.parentElement!;
    const outer = document.createElement('div');
    outer.style.overflowY = 'auto';
    Object.defineProperty(outer, 'scrollHeight', { value: 3000 });
    Object.defineProperty(outer, 'clientHeight', { value: 300 });
    box(outer, { top: 0, height: 300 });
    const outerBy = vi.fn();
    outer.scrollBy = outerBy;
    outer.append(innerPanel);
    document.body.append(outer);
    revealInScrollers(target);
    const dy = 920 - 350;
    expect(inner).toHaveBeenCalledWith(expect.objectContaining({ top: dy }));
    // After the inner scroll the target's middle sits at 920 - dy; the outer's middle is 150.
    expect(outerBy).toHaveBeenCalledWith(expect.objectContaining({ top: 920 - dy - 150 }));
  });
});
