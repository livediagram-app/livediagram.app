// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's layout (docs/specs/013-workspace/explorer-home.md "Layout"): two landmarks on a tablet or
// wider; on a phone, a Recent / Timeline switch following the tabs pattern, Recent first. A failed
// read says so and retries.

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
  jumpBackIn: [],
  whatHappened: [],
  timeline: [],
  hasMore: false,
  paging: 'idle',
  retry: vi.fn(),
  loadMore: vi.fn(),
  retryMore: vi.fn(),
  ...over,
});

function renderIt() {
  render(
    <HomePane
      ownerId="me"
      onSeen={vi.fn()}
      allActivityHref="/explorer/timeline"
      onSeeAll={vi.fn()}
    />,
  );
}

beforeEach(() => {
  track.mockReset();
  useHome.mockReturnValue(data());
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('HomePane', () => {
  it('shows Recent beside the Timeline as two landmarks when wide', () => {
    wide.value = true;
    renderIt();
    expect(screen.getByRole('region', { name: 'Recent' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Timeline' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(track).toHaveBeenCalledWith('Home', 'Opened', expect.stringMatching(/^(Landing|Nav)$/));
  });

  it('switches between Recent and Timeline on a phone, Recent first', () => {
    wide.value = false;
    renderIt();
    const [recent, timeline] = screen.getAllByRole('tab');
    expect(recent!.getAttribute('aria-selected')).toBe('true');
    expect(recent!.tabIndex).toBe(0);
    expect(timeline!.tabIndex).toBe(-1);
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(recent!.id);
    expect(screen.getByText('Jump back in')).toBeTruthy();

    fireEvent.keyDown(recent!, { key: 'ArrowRight' });
    expect(timeline!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(timeline);
    expect(panel.getAttribute('aria-labelledby')).toBe(timeline!.id);
    expect(screen.queryByText('Jump back in')).toBeNull();

    fireEvent.keyDown(timeline!, { key: 'ArrowRight' });
    expect(recent!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(recent!, { key: 'End' });
    expect(timeline!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(timeline!, { key: 'Home' });
    expect(recent!.getAttribute('aria-selected')).toBe('true');
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
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jump back in' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What happened' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();
  });
});
