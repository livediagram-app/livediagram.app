// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Jump back in (docs/specs/013-workspace/explorer-home.md "Jump back in"): on a desktop or tablet a
// 4 by 2 grid, most used on top, recent below, See more in the heading row; on a phone a strip that
// alternates and ends in a See more tile. One list of links named by their documents, no group
// titles; a local document carries the Local only pill.

const { track, wide } = vi.hoisted(() => ({ track: vi.fn(), wide: { value: true } }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string; offline?: boolean }) => (
    <span data-testid={`thumb-${p.documentId}`} data-offline={String(Boolean(p.offline))} />
  ),
}));
vi.mock('@livediagram/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livediagram/ui')>()),
  useMediaQuery: () => wide.value,
}));

import { JumpBackIn } from './JumpBackIn';
import type { JumpBackInSet } from '@/app/explorer/home/home-model';
import { fixtureJumpItem as item } from './home-test-utils';

const set = (mostUsed: string[], recent: string[]): JumpBackInSet => ({
  mostUsed: mostUsed.map((id) => item(id)),
  recent: recent.map((id) => item(id)),
});

function renderIt(s: JumpBackInSet, onSeeMore = vi.fn()) {
  render(
    <JumpBackIn
      ownerId="me"
      set={s}
      loading={false}
      recentHref="/explorer/recent"
      onSeeMore={onSeeMore}
    />,
  );
  return onSeeMore;
}

const names = (links: HTMLElement[]) => links.map((l) => l.getAttribute('aria-label'));

beforeEach(() => track.mockReset());

describe('JumpBackIn, desktop and tablet', () => {
  beforeEach(() => {
    wide.value = true;
  });

  it('lists the most used then the recent as one list of links named by their documents', () => {
    renderIt(set(['m1', 'm2', 'm3', 'm4'], ['r1', 'r2', 'r3', 'r4']));
    const list = screen.getByRole('list', { name: 'Jump back in' });
    const links = within(list).getAllByRole('link');
    expect(names(links)).toEqual([
      'Doc m1',
      'Doc m2',
      'Doc m3',
      'Doc m4',
      'Doc r1',
      'Doc r2',
      'Doc r3',
      'Doc r4',
    ]);
    expect(links[0]!.getAttribute('href')).toBe('/document/m1');
    expect(links[0]!.textContent).toBe('Doc m1');
    // No group titles, on screen or for assistive technology.
    expect(screen.queryByText(/most used/i)).toBeNull();
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('starts the recent on the second row however short the first is', () => {
    renderIt(set(['m1', 'm2'], ['r1']));
    const items = within(screen.getByRole('list', { name: 'Jump back in' })).getAllByRole(
      'listitem',
    );
    expect(items[2]!.className).toContain('col-start-1');
    expect(items[0]!.className).not.toContain('col-start-1');
  });

  it('lets the recent take the top row when nothing is most used', () => {
    renderIt(set([], ['r1', 'r2']));
    const items = within(screen.getByRole('list', { name: 'Jump back in' })).getAllByRole(
      'listitem',
    );
    expect(items[0]!.className).not.toContain('col-start-1');
  });

  it('tracks which half a document was opened from', () => {
    renderIt(set(['m1'], ['r1']));
    fireEvent.click(screen.getByRole('link', { name: 'Doc m1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.MostUsed');
    fireEvent.click(screen.getByRole('link', { name: 'Doc r1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.Recent');
  });

  it('puts See more in the heading row, navigating in the app on a plain click', () => {
    const onSeeMore = renderIt(set(['m1'], []));
    const link = screen.getByRole('link', { name: 'See more' });
    expect(link.getAttribute('href')).toBe('/explorer/recent');
    expect(link.parentElement!.querySelector('h2')!.textContent).toBe('Jump back in');
    fireEvent.click(link);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn.SeeMore');
    fireEvent.click(link, { ctrlKey: true });
    expect(onSeeMore).toHaveBeenCalledTimes(1);
  });

  it('marks a document stored only in this browser', () => {
    renderIt({ mostUsed: [item('l', { localOnly: true })], recent: [] });
    const link = screen.getByRole('link', { name: 'Doc l, Local only' });
    expect(within(link).getByText('Local only')).toBeTruthy();
    expect(screen.getByTestId('thumb-l').dataset.offline).toBe('true');
  });

  it('says what will gather here when there is nothing yet', () => {
    renderIt(set([], []));
    expect(screen.getByText('The documents you use most and last will gather here.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: 'See more' })).toBeTruthy();
  });
});

describe('JumpBackIn, phone', () => {
  beforeEach(() => {
    wide.value = false;
  });

  it('alternates most used and recent, then ends in a See more tile outside the list', () => {
    const onSeeMore = renderIt(set(['m1', 'm2'], ['r1', 'r2', 'r3']));
    const list = screen.getByRole('list', { name: 'Jump back in' });
    expect(names(within(list).getAllByRole('link'))).toEqual([
      'Doc m1',
      'Doc r1',
      'Doc m2',
      'Doc r2',
      'Doc r3',
    ]);
    const seeMore = screen.getAllByRole('link', { name: 'See more' });
    // The tile only: no second See more in the heading row.
    expect(seeMore).toHaveLength(1);
    expect(list.contains(seeMore[0]!)).toBe(false);
    fireEvent.click(seeMore[0]!);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn.SeeMore');
  });

  it('tracks the half a tile came from, wherever it sits', () => {
    renderIt(set(['m1'], ['r1']));
    fireEvent.click(screen.getByRole('link', { name: 'Doc r1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.Recent');
  });

  it('fades the trailing edge only while more lies to the right', () => {
    renderIt(set(['a'], ['b']));
    const scroller = screen.getByRole('list', { name: 'Jump back in' }).parentElement!;
    const fade = scroller.nextElementSibling as HTMLElement;
    Object.defineProperties(scroller, {
      clientWidth: { value: 300, configurable: true },
      scrollWidth: { value: 600, configurable: true },
      scrollLeft: { value: 0, configurable: true, writable: true },
    });
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-100');
    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-0');
  });

  it('keeps its See more tile beside the empty line', () => {
    renderIt(set([], []));
    expect(screen.getByText('The documents you use most and last will gather here.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See more' })).toBeTruthy();
  });
});
