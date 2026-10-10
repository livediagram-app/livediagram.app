// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Brand, BrandMark } from './Brand';
import { PRISM_PALETTES, prismPalette } from './brand-prism';

const stops = (container: HTMLElement) =>
  [...container.querySelectorAll('stop')].map((s) => ({
    light: s.style.getPropertyValue('--ldm-l'),
    dark: s.style.getPropertyValue('--ldm-d'),
  }));

// The wordmark is a logotype (WCAG 1.4.3 sets logo text no contrast minimum); the contrast audits
// find it by its mark rather than by its classes.
describe('Brand', () => {
  it('marks its wordmark as a logotype', () => {
    const { container } = render(<Brand />);
    const wordmark = container.querySelector('[data-logotype]')!.cloneNode(true) as HTMLElement;
    // The gleam overlay repeats the letters but is hidden from assistive tech.
    wordmark.querySelector('[aria-hidden="true"]')?.remove();
    expect(wordmark.textContent).toBe('livediagram');
  });

  it('accents "live", brand-600 in light and sky-400 in dark, with "diagram" in ink', () => {
    const { container } = render(<Brand />);
    const live = container.querySelector('[data-logotype] > span');
    expect(live?.textContent).toBe('live');
    expect(live?.className).toBe('text-brand-600 dark:text-sky-400');
  });

  it('tints "live" and the mark from a theme accent', () => {
    const { container } = render(<Brand accentColor="#db2777" />);
    const live = container.querySelector<HTMLElement>('[data-logotype] > span');
    expect(live?.style.color).toBe('rgb(219, 39, 119)');
    const vivid = prismPalette('light', '#db2777').vivid;
    expect(stops(container).map((s) => s.light)).toContain(vivid);
  });

  it('renders as a link when given an href', () => {
    const { container } = render(<Brand href="/" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});

describe('BrandMark', () => {
  it('carries the brand light and dark palettes on every stop', () => {
    const { container } = render(<BrandMark />);
    const all = stops(container);
    expect(all.length).toBe(9);
    expect(all.map((s) => s.light)).toContain(PRISM_PALETTES.light.vivid);
    expect(all.map((s) => s.dark)).toContain(PRISM_PALETTES.dark.vivid);
  });

  it('gives each instance its own gradient ids', () => {
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark accentColor="#15803d" />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const path of container.querySelectorAll('path[fill^="url"]')) {
      const ref = path.getAttribute('fill')!.slice(5, -1);
      expect(ids).toContain(ref);
    }
  });

  it('adds the inner diagram, sheen and pulse only in full', () => {
    expect(render(<BrandMark />).container.querySelectorAll('circle').length).toBe(0);
    expect(render(<BrandMark variant="full" />).container.querySelectorAll('circle').length).toBe(
      5,
    );
  });

  it('draws one colour at per-face opacity in mono, for a solid tile', () => {
    const { container } = render(<BrandMark tone="mono" />);
    expect(container.querySelector('linearGradient')).toBeNull();
    const shown = [...container.querySelectorAll('path')].filter(
      (p) => p.getAttribute('d') && p.getAttribute('opacity') !== '0',
    );
    expect(shown.map((p) => p.getAttribute('opacity'))).toEqual(['0.45', '0.7', '0.9', '0.6']);
    for (const p of shown) expect(p.getAttribute('fill')).toBe('currentColor');
  });

  it('rests on the artwork: the lid, the two front sides and the fold', () => {
    const { container } = render(<BrandMark />);
    const shown = [...container.querySelectorAll('path')].filter(
      (p) => p.getAttribute('d') && p.getAttribute('opacity') !== '0',
    );
    expect(
      shown.map((p) =>
        p
          .getAttribute('fill')!
          .replace(/^url\(#[^-]+-/, '')
          .replace(')', ''),
      ),
    ).toEqual(['backTop', 'backRight', 'frontLeft', 'frontBottom']);
  });

  it('is decorative', () => {
    expect(
      render(<BrandMark />)
        .container.querySelector('svg')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});

describe('the hover turn', () => {
  it('opens and turns the prism while pointed at, and settles home after', async () => {
    const { act, fireEvent } = await import('@testing-library/react');
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const { container } = render(<Brand href="/" />);
    const top = () => container.querySelector('path')!.getAttribute('d');
    const rest = top();
    const step = (ms: number) =>
      act(() => frames.splice(0).forEach((cb) => cb(performance.now() + ms)));

    fireEvent.pointerEnter(container.querySelector('a')!, { pointerType: 'mouse' });
    step(1000);
    expect(top()).not.toBe(rest);

    fireEvent.pointerLeave(container.querySelector('a')!);
    step(0);
    step(5000);
    expect(top()).toBe(rest);
    raf.mockRestore();
  });

  it('holds still under reduced motion', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { container } = render(<Brand href="/" />);
    container
      .querySelector('a')!
      .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });
});

describe('the wordmark gleam', () => {
  it('sweeps once per hover, finishing even if the pointer leaves', async () => {
    const { act, fireEvent } = await import('@testing-library/react');
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const { container } = render(<Brand href="/" />);
    const gleam = container.querySelector<HTMLElement>('[data-logotype] [aria-hidden="true"]')!;
    const link = container.querySelector('a')!;
    const step = (at: number) => act(() => frames.splice(0).forEach((cb) => cb(at)));

    expect(gleam.style.opacity).toBe('');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    step(performance.now() + 300);
    expect(gleam.style.opacity).toBe('1');
    fireEvent.pointerLeave(link);
    step(performance.now() + 5000);
    expect(gleam.style.opacity).toBe('0');
    expect(gleam.style.backgroundPosition).toBe('0% 0px');
    vi.restoreAllMocks();
  });

  it('ignores touch, which has no hover', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const { container } = render(<Brand href="/" />);
    fireEvent.pointerEnter(container.querySelector('a')!, { pointerType: 'touch' });
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });
});

describe('a logo link to the page already open', () => {
  it('scrolls to the top instead of reloading', async () => {
    const { fireEvent } = await import('@testing-library/react');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as never;
    const { container } = render(<Brand href={window.location.pathname} />);
    const event = fireEvent.click(container.querySelector('a')!);
    expect(event).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps without smoothing under reduced motion', async () => {
    const { fireEvent } = await import('@testing-library/react');
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as never;
    const { container } = render(<Brand href={window.location.pathname} />);
    fireEvent.click(container.querySelector('a')!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('navigates normally to another page, or on a modified click', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as never;
    const other = render(<Brand href="/somewhere-else/" />);
    expect(fireEvent.click(other.container.querySelector('a')!)).toBe(true);
    const here = render(<Brand href={window.location.pathname} />);
    expect(fireEvent.click(here.container.querySelector('a')!, { metaKey: true })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('sizes', () => {
  it('sets the large logo a size up for the footer, with a wider gap', () => {
    const { container } = render(<Brand size="lg" />);
    expect(container.firstElementChild!.className).toContain('gap-3 text-2xl');
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('size-10');
  });
});
