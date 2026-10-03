// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's Timeline column (docs/specs/013-workspace/explorer-home.md "Timeline"): one entry per
// document per day under day markers, alternating sides, each a link named by the document, what
// happened and when; the paging slot loads more as it nears the viewport and offers Try again.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: () => <span />,
}));

import { HomeTimeline } from './HomeTimeline';
import { fixtureEntry } from './home-test-utils';

const today = (h: number) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.getTime();
};

let observed: { callback: IntersectionObserverCallback; el: Element }[] = [];
beforeEach(() => {
  track.mockReset();
  observed = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(el: Element) {
        observed.push({ callback: this.callback, el });
      }
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderIt(over: Partial<Parameters<typeof HomeTimeline>[0]> = {}) {
  const props = {
    ownerId: 'me',
    entries: [
      fixtureEntry('e3', 'd1', 'opened', today(15), 'Payments architecture'),
      fixtureEntry('e2', 'd1', 'created', today(9), 'Payments architecture'),
      fixtureEntry('e1', 'd2', 'updated', today(8), 'Onboarding'),
    ],
    loading: false,
    hasMore: false,
    paging: 'idle' as const,
    onLoadMore: vi.fn(),
    onRetryMore: vi.fn(),
    labelledBy: 'tl',
    ...over,
  };
  render(
    <>
      <h2 id="tl">Timeline</h2>
      <HomeTimeline {...props} />
    </>,
  );
  return props;
}

describe('HomeTimeline', () => {
  it('folds a document’s day into its strongest entry, named by what happened', () => {
    renderIt();
    const list = screen.getByRole('list', { name: 'Timeline' });
    expect(list.tagName).toBe('OL');
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('aria-label')?.replace(/ at .*/, ''))).toEqual([
      'Payments architecture, created',
      'Onboarding, updated',
    ]);
    expect(screen.getByText('Today')).toBeTruthy();
    fireEvent.click(links[0]!);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'Timeline');
  });

  it('marks each kind with its own glyph, alternating sides', () => {
    renderIt();
    const markers = [...document.querySelectorAll('[data-kind]')].map((m) =>
      m.getAttribute('data-kind'),
    );
    expect(markers).toEqual(['created', 'updated']);
    const sides = [...document.querySelectorAll('li[data-side]')].map((li) =>
      li.getAttribute('data-side'),
    );
    expect(sides).toEqual(['start', 'end']);
  });

  it('asks for the next page when the slot nears the viewport', () => {
    const props = renderIt({ hasMore: true });
    const slot = screen.getByTestId('home-timeline-paging');
    const watcher = observed.find((o) => o.el === slot)!;
    watcher.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('offers Try again in the slot when a page failed', () => {
    const props = renderIt({ hasMore: true, paging: 'error' });
    expect(screen.getByText('Could not load more.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetryMore).toHaveBeenCalledTimes(1);
  });

  it('says what will appear when there is nothing yet', () => {
    renderIt({ entries: [] });
    expect(screen.getByText('Documents you create, update or open will appear here.')).toBeTruthy();
  });
});
