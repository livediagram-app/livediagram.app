// @vitest-environment jsdom

// A box that eases its width open or shut (docs/specs/006-document/tab-folders.md "Tab bar rendering"): shut it is
// inert and zero wide; open it clips nothing; between, only its width moves, and it settles even when the browser
// skips the transition.

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE_WIDTH_MS, CollapseWidth } from './CollapseWidth';

let reduced = false;
beforeEach(() => {
  reduced = false;
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const box = (c: HTMLElement) => c.querySelector('[data-collapse-width]') as HTMLElement;

function widths(el: HTMLElement, outer: number, inner: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: outer } as DOMRect);
  vi.spyOn(el.firstElementChild as HTMLElement, 'getBoundingClientRect').mockReturnValue({
    width: inner,
  } as DOMRect);
}

describe('CollapseWidth', () => {
  it('mounts shut at zero width, inert, without animating', () => {
    const { container } = render(
      <CollapseWidth open={false}>
        <button type="button">Roadmap</button>
      </CollapseWidth>,
    );
    const el = box(container);
    expect(el.style.width).toBe('0px');
    expect(el.style.overflow).toBe('hidden');
    expect(el.hasAttribute('inert')).toBe(true);
    expect(el.dataset.collapseWidth).toBe('shut');
  });

  it('mounts open at its own width, clipping nothing', () => {
    const { container } = render(
      <CollapseWidth open>
        <span>Roadmap</span>
      </CollapseWidth>,
    );
    const el = box(container);
    expect(el.style.width).toBe('');
    expect(el.style.overflow).toBe('');
    expect(el.hasAttribute('inert')).toBe(false);
  });

  it('eases open to its content’s width, then lets go of it when the transition ends', () => {
    const { container, rerender } = render(<CollapseWidth open={false}>x</CollapseWidth>);
    const el = box(container);
    widths(el, 0, 96);
    rerender(<CollapseWidth open>x</CollapseWidth>);
    expect(el.style.width).toBe('96px');
    expect(el.style.overflow).toBe('hidden');
    // Another property's end, or a child's, changes nothing.
    act(() => {
      el.firstElementChild!.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    expect(el.style.width).toBe('96px');
    act(() => {
      const end = new Event('transitionend') as TransitionEvent;
      Object.defineProperty(end, 'propertyName', { value: 'width' });
      el.dispatchEvent(end);
    });
    expect(el.style.width).toBe('');
    expect(el.style.overflow).toBe('');
  });

  it('eases shut from where it stands, and settles even when no transition ends', () => {
    const { container, rerender } = render(<CollapseWidth open>x</CollapseWidth>);
    const el = box(container);
    widths(el, 120, 120);
    rerender(<CollapseWidth open={false}>x</CollapseWidth>);
    expect(el.style.width).toBe('0px');
    expect(el.hasAttribute('inert')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(COLLAPSE_WIDTH_MS + 100);
    });
    expect(el.style.width).toBe('0px');
    expect(el.style.overflow).toBe('hidden');
  });

  it('snaps under reduced motion', () => {
    reduced = true;
    const { container, rerender } = render(<CollapseWidth open={false}>x</CollapseWidth>);
    const el = box(container);
    widths(el, 0, 80);
    rerender(<CollapseWidth open>x</CollapseWidth>);
    expect(el.style.width).toBe('');
    expect(el.style.overflow).toBe('');
  });
});
