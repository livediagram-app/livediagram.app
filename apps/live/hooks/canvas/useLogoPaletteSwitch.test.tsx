// @vitest-environment jsdom

// docs/specs/007-editor/logo-pages.md "The Logo palette": the palette turns to Logo.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, newLogoPage, type LaidOutPage } from '@livediagram/document';
import { onPaletteCategoryRequest } from '@/lib/palette-category-request';
import { useLogoPaletteSwitch } from './useLogoPaletteSwitch';

let asked: string[] = [];
let off = () => {};
beforeEach(() => {
  asked = [];
  off = onPaletteCategoryRequest((id) => asked.push(id));
  vi.useFakeTimers();
});
afterEach(() => {
  off();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const infographic = layOutIllustratePages([{ id: 'i', orientation: 'portrait' }]);
const both = layOutIllustratePages([{ id: 'i', orientation: 'portrait' }, newLogoPage('l')]);

// A sheet on screen for each page, side by side, 100 px wide.
function sheets(pages: readonly LaidOutPage[]) {
  pages.forEach((p, i) => {
    const el = document.createElement('div');
    el.setAttribute('data-illustrate-page-id', p.id);
    el.getBoundingClientRect = () =>
      ({ left: i * 200, right: i * 200 + 100, top: 0, bottom: 100 }) as DOMRect;
    document.body.appendChild(el);
  });
}
// A press at x on the canvas content (or, `chrome`, on a palette floating over it).
const press = (x: number, chrome = false) => {
  const host = document.createElement('div');
  if (!chrome) host.setAttribute('data-canvas-content', '');
  document.body.appendChild(host);
  host.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: 50, bubbles: true }));
  host.remove();
  vi.runAllTimers();
};

describe('useLogoPaletteSwitch', () => {
  it('asks for Logo when a logo page is added, not for what was already there', () => {
    const { rerender } = renderHook(({ pages }) => useLogoPaletteSwitch(pages, true), {
      initialProps: { pages: infographic },
    });
    expect(asked).toEqual([]);
    rerender({ pages: both });
    vi.runAllTimers();
    expect(asked).toEqual(['logo']);
  });

  it('asks when a press lands on a logo page other than the last pressed', () => {
    sheets(both);
    renderHook(() => useLogoPaletteSwitch(both, true));
    press(50);
    expect(asked).toEqual([]);
    press(250);
    press(260);
    expect(asked).toEqual(['logo']);
    press(50);
    press(250);
    expect(asked).toEqual(['logo', 'logo']);
  });

  it('stays quiet when inactive (a viewer, or a bare view)', () => {
    sheets(both);
    renderHook(() => useLogoPaletteSwitch(both, false));
    press(250);
    expect(asked).toEqual([]);
  });

  it('asks on opening when the page in view is a logo page, and again a little later', () => {
    const logoFirst = layOutIllustratePages([
      newLogoPage('l'),
      { id: 'i', orientation: 'portrait' },
    ]);
    renderHook(() => useLogoPaletteSwitch(logoFirst, true));
    vi.runAllTimers();
    expect(asked).toEqual(['logo', 'logo']);
    asked = [];
    renderHook(() => useLogoPaletteSwitch(infographic, true));
    vi.runAllTimers();
    expect(asked).toEqual([]);
  });

  it('asks when a logo page is gone to (its label, the navigator), once per page', () => {
    const { result } = renderHook(() => useLogoPaletteSwitch(both, true));
    vi.runAllTimers();
    act(() => result.current.pageShown(both[1]!));
    act(() => result.current.pageShown(both[1]!));
    vi.runAllTimers();
    expect(asked).toEqual(['logo']);
  });

  it('ignores a press on chrome floating over a logo page (a palette category just chosen)', () => {
    sheets(both);
    renderHook(() => useLogoPaletteSwitch(both, true));
    press(50);
    press(250, true);
    expect(asked).toEqual([]);
  });
});
