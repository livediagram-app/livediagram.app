// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's layout (docs/specs/013-workspace/explorer-home.md "Layout"): one column at every width,
// Jump Back In then What Happened, each a landmark opened by a display heading and its quiet
// link. No Timeline column and no switch. A failed read says so and retries.

const { track, useHome, wide } = vi.hoisted(() => ({
  track: vi.fn(),
  useHome: vi.fn(),
  wide: { value: true },
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/app/explorer/home/useHome', () => ({ useHome }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({ DocumentThumbnail: () => <span /> }));
vi.mock('./HomeWelcome', () => ({
  HomeWelcome: (p: { offerSignIn: boolean }) => (
    <div data-home-welcome="" data-offer-sign-in={String(p.offerSignIn)} />
  ),
}));
vi.mock('@livedocuments/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livedocuments/ui')>()),
  useMediaQuery: () => wide.value,
}));

import { HomePane } from './HomePane';
import { ExplorerProvider } from '@/app/explorer/ExplorerContext';
import type { ExplorerStateValue } from '@/app/explorer/useExplorerState';
import { fixtureAction, fixtureGroup, fixtureJumpItem, fixturePerson } from './home-test-utils';

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
      timelineHref="/explorer/timeline"
      onSeeTimeline={vi.fn()}
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
    useHome.mockReturnValue(
      data({
        whatHappened: [
          fixtureGroup({
            actions: [fixtureAction('x', 'edited', 'p', Date.now())],
            people: [fixturePerson('p')],
          }),
        ],
      }),
    );
    const { container } = renderIt();
    const sections = screen.getAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-labelledby'))).toEqual([
      'home-jump-back-in',
      'home-what-happened',
    ]);
    expect(screen.getByRole('region', { name: 'Jump Back In' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'What Happened' })).toBeTruthy();
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

  it('opens each section with a display heading, its link at the end of the row, no rule', () => {
    wide.value = true;
    // Each section has something to show, so each carries its link.
    useHome.mockReturnValue(
      data({
        jumpBackIn: { mostUsed: [fixtureJumpItem('a')], recent: [] },
        whatHappened: [
          fixtureGroup({
            actions: [fixtureAction('x', 'edited', 'p', Date.now())],
            people: [fixturePerson('p')],
          }),
        ],
      }),
    );
    renderIt();
    for (const [name, link] of [
      ['Jump Back In', 'See More'],
      ['What Happened', 'See Timeline'],
    ] as const) {
      const heading = screen.getByRole('heading', { level: 2, name });
      const row = heading.parentElement!;
      expect(row.className).not.toContain('border-b');
      expect(heading.className).toContain('font-extrabold');
      expect(row.className).toContain('justify-between');
      expect(row.lastElementChild!.textContent).toBe(link);
    }
  });

  it('shows Jump Back In alone when nothing happened', () => {
    wide.value = true;
    renderIt();
    expect(screen.getAllByRole('region').map((s) => s.getAttribute('aria-labelledby'))).toEqual([
      'home-jump-back-in',
    ]);
  });

  it('greets a person with nothing yet with the starts, in place of both sections', async () => {
    wide.value = true;
    const explorer = {
      ownerId: 'me',
      loading: false,
      documents: [],
      shared: [],
      teamDocuments: [],
      offlineDocuments: [],
      failedReads: { documents: false, shared: false },
      clerkUserId: null,
    } as unknown as ExplorerStateValue;
    const { container } = render(
      <ExplorerProvider value={explorer}>
        <HomePane
          ownerId="me"
          onSeen={vi.fn()}
          timelineHref="/explorer/timeline"
          onSeeTimeline={vi.fn()}
          recentHref="/explorer/recent"
          onSeeMore={vi.fn()}
        />
      </ExplorerProvider>,
    );
    await vi.waitFor(() => expect(container.querySelector('[data-home-welcome]')).not.toBeNull());
    expect(container.querySelector('[data-home-section="jump-back-in"]')).toBeNull();
    expect(container.querySelector('[data-home-section="what-happened"]')).toBeNull();
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
    expect(screen.getByRole('heading', { name: 'Jump Back In' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What Happened' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Jump Back In' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });
});
