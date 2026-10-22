// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Jump Back In (docs/specs/013-workspace/explorer-home.md "Jump Back In"): on a desktop or tablet the
// Most Used cards then the Recent cards, each group under its label, each card saying why it is
// there, See More in the heading row; on a phone a strip that alternates, labels neither group and
// ends in a See More tile. A local project carries the This Browser pill.

const { track, wide } = vi.hoisted(() => ({ track: vi.fn(), wide: { value: true } }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/ProjectThumbnail', () => ({
  ProjectThumbnail: (p: { projectId: string; offline?: boolean }) => (
    <span data-testid={`thumb-${p.projectId}`} data-offline={String(Boolean(p.offline))} />
  ),
}));
vi.mock('@liveplanner/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveplanner/ui')>()),
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

  it('lists the most used, then the recent, each group a list named by its label', () => {
    renderIt(set(['m1', 'm2', 'm3', 'm4'], ['r1', 'r2', 'r3', 'r4']));
    expect(screen.getAllByRole('list')).toHaveLength(2);
    const used = screen.getByRole('list', { name: 'Most Used' });
    const recent = screen.getByRole('list', { name: 'Recent' });
    expect(names(within(used).getAllByRole('link'))).toEqual([
      'Doc m1',
      'Doc m2',
      'Doc m3',
      'Doc m4',
    ]);
    expect(names(within(recent).getAllByRole('link'))).toEqual([
      'Doc r1',
      'Doc r2',
      'Doc r3',
      'Doc r4',
    ]);
    expect(screen.getByRole('heading', { level: 3, name: 'Most Used' })).toBeTruthy();
    const first = within(used).getAllByRole('link')[0]!;
    expect(first.getAttribute('href')).toBe('/project/m1');
    expect(first.dataset.jumpBackInCard).toBe('large');
    expect(within(recent).getAllByRole('link')[0]!.dataset.jumpBackInCard).toBe('compact');
  });

  it("says why each project is there, as the card's description", () => {
    const now = Date.now();
    renderIt({
      mostUsed: [item('m1', { useDays: 1 }), item('m2', { useDays: 14 })],
      recent: [item('r1', { lastUsedAt: now - 2 * 3_600_000 })],
    });
    const line = (name: string) => {
      const link = screen.getByRole('link', { name });
      return document.getElementById(link.getAttribute('aria-describedby')!)!.textContent;
    };
    expect(line('Doc m1')).toBe('Used on 1 day');
    expect(line('Doc m2')).toBe('Used on 14 days');
    expect(line('Doc r1')).toBe('Used 2 hours ago');
  });

  it('draws neither label nor list for a group with no project', () => {
    renderIt(set([], ['r1', 'r2']));
    expect(screen.queryByText('Most Used')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Most Used' })).toBeNull();
    expect(
      names(within(screen.getByRole('list', { name: 'Recent' })).getAllByRole('link')),
    ).toEqual(['Doc r1', 'Doc r2']);
  });

  it("keeps both groups' height whatever lands in them", () => {
    const { container } = render(
      <JumpBackIn
        ownerId="me"
        set={set(['m1'], [])}
        loading={false}
        recentHref="/r"
        onSeeMore={() => {}}
      />,
    );
    const box = container.querySelector('[data-jump-back-in-group="mostUsed"]')!.parentElement!;
    expect(box.className).toContain('min-h-[38.625rem]');
    expect(box.className).toContain('lg:min-h-[20.625rem]');
  });

  it('tracks which half a project was opened from', () => {
    renderIt(set(['m1'], ['r1']));
    fireEvent.click(screen.getByRole('link', { name: 'Doc m1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.MostUsed');
    fireEvent.click(screen.getByRole('link', { name: 'Doc r1' }));
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'JumpBackIn.Recent');
  });

  it('puts See More in the heading row, navigating in the app on a plain click', () => {
    const onSeeMore = renderIt(set(['m1'], []));
    const link = screen.getByRole('link', { name: 'See More' });
    expect(link.getAttribute('href')).toBe('/explorer/recent');
    expect(link.parentElement!.querySelector('h2')!.textContent).toBe('Jump Back In');
    fireEvent.click(link);
    expect(onSeeMore).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'JumpBackIn.SeeMore');
    fireEvent.click(link, { ctrlKey: true });
    expect(onSeeMore).toHaveBeenCalledTimes(1);
  });

  it('shows no See More while it loads', () => {
    render(
      <JumpBackIn ownerId="me" set={set([], [])} loading recentHref="/r" onSeeMore={() => {}} />,
    );
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
  });

  it('marks a project stored only in this browser', () => {
    renderIt({ mostUsed: [item('l', { localOnly: true })], recent: [] });
    const link = screen.getByRole('link', { name: 'Doc l, This Browser' });
    expect(within(link).getByText('This Browser')).toBeTruthy();
    expect(screen.getByTestId('thumb-l').dataset.offline).toBe('true');
  });

  it('says what will gather here when there is nothing yet', () => {
    renderIt(set([], []));
    expect(screen.getByText('No projects yet')).toBeTruthy();
    expect(screen.getByText('The projects you use most and last will gather here.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    // Nothing to see more of.
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    // In place of one most used card: its size, in the first column, no group labels.
    const slot = screen.getByText('No projects yet').closest('[data-empty-state]')!.parentElement!;
    expect(slot.className).toContain('h-[12.5rem]');
    expect(slot.className).toContain('border-dashed');
    expect(slot.parentElement!.className).toContain('lg:grid-cols-4');
    expect(screen.queryByText('Most Used')).toBeNull();
  });
});

describe('JumpBackIn, phone', () => {
  beforeEach(() => {
    wide.value = false;
  });

  it('alternates most used and recent, then ends in a See More tile outside the list', () => {
    const onSeeMore = renderIt(set(['m1', 'm2'], ['r1', 'r2', 'r3']));
    const list = screen.getByRole('list', { name: 'Jump Back In' });
    expect(names(within(list).getAllByRole('link'))).toEqual([
      'Doc m1',
      'Doc r1',
      'Doc m2',
      'Doc r2',
      'Doc r3',
    ]);
    const seeMore = screen.getAllByRole('link', { name: 'See More' });
    // The tile only: no second See More in the heading row.
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
    const scroller = screen.getByRole('list', { name: 'Jump Back In' }).parentElement!;
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

  it('shows no See More tile beside the empty state', () => {
    renderIt(set([], []));
    expect(screen.getByText('No projects yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
  });
});
