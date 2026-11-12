// Home's Most Used (the items opened most often in the last 14 days, "Opened N times") and Recent directly after it
// (the latest opened of the rest), each a section headed as New is, up to eight each, four across on a desktop, from
// one request; on a phone each is its own strip of at most eight under its own heading. A section with nothing in it
// is left out (liveworkspace/docs/specs/004-index/one-explorer.md "Most Used and Recent, on Home").
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import { isMostUsed, jumpBackInLine, jumpBackInSet } from '../data/viewLists';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from './Explorer';

const opened = (i: number, extra = {}) => makeItem(i, { lastOpenedAt: 5_000_000 - i, ...extra });

describe('jumpBackInSet', () => {
  it('takes eight most used, then eight recent not among them, padding nothing', () => {
    const used = Array.from({ length: 10 }, (_, k) => ({ id: `u${k}`, useOpens: 20 - k }));
    const recent = Array.from({ length: 12 }, (_, k) => ({ id: k === 0 ? 'u1' : `r${k}` }));
    const ids = jumpBackInSet(used, recent).map((i) => i.id);
    expect(ids.slice(0, 8)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    expect(ids.slice(8)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']);
    expect(jumpBackInSet([], recent.slice(0, 2)).map((i) => i.id)).toEqual(['u1', 'r1']);
    // A most used item needs an open in the window; an older index's days count the same.
    expect(jumpBackInSet([{ id: 'x', useOpens: 0 }], [])).toEqual([]);
    expect(jumpBackInSet([{ id: 'y', useDays: 2 }], []).map((i) => i.id)).toEqual(['y']);
  });

  it('says why each card is there', () => {
    const now = 10 * 3_600_000;
    expect(jumpBackInLine({ useOpens: 1, useDays: 1, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Opened once',
    );
    expect(jumpBackInLine({ useOpens: 12, useDays: 2, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Opened 12 times',
    );
    // An index that sends only days.
    expect(jumpBackInLine({ useDays: 1, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Used on 1 day',
    );
    expect(jumpBackInLine({ useDays: 6, lastOpenedAt: 1, updatedAt: 1 }, now)).toBe(
      'Used on 6 days',
    );
    expect(jumpBackInLine({ lastOpenedAt: now - 2 * 3_600_000, updatedAt: 1 }, now)).toMatch(
      /^Opened 2 hours ago$/,
    );
  });

  it('tells a most used item by its opens or its days', () => {
    const items = [{ ...opened(1), useDays: 3 }, { ...opened(2), useDays: 2 }, opened(3)];
    expect(items.filter(isMostUsed)).toHaveLength(2);
    expect([{ useOpens: 3 }, {}].filter(isMostUsed)).toHaveLength(1);
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Twenty items opened, newest first, the first ten most used (the first the most). */
const twenty = () =>
  Array.from({ length: 20 }, (_, k) =>
    opened(k + 1, k < 10 ? { useOpens: 30 - k, useDays: 1 } : {}),
  );

const renderHome = (index: ReturnType<typeof createFakeIndex>, onNavigate = vi.fn()) =>
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={onNavigate}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
    />,
  );

const section = (id: string) => document.querySelector<HTMLElement>(`[data-home-section="${id}"]`);
// A section's cards, by name (See More left out).
const cards = (el: HTMLElement) =>
  within(el)
    .getAllByRole('link')
    .map((a) => a.getAttribute('aria-label') ?? a.textContent)
    .filter((name) => name !== 'See More');
const phone = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

describe('Home', () => {
  it('draws Most Used then Recent as two sections of their own, from one Recent request that carries Most Used', async () => {
    const items = [
      opened(1, { useOpens: 2, useDays: 2 }),
      opened(2, { useOpens: 9, useDays: 1 }),
      opened(3),
      opened(4),
      makeItem(5),
    ];
    const index = createFakeIndex({ items });
    renderHome(index);
    await screen.findByRole('heading', { level: 2, name: 'Most Used' });
    const used = screen.getByRole('region', { name: 'Most Used' });
    expect(cards(used)).toEqual(['Item 2', 'Item 1']);
    expect(used.textContent).toContain('Opened 9 times');
    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(within(recent).getByRole('heading', { level: 2, name: 'Recent' })).toBeTruthy();
    expect(cards(recent)).toEqual(['Item 3', 'Item 4']);
    // Recent directly after Most Used, each one of Home's sections, with no title over the pair.
    const order = [...document.querySelectorAll('[data-home-section]')].map((s) =>
      s.getAttribute('data-home-section'),
    );
    expect(order.indexOf('recent')).toBe(order.indexOf('most-used') + 1);
    expect(screen.queryByText('Jump Back In')).toBeNull();
    expect(used.querySelector('h3')).toBeNull();
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      used: 8,
      limit: 16,
    });
  });

  it('puts See More on Recent’s heading, into the Recent view, and none on Most Used', async () => {
    const onNavigate = vi.fn();
    renderHome(createFakeIndex({ items: twenty() }), onNavigate);
    await screen.findByRole('heading', { name: 'Most Used' });
    const more = within(screen.getByRole('region', { name: 'Recent' })).getByRole('link', {
      name: 'See More',
    });
    expect(more.parentElement!.querySelector('h2')!.textContent).toBe('Recent');
    expect(
      within(screen.getByRole('region', { name: 'Most Used' })).queryByRole('link', {
        name: 'See More',
      }),
    ).toBeNull();
    fireEvent.click(more);
    expect(onNavigate.mock.calls[0]![0]).toMatchObject({ kind: 'recent' });
  });

  it('draws up to eight in each section, four across on a desktop', async () => {
    renderHome(createFakeIndex({ items: twenty() }));
    await screen.findByRole('heading', { name: 'Most Used' });
    const used = screen.getByRole('region', { name: 'Most Used' });
    expect(cards(used)).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 1}`));
    // The ninth and tenth most used are among the latest opened of the rest.
    expect(cards(screen.getByRole('region', { name: 'Recent' }))).toEqual(
      Array.from({ length: 8 }, (_, k) => `Item ${k + 9}`),
    );
    expect(used.querySelector('ul')!.className).toContain('lg:grid-cols-4');
  });

  it('leaves out Recent, heading, See More and all, when Most Used holds everything opened', async () => {
    renderHome(
      createFakeIndex({ items: [opened(1, { useOpens: 3 }), opened(2, { useOpens: 2 })] }),
    );
    await screen.findByRole('heading', { name: 'Most Used' });
    expect(section('recent')).toBeNull();
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
  });

  it('leaves out Most Used while nothing is most used', async () => {
    renderHome(createFakeIndex({ items: [opened(1), opened(2)] }));
    await screen.findByRole('heading', { name: 'Recent' });
    expect(section('most-used')).toBeNull();
    expect(cards(section('recent')!)).toEqual(['Item 1', 'Item 2']);
  });

  it('gives each section its own strip on a phone, under its own heading, Recent’s ending on See More', async () => {
    phone();
    renderHome(createFakeIndex({ items: twenty() }));
    await screen.findByRole('link', { name: 'Item 1' });
    const tiles = (id: string) =>
      [...section(id)!.querySelectorAll('li a')].map((a) => a.getAttribute('aria-label'));
    expect(tiles('most-used')).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 1}`));
    expect(tiles('recent')).toEqual(Array.from({ length: 8 }, (_, k) => `Item ${k + 9}`));
    expect(screen.getByRole('heading', { name: 'Most Used' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeTruthy();
    // See More is the last tile of Recent's strip, not a link beside its heading.
    const more = screen.getByRole('link', { name: /See More/ });
    expect(section('recent')!.contains(more)).toBe(true);
    expect(more.closest('ul')).toBeNull();
    expect(more.parentElement!.querySelector('h2')).toBeNull();
    expect(section('most-used')!.textContent).not.toContain('See More');
  });

  it('draws each section’s placeholders under its own heading while it loads', async () => {
    const index = createFakeIndex({ items: twenty() });
    index.hold.add('listItems');
    renderHome(index);
    await waitFor(() => expect(section('most-used')).not.toBeNull());
    for (const id of ['most-used', 'recent']) {
      const el = section(id)!;
      expect(el.getAttribute('aria-busy')).toBe('true');
      expect(el.querySelector('h2')).not.toBeNull();
      expect(el.querySelectorAll('[aria-hidden] > div')).toHaveLength(8);
    }
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    index.hold.delete('listItems');
    index.release();
    await screen.findByRole('link', { name: 'Item 1' });
    expect(section('most-used')!.getAttribute('aria-busy')).toBe('false');
  });

  it('says once that Home could not load, under Recent, with Try again', async () => {
    const index = createFakeIndex({ items: twenty() });
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    renderHome(index);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load Home.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(section('recent')!.contains(alert)).toBe(true);
    expect(section('most-used')).toBeNull();
    expect(screen.queryByRole('link', { name: 'See More' })).toBeNull();
    index.fail.delete('listItems');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Most Used' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("says it has nothing with the Explorer's one empty state, under Recent, not a box of its own", async () => {
    const index = createFakeIndex({ items: [] });
    const { container } = render(
      <Explorer
        app="livedesign"
        client={index.client}
        view={{ kind: 'home' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        heroHidden
      />,
    );
    const title = await screen.findByRole('heading', { name: 'No designs yet' });
    expect(title.closest('[data-empty-state="compact"]')).not.toBeNull();
    expect(section('recent')!.contains(title)).toBe(true);
    expect(section('most-used')).toBeNull();
    expect(screen.getByText('The designs you open will gather here.')).toBeTruthy();
    expect(container.querySelector('.border-dashed')).toBeNull();
  });
});
