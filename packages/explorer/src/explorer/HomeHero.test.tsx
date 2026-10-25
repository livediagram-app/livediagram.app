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

// My Work's count is asked as `mine` beside Jump Back In's read (data/homeReads.ts), or alone as a page of My Work.
const countCalls = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => {
    const q = c.args[0] as { view?: string; mine?: number };
    return c.method === 'listItems' && (q.mine !== undefined || q.view === 'all');
  });

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
    // No request of its own: My Work's count, up to a page, rides on Jump Back In's read, in this app.
    expect(countCalls(index)).toHaveLength(1);
    expect(countCalls(index)[0]!.args[0]).toMatchObject({
      view: 'recent',
      used: 4,
      mine: LIST_LIMIT_MAX,
      app: 'liveplanner',
    });
    expect(index.count('listItems')).toBe(1);
  });

  it('under All counts files, asks no one app’s question, and New asks which app', async () => {
    const index = createFakeIndex({
      items: [makeItem(1), makeItem(2, { app: 'livediagram', kind: 'canvas' })],
    });
    const { onCreate } = renderHome(index, {
      filter: 'all',
      newApps: ['livediagram', 'liveplanner'],
    });
    expect(await screen.findByRole('link', { name: '2 files' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'what are you working on today?',
    );
    const newButton = screen.getByRole('button', { name: 'New' });
    expect(newButton.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(newButton);
    fireEvent.click(screen.getByRole('menuitem', { name: /New Canvas/ }));
    expect(onCreate).toHaveBeenCalledWith({ folderId: null, teamId: null }, 'livediagram');
  });

  it('counts what this browser keeps beside My Work, its trashed ones not', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    const kept = (n: number, trashedAt: number | null = null) => ({
      id: `local-${n}`,
      title: `Local ${n}`,
      createdAt: n,
      updatedAt: n,
      lastOpenedAt: n,
      trashedAt,
      favourite: false,
    });
    renderHome(index, {
      thisBrowser: {
        items: [kept(1), kept(2), kept(3, 9)],
        itemHref: (item) => `/project/${item.id}`,
        helpHref: '/help/offline/',
      },
    });
    expect(await screen.findByRole('link', { name: '3 plans' })).toBeTruthy();
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

  it('shows what the app makes, each kind starting its template through the host', async () => {
    renderHome(createFakeIndex(), {
      templateHref: (app, template) => `https://${app}.test/new?template=${template}`,
    });
    const set = await screen.findByRole('region', { name: 'What you can make' });
    expect(within(set).getByRole('link', { name: 'New Board' }).getAttribute('href')).toBe(
      'https://liveplanner.test/new?template=kanban',
    );
    expect(set.closest('[data-home-hero]')).toBeTruthy();
  });

  it('shows the same set on a first run', async () => {
    renderHome(createFakeIndex(), {
      welcome: {
        manifest: {
          name: 'liveplanner',
          pillFree: 'Free',
          blanks: [],
          popular: [],
          fan: [],
          startBlankHref: '/new?start=blank',
          allTemplatesHref: '/new',
          searchHref: (q) => `/new?q=${q}`,
        },
        signedIn: false,
      },
    });
    await screen.findByRole('heading', { name: 'Start Blank' });
    const set = screen.getByRole('region', { name: 'What you can make' });
    expect(
      [...set.querySelectorAll('[data-work-kind]')].map((t) => t.getAttribute('data-work-kind')),
    ).toEqual(['board', 'sheet', 'dashboard', 'form']);
  });

  it.each([
    ['liveplanner', 'dots'],
    ['livediagram', 'blueprint'],
    ['livedocuments', 'typesetter'],
    ['livedesign', 'shapes'],
  ] as const)('draws %s’s own backdrop behind the band', async (app, backdrop) => {
    renderHome(createFakeIndex(), { app, filter: 'app' });
    const heading = await screen.findByRole('heading', { level: 1 });
    const layer = document.querySelector('[data-home-hero] [data-hero-backdrop]');
    expect(layer?.getAttribute('data-hero-backdrop')).toBe(backdrop);
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // Only the Typesetter sets the heading in serif.
    expect(heading.className.includes('font-serif')).toBe(backdrop === 'typesetter');
  });

  it('keeps the dots under All, whichever app hosts it', async () => {
    renderHome(createFakeIndex(), { app: 'livedocuments', filter: 'all' });
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.querySelector('[data-hero-backdrop]')?.getAttribute('data-hero-backdrop')).toBe(
      'dots',
    );
    expect(heading.className).not.toContain('font-serif');
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
