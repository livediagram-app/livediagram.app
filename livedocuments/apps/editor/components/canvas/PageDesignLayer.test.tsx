// @vitest-environment jsdom

// A page's design on the canvas (docs/specs/011-theme/page-designs.md): decoration only, behind everything, its motion
// off by default, running only on screen; the views reuse a page's answer while nothing it shows changed.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Element, type Page } from '@livedocuments/document';
import { pageDesignViews } from '@/lib/page-design-views';
import { PageDesignLayer } from './PageDesignLayer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...extra,
});
const pages = layOutPages([slide('a'), slide('b'), slide('c', { design: { id: 'none' } })]);
const base = {
  pages,
  row: pages,
  elements: [] as Element[],
  theme: { elementStroke: '#2563eb' },
  paperDark: false,
  tabFont: 'inter',
};

describe('pageDesignViews', () => {
  it('draws the tab design on each page but one that opts out, and nothing without a design', () => {
    const views = pageDesignViews({ ...base, tabDesign: { id: 'waves' } });
    expect([...views.keys()]).toEqual(['a', 'b']);
    expect(pageDesignViews({ ...base, tabDesign: undefined }).size).toBe(0);
  });

  it('keeps a page’s view while nothing it shows changed, and covers a text that would not read', () => {
    const first = pageDesignViews({
      ...base,
      tabDesign: { id: 'split-fields', intensity: 1, calm: 0 },
    });
    const r = pages[0]!.rect;
    const text = {
      id: 't',
      type: 'text',
      x: r.x + 20,
      y: r.y + 200,
      width: 300,
      height: 50,
      label: 'Hi',
      textColor: '#93c5fd',
    } as unknown as Element;
    const next = pageDesignViews({
      ...base,
      tabDesign: { id: 'split-fields', intensity: 1, calm: 0 },
      elements: [text],
    });
    expect(next.get('b')).toBe(first.get('b'));
    expect(next.get('a')).not.toBe(first.get('a'));
    expect(next.get('a')!.scrims).toHaveLength(1);
    expect(next.get('a')!.failing).toBe(1);
  });
});

describe('PageDesignLayer', () => {
  it('draws its layers aria-hidden and without pointer events, at the intensity, with no motion by default', () => {
    const view = pageDesignViews({ ...base, tabDesign: { id: 'aurora', intensity: 0.5 } }).get(
      'a',
    )!;
    const { container } = render(<PageDesignLayer view={view} scope="a" />);
    const root = container.querySelector<HTMLElement>('[data-page-design="aurora"]')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
    expect(root.style.opacity).toBe('0.5');
    expect(root.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(root.querySelector('.pd-drift')).toBeNull();
    expect(root.hasAttribute('data-pd-run')).toBe(false);
    // Its ids are the page's own.
    expect(root.innerHTML).toContain(`id="a-${view.painted.uid}`);
  });

  it('moves an animated design only while its page is on screen', () => {
    let fire: (on: boolean) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          fire = (on) => cb([{ isIntersecting: on }]);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const view = pageDesignViews({
      ...base,
      tabDesign: { id: 'waves', animate: true, speed: 2 },
    }).get('a')!;
    const { container, unmount } = render(<PageDesignLayer view={view} scope="a" />);
    const root = container.querySelector<HTMLElement>('[data-page-design]')!;
    expect(root.querySelector('.pd-pan')).not.toBeNull();
    expect(root.style.getPropertyValue('--pd-rate')).toBe('2');
    act(() => fire(true));
    expect(root.hasAttribute('data-pd-run')).toBe(true);
    act(() => fire(false));
    expect(root.hasAttribute('data-pd-run')).toBe(false);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('runs a moving design where nothing can watch the screen', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const view = pageDesignViews({ ...base, tabDesign: { id: 'aurora', animate: true } }).get('a')!;
    const { container } = render(<PageDesignLayer view={view} scope="a" />);
    expect(container.querySelector('[data-page-design]')!.hasAttribute('data-pd-run')).toBe(true);
  });

  it('draws grain and the scrims apart from the design', () => {
    const r = pages[0]!.rect;
    const text = {
      id: 't',
      type: 'text',
      x: r.x + 20,
      y: r.y + 200,
      width: 300,
      height: 50,
      label: 'Hi',
      textColor: '#93c5fd',
    } as unknown as Element;
    const view = pageDesignViews({
      ...base,
      elements: [text],
      tabDesign: { id: 'split-fields', intensity: 1, calm: 0, grain: 0.5 },
    }).get('a')!;
    const { container } = render(<PageDesignLayer view={view} scope="a" />);
    expect(container.querySelector('[data-page-design-scrims="1"]')).not.toBeNull();
    expect(container.innerHTML).toContain('feTurbulence');
  });
});
