// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    const wordmark = container.querySelector('[data-logotype]');
    expect(wordmark?.textContent).toBe('livediagram');
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
    const paths = [...container.querySelectorAll('path')];
    expect(paths.length).toBe(4);
    for (const p of paths) expect(p.getAttribute('fill')).toBe('currentColor');
  });

  it('is decorative', () => {
    expect(
      render(<BrandMark />)
        .container.querySelector('svg')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
