import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError, LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ExplorerView } from '../views';
import { heroGreeting, kindWords } from '../words';
import { Explorer, type ExplorerProps } from './Explorer';
import { heroPills } from './HomeHero';

// Home's hero (ported from liveplanner's HomeHero tests): the greeting is the page's heading, the pills count
// what the Explorer reads and open their views, New sits inside the large field, the host's art and words
// show, and the close hides the banner (the host's setting, or this browser's).

function renderHome(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<ExplorerProps> = {},
  view: ExplorerView = { kind: 'home' },
) {
  const onNavigate = vi.fn();
  const onCreate = vi.fn();
  const utils = render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={view}
      onNavigate={onNavigate}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={onCreate}
      viewerId="user_me"
      {...over}
    />,
  );
  return { ...utils, onNavigate, onCreate };
}

const countCalls = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter(
    (c) => c.method === 'listItems' && (c.args[0] as { view?: string }).view === 'all',
  );

describe('heroGreeting', () => {
  it('says good morning from 5 to 11, good afternoon from 12 to 17, good evening otherwise', () => {
    expect(heroGreeting(4)).toBe('Good evening,');
    expect(heroGreeting(5)).toBe('Good morning,');
    expect(heroGreeting(11)).toBe('Good morning,');
    expect(heroGreeting(12)).toBe('Good afternoon,');
    expect(heroGreeting(17)).toBe('Good afternoon,');
    expect(heroGreeting(18)).toBe('Good evening,');
    expect(heroGreeting(0)).toBe('Good evening,');
  });
});

describe('heroPills', () => {
  const plan = kindWords('liveplanner');
  it('counts My Work in the app’s words and says how the Inbox stands', () => {
    expect(heroPills({ items: { count: 1, more: false }, inbox: 0 }, plan)).toMatchObject([
      { id: 'items', label: '1 plan', tone: 'emerald', view: { kind: 'all' } },
      { id: 'inbox', label: 'Inbox is clear', tone: 'sky', view: { kind: 'inbox' } },
    ]);
    expect(
      heroPills({ items: { count: 9, more: false }, inbox: 3 }, plan).map((p) => p.label),
    ).toEqual(['9 plans', '3 open in your Inbox']);
    expect(heroPills({ items: { count: 0, more: false }, inbox: 1 }, plan)[0]!.label).toBe(
      '0 plans',
    );
  });

  it('says a full page is more, rather than paging on to count', () => {
    expect(heroPills({ items: { count: 200, more: true }, inbox: undefined }, plan)[0]!.label).toBe(
      '200+ plans',
    );
  });

  it('draws a pill only once its count is known', () => {
    expect(heroPills({ items: undefined, inbox: undefined }, plan)).toEqual([]);
    expect(heroPills({ items: undefined, inbox: 0 }, plan).map((p) => p.id)).toEqual(['inbox']);
  });
});

describe('Home’s hero', () => {
  it('greets the reader in a level-one heading that names the band', async () => {
    renderHome(createFakeIndex());
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: /^Good (morning|afternoon|evening), what are you planning today\?$/,
    });
    expect(screen.getByRole('region', { name: heading.textContent! })).toBeTruthy();
    expect(
      screen.getByText(
        'Jump back into what you use most, or see what changed while you were away.',
      ),
    ).toBeTruthy();
  });

  it('takes the host’s own words', async () => {
    renderHome(createFakeIndex(), {
      heroWords: { question: 'what shall we map?', lead: 'Your maps, close at hand.' },
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /what shall we map\?$/ }),
    ).toBeTruthy();
    expect(screen.getByText('Your maps, close at hand.')).toBeTruthy();
  });

  it('counts My Work and the Inbox in pills that open their views', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2), makeItem(3, { teamId: 'team-1' })],
    });
    index.inbox.threads.push({
      app: 'liveplanner',
      itemId: 'item-1',
      itemTitle: 'Item 1',
      tabId: 't',
      threadId: 'th1',
      elementId: null,
      elementLabel: null,
      excerpt: 'Hi',
      resolved: false,
      teamId: null,
      updatedAt: 1,
      lastAuthorId: 'user_you',
    } as never);
    const { onNavigate } = renderHome(index);
    // Team items are not My Work's.
    const mine = await screen.findByRole('link', { name: '2 plans' });
    expect(mine.getAttribute('href')).toBe('/explorer/all');
    fireEvent.click(mine);
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'all' }, '/explorer/all');
    fireEvent.click(screen.getByRole('link', { name: '1 open in your Inbox' }));
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'inbox' }, '/explorer/inbox');
    // One count request, at most a page, for My Work in this app.
    expect(countCalls(index)).toHaveLength(1);
    expect(countCalls(index)[0]!.args[0]).toEqual({
      view: 'all',
      team: 'personal',
      limit: LIST_LIMIT_MAX,
      app: 'liveplanner',
    });
  });

  it('draws no pill while its count is unknown, and none for a count that failed', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    index.hold.add('listItems');
    index.hold.add('inbox');
    renderHome(index);
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelectorAll('[data-hero-pill]')).toHaveLength(0);
    index.fail.set('listItems', new IndexError(500, 'unknown'));
    act(() => index.release());
    await waitFor(() => expect(document.querySelector('[data-hero-pill="inbox"]')).toBeTruthy());
    expect(document.querySelector('[data-hero-pill="items"]')).toBeNull();
  });

  it('puts New inside the large search field', async () => {
    const { onCreate } = renderHome(createFakeIndex());
    const field = await screen.findByRole('combobox', { name: 'Filter plans' });
    expect(field.dataset.searchField).toBe('hero');
    const box = field.parentElement!;
    fireEvent.click(within(box).getByRole('button', { name: 'New Plan' }));
    expect(onCreate).toHaveBeenCalledWith({ folderId: null, teamId: null });
  });

  it('draws the host’s art on its right', async () => {
    renderHome(createFakeIndex(), { heroArt: <div role="img" aria-label="Previews" /> });
    expect(await screen.findByRole('img', { name: 'Previews' })).toBeTruthy();
  });

  it('pairs Help with a close wherever it draws them, and the close hides the banner', async () => {
    const onHideHero = vi.fn();
    const index = createFakeIndex();
    renderHome(index, { helpHref: (v) => `/help/${v.kind}`, onHideHero });
    const closes = await screen.findAllByRole('button', { name: 'Hide Home Banner' });
    const helps = screen.getAllByRole('link', { name: 'Help' });
    expect(closes).toHaveLength(helps.length);
    expect(helps[0]!.getAttribute('href')).toBe('/help/home');
    fireEvent.click(closes[0]!);
    expect(onHideHero).toHaveBeenCalledTimes(1);
    // Uncontrolled, this browser remembers it, and Home takes its ordinary header and the bar's field.
    await waitFor(() => expect(document.querySelector('[data-home-hero]')).toBeNull());
    expect(localStorage.getItem('liveworkspace:explorer-hero-hidden:liveplanner')).toBe('1');
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Filter plans' }).dataset.searchField).toBe('bar');
  });

  it('stays away, and asks for no count, when the host says it is hidden', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderHome(index, { heroHidden: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeTruthy();
    expect(document.querySelector('[data-home-hero]')).toBeNull();
    expect(countCalls(index)).toHaveLength(0);
  });

  it('is only on Home, and other views ask for no count', async () => {
    const index = createFakeIndex();
    renderHome(index, {}, { kind: 'recent' });
    await screen.findByRole('heading', { level: 1, name: 'Recent' });
    expect(document.querySelector('[data-home-hero]')).toBeNull();
    expect(countCalls(index)).toHaveLength(0);
  });
});
