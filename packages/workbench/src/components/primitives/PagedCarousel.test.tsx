// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PagedCarousel, pageMounted } from './PagedCarousel';
import { acrossPages, onAnyPage } from './paged-carousel-testing';

// The paged carousel mounts only the page on show and its neighbours (each product's
// docs/specs/011-theme/canvas-and-theme-dialog.md, "PagedCarousel").
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ITEMS = Array.from({ length: 45 }, (_, i) => `Item ${i}`);

function carousel(initialIndex?: number) {
  return render(
    <PagedCarousel
      items={ITEMS}
      perPage={9}
      label="Looks"
      heading={<h2>Looks</h2>}
      gridClass="grid grid-cols-3"
      initialIndex={initialIndex}
      renderItem={(item) => (
        <button key={item} type="button">
          {item}
        </button>
      )}
    />,
  );
}

const mountedPages = () => screen.queryAllByRole('group').map((g) => g.getAttribute('aria-label'));

describe('pageMounted', () => {
  it('mounts the page on show and its two neighbours', () => {
    expect([0, 1, 2, 3, 4].map((i) => pageMounted(i, 2, null, null))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it('mounts every page a slide passes, and a page holding focus', () => {
    expect([0, 1, 2, 3, 4].map((i) => pageMounted(i, 4, { from: 0, to: 4 }, null))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(pageMounted(0, 4, null, 0)).toBe(true);
    expect(pageMounted(1, 4, null, 0)).toBe(false);
  });
});

describe('PagedCarousel', () => {
  it('opens with the first page and the next mounted, the rest as empty hidden slots', () => {
    const { container } = carousel();
    expect(mountedPages()).toEqual(['Looks page 1 of 5', 'Looks page 2 of 5']);
    expect(screen.queryByText('Item 18')).toBeNull();
    const strip = container.querySelector('.snap-x')!;
    // Every page keeps its slot, so the strip still scrolls and snaps to each.
    expect(strip.children).toHaveLength(5);
    expect(strip.children[4]!.getAttribute('aria-hidden')).toBe('true');
    expect(strip.children[4]!.childElementCount).toBe(0);
  });

  it('opens on the page holding initialIndex, with both neighbours', () => {
    carousel(22);
    expect(mountedPages()).toEqual(['Looks page 2 of 5', 'Looks page 3 of 5', 'Looks page 4 of 5']);
  });

  it('moves the window with the arrows, and says which page is current on the dots', () => {
    carousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next looks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next looks' }));
    expect(mountedPages()).toEqual(['Looks page 2 of 5', 'Looks page 3 of 5', 'Looks page 4 of 5']);
    expect(
      screen.getByRole('button', { name: 'Looks page 3 of 5' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('keeps the pages a dots move slides past mounted until the strip lands', () => {
    const { container } = carousel();
    fireEvent.click(screen.getByRole('button', { name: 'Looks page 5 of 5' }));
    expect(mountedPages()).toHaveLength(5);
    const strip = container.querySelector('.snap-x') as HTMLDivElement;
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 100 });
    strip.scrollLeft = 400;
    fireEvent.scroll(strip);
    expect(mountedPages()).toEqual(['Looks page 4 of 5', 'Looks page 5 of 5']);
  });

  it('follows a swipe, and ignores a scroll before the strip has a width', () => {
    const { container } = carousel();
    const strip = container.querySelector('.snap-x') as HTMLDivElement;
    fireEvent.scroll(strip);
    expect(mountedPages()).toEqual(['Looks page 1 of 5', 'Looks page 2 of 5']);
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 100 });
    strip.scrollLeft = 200;
    fireEvent.scroll(strip);
    expect(mountedPages()).toEqual(['Looks page 2 of 5', 'Looks page 3 of 5', 'Looks page 4 of 5']);
  });

  it('never drops focus: a page holding it stays mounted however far the strip moves', () => {
    carousel();
    const tile = screen.getByRole('button', { name: 'Item 2' });
    act(() => tile.focus());
    fireEvent.click(screen.getByRole('button', { name: 'Looks page 5 of 5' }));
    const strip = document.querySelector('.snap-x') as HTMLDivElement;
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 100 });
    strip.scrollLeft = 400;
    fireEvent.scroll(strip);
    expect(mountedPages()).toEqual(['Looks page 1 of 5', 'Looks page 4 of 5', 'Looks page 5 of 5']);
    expect(document.activeElement).toBe(tile);
    // Focus leaves the page: it unmounts with the rest of the far pages.
    act(() => screen.getByRole('button', { name: 'Previous looks' }).focus());
    expect(mountedPages()).toEqual(['Looks page 4 of 5', 'Looks page 5 of 5']);
  });

  it('slides back with Previous, jumping at once under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    carousel(40);
    fireEvent.click(screen.getByRole('button', { name: 'Previous looks' }));
    expect(mountedPages()).toEqual(['Looks page 3 of 5', 'Looks page 4 of 5', 'Looks page 5 of 5']);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('stays on a page that still exists when the list shrinks under it', () => {
    const view = carousel(40);
    view.rerender(
      <PagedCarousel
        items={ITEMS.slice(0, 12)}
        perPage={9}
        label="Looks"
        heading={<h2>Looks</h2>}
        gridClass="grid"
        renderItem={(item) => <span key={item}>{item}</span>}
      />,
    );
    expect(mountedPages()).toEqual(['Looks page 1 of 2', 'Looks page 2 of 2']);
    expect(
      screen.getByRole('button', { name: 'Looks page 2 of 2' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('shows no navigation for a single page', () => {
    render(
      <PagedCarousel
        items={['a', 'b']}
        perPage={9}
        label="Looks"
        heading={<h2>Looks</h2>}
        gridClass="grid"
        renderItem={(item) => <span key={item}>{item}</span>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Next looks' })).toBeNull();
    expect(mountedPages()).toEqual(['Looks page 1 of 1']);
  });
});

describe('the carousel test helpers', () => {
  const names = () => screen.queryAllByRole('button', { name: /^Item / }).map((b) => b.textContent);

  it('reads every page in order, each tile once', () => {
    carousel();
    expect(acrossPages('Looks', names, fireEvent.click)).toEqual(ITEMS);
  });

  it('finds a tile on whichever page holds it, or null', () => {
    carousel();
    const find = (n: string) => () => screen.queryByRole('button', { name: n });
    expect(onAnyPage('Looks', find('Item 1'), fireEvent.click)?.textContent).toBe('Item 1');
    expect(onAnyPage('Looks', find('Item 44'), fireEvent.click)?.textContent).toBe('Item 44');
    expect(onAnyPage('Looks', find('Item 99'), fireEvent.click)).toBeNull();
  });

  it('reads a single page without dots', () => {
    render(
      <PagedCarousel
        items={['Item a']}
        perPage={9}
        label="Looks"
        heading={<h2>Looks</h2>}
        gridClass="grid"
        renderItem={(item) => (
          <button key={item} type="button">
            {item}
          </button>
        )}
      />,
    );
    expect(acrossPages('Looks', names, fireEvent.click)).toEqual(['Item a']);
  });
});
