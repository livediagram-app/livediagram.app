// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Hero, HERO_CTAS } from './Hero';

// The set is under test, not the animated stage, headline or connector around it, which need
// layout jsdom has not got.
vi.mock('./HeroIllustration', () => ({ HeroIllustration: () => null }));
vi.mock('./HeroConnectors', () => ({ HeroConnectors: () => null }));
vi.mock('./HeroTitleLine', () => ({
  HeroTitleLine: ({ children }: { children: React.ReactNode }) => <>Diagram{children}</>,
}));

beforeAll(() => {
  // The illustration's stage reads the reduced-motion preference.
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }) as unknown as MediaQueryList,
  );
});

// docs/specs/019-marketing/marketing-site.md "Hero": Drawing, Diagram, Brainstorm, in that order,
// presented as one equal set.
describe('the hero calls to action', () => {
  it('offers Drawing, Diagram and Brainstorm, in that order', () => {
    expect(HERO_CTAS.map((c) => c.label)).toEqual(['Drawing', 'Diagram', 'Brainstorm']);
  });

  it('sends Drawing straight to a whiteboard, Diagram to the wizard, Brainstorm to its collection', () => {
    expect(HERO_CTAS.map((c) => [c.href, c.source])).toEqual([
      ['/new?template=whiteboard', 'Home.HeroDraw'],
      ['/new', 'Home.Hero'],
      ['/new?browse=brainstorm', 'Home.HeroBrainstorm'],
    ]);
  });
});

describe('the hero set', () => {
  const links = () => {
    render(<Hero />);
    const group = screen.getByRole('group', { name: 'Ways to start' });
    return within(group).getAllByRole('link');
  };

  it('is one group named for assistive technology, holding the three in order', () => {
    const all = links();
    expect(all.map((a) => a.textContent)).toEqual(['Drawing', 'Diagram', 'Brainstorm']);
    expect(all.map((a) => a.getAttribute('href'))).toEqual([
      '/new?template=whiteboard&via=Home.HeroDraw',
      '/new?via=Home.Hero',
      '/new?browse=brainstorm&via=Home.HeroBrainstorm',
    ]);
  });

  it('dresses all three alike, in the secondary style: none is filled', () => {
    const classes = links().map((a) => a.className);
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('bg-white');
    expect(classes[0]).not.toContain('bg-brand-500');
  });

  it('gives each a fixed width, so the row holds still', () => {
    const tokens = links()[0]!.className.split(' ');
    expect(tokens).toContain('w-full');
    expect(tokens.some((t) => /^sm:w-\d+$/.test(t))).toBe(true);
  });

  it('leads each label with its own decorative icon', () => {
    const icons = links().map((a) => {
      const svg = a.firstElementChild;
      expect(svg?.tagName.toLowerCase()).toBe('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      return svg!.innerHTML;
    });
    expect(new Set(icons).size).toBe(3);
  });
});
