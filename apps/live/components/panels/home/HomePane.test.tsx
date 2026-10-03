// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's layout (docs/specs/013-workspace/explorer-home.md "Layout"): one column at every width,
// Jump back in then What happened, each a landmark opened by a heading with a rule and its quiet
// link. No Timeline column and no switch. A failed read says so and retries.

const { track, useHome, wide } = vi.hoisted(() => ({
  track: vi.fn(),
  useHome: vi.fn(),
  wide: { value: true },
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/app/explorer/home/useHome', () => ({ useHome }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({ DocumentThumbnail: () => <span /> }));
vi.mock('@livediagram/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livediagram/ui')>()),
  useMediaQuery: () => wide.value,
}));

import { HomePane } from './HomePane';

const data = (over = {}) => ({
  status: 'ready',
  jumpBackIn: { mostUsed: [], recent: [] },
  whatHappened: [],
  retry: vi.fn(),
  ...over,
});

function renderIt() {
  return render(
    <HomePane
      ownerId="me"
      onSeen={vi.fn()}
      allActivityHref="/explorer/timeline"
      onSeeAll={vi.fn()}
      recentHref="/explorer/recent"
      onSeeMore={vi.fn()}
    />,
  );
}

beforeEach(() => {
  track.mockReset();
  useHome.mockReturnValue(data());
});
afterEach(() => vi.unstubAllGlobals());

describe('HomePane', () => {
  it.each([true, false])('is one column of two sections, wide=%s, with no Timeline', (isWide) => {
    wide.value = isWide;
    const { container } = renderIt();
    const sections = screen.getAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-labelledby'))).toEqual([
      'home-jump-back-in',
      'home-what-happened',
    ]);
    expect(screen.getByRole('region', { name: 'Jump back in' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'What happened' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Timeline' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull();
    expect(
      [...container.querySelectorAll('[data-home-section]')].map((s) =>
        s.getAttribute('data-home-section'),
      ),
    ).toEqual(['jump-back-in', 'what-happened']);
    expect(track).toHaveBeenCalledWith('Home', 'Opened', expect.stringMatching(/^(Landing|Nav)$/));
  });

  it('opens each section with a heading with a rule, its link at the end of the row', () => {
    wide.value = true;
    renderIt();
    for (const [name, link] of [
      ['Jump back in', 'See more'],
      ['What happened', 'See all activity'],
    ] as const) {
      const heading = screen.getByRole('heading', { level: 2, name });
      const row = heading.parentElement!;
      expect(row.className).toContain('border-b');
      expect(row.className).toContain('justify-between');
      expect(row.lastElementChild!.textContent).toBe(link);
    }
  });

  it('says the read failed and retries', () => {
    wide.value = true;
    const retry = vi.fn();
    useHome.mockReturnValue(data({ status: 'error', retry }));
    renderIt();
    expect(screen.getByRole('alert').textContent).toContain(
      'Home could not load. Check your connection and try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the headings in place while loading', () => {
    wide.value = true;
    useHome.mockReturnValue(data({ status: 'loading' }));
    renderIt();
    expect(screen.getByRole('heading', { name: 'Jump back in' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What happened' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Jump back in' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });
});
