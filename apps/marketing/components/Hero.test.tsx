// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Hero } from './Hero';

// The hero's text is under test, not the animated stage, headline or connector around it, which need
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

// docs/specs/019-marketing/marketing-site.md "Hero": the headline and the lead, then the stage; the
// header's Choose Template and Start Blank are the ways in, so the hero carries no buttons.
describe('the hero', () => {
  it('carries no calls to action of its own', () => {
    render(<Hero />);
    expect(screen.queryByRole('group', { name: 'Ways to start' })).toBeNull();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('names the four things you can make in its lead', () => {
    render(<Hero />);
    expect(
      screen.getByText(/from diagrams and whiteboards to illustrations and documents/),
    ).toBeTruthy();
  });
});
