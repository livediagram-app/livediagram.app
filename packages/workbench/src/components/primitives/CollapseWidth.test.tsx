// @vitest-environment jsdom

// A box that eases its width open or shut (docs/specs/006-document/tab-folders.md "Tab bar rendering"): shut it is
// inert and zero wide; open it clips nothing; between, only its width moves, from where it stands, and it settles
// at once where nothing can move.

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

  it('eases open to its content’s width, then lets go of it when the animation finishes', () => {
    const { container, rerender } = render(<CollapseWidth open={false}>x</CollapseWidth>);
    const el = box(container);
    widths(el, 0, 96);
    const run = { onfinish: null as null | (() => void), cancel: vi.fn() };
    const animate = vi.fn(() => run);
    Object.defineProperty(el, 'animate', { value: animate, configurable: true });
    rerender(<CollapseWidth open>x</CollapseWidth>);
    expect(animate).toHaveBeenCalledWith(
      [{ width: '0px' }, { width: '96px' }],
      expect.objectContaining({ duration: COLLAPSE_WIDTH_MS }),
    );
    expect(el.style.width).toBe('96px');
    expect(el.style.overflow).toBe('hidden');
    expect(el.hasAttribute('inert')).toBe(false);
    act(() => run.onfinish?.());
    expect(el.style.width).toBe('');
    expect(el.style.overflow).toBe('');
  });

  it('turns round from where it stands when shut mid-way', () => {
    const { container, rerender } = render(<CollapseWidth open={false}>x</CollapseWidth>);
    const el = box(container);
    widths(el, 0, 96);
    const runs: { onfinish: null | (() => void); cancel: ReturnType<typeof vi.fn> }[] = [];
    const animate = vi.fn(() => {
      const run = { onfinish: null, cancel: vi.fn() };
      runs.push(run);
      return run;
    });
    Object.defineProperty(el, 'animate', { value: animate, configurable: true });
    rerender(<CollapseWidth open>x</CollapseWidth>);
    widths(el, 40, 96);
    rerender(<CollapseWidth open={false}>x</CollapseWidth>);
    expect(runs[0]!.cancel).toHaveBeenCalledOnce();
    expect(runs[0]!.onfinish).toBeNull();
    expect(animate).toHaveBeenLastCalledWith(
      [{ width: '40px' }, { width: '0px' }],
      expect.anything(),
    );
    expect(el.style.width).toBe('0px');
    expect(el.hasAttribute('inert')).toBe(true);
  });

  it('settles at once where the browser cannot animate, or nothing would move', () => {
    const { container, rerender } = render(<CollapseWidth open>x</CollapseWidth>);
    const el = box(container);
    widths(el, 120, 120);
    rerender(<CollapseWidth open={false}>x</CollapseWidth>);
    expect(el.style.width).toBe('0px');
    expect(el.style.overflow).toBe('hidden');
    const animate = vi.fn();
    Object.defineProperty(el, 'animate', { value: animate, configurable: true });
    widths(el, 0, 0);
    rerender(<CollapseWidth open>x</CollapseWidth>);
    expect(animate).not.toHaveBeenCalled();
    expect(el.style.width).toBe('');
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
