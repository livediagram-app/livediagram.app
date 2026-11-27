// Home leaves out every section with nothing in it, heading and all, and with every one empty shows one empty state
// for the whole view with New (liveworkspace/docs/specs/004-index/one-explorer.md "Nothing on Home"). It waits for
// every read, so loading shows placeholders, and a section that gains an item takes the empty state's place at once.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ThisBrowserItem } from '../this-browser';
import { Explorer } from './Explorer';
import { homeLayout } from './HomePane';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const section = (id: string) => document.querySelector(`[data-home-section="${id}"]`);
const nothing = () => document.querySelector('[data-home-nothing]');
const SECTIONS = ['new', 'most-used', 'recent', 'spaces', 'shared-recently'];

function renderHome(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<Parameters<typeof Explorer>[0]> = {},
) {
  const onCreate = vi.fn();
  const props = {
    app: 'liveplanner' as const,
    client: index.client,
    view: { kind: 'home' } as const,
    onNavigate: vi.fn(),
    itemHref: (i: { id: string }) => `/p/${i.id}`,
    onCreate,
    heroHidden: true,
    ...over,
  };
  const view = render(<Explorer {...props} />);
  return { ...view, onCreate, props };
}

// The timeline's first row of what was made (New's), and of what was opened (Recent's).
const madeRow = () => document.querySelector<HTMLElement>('[data-timeline-event="made"]');
const openedRow = () => document.querySelector<HTMLElement>('[data-timeline-event="opened"]');

const phone = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

describe('Home with nothing in it', () => {
  it('draws no section, only one empty state with New, which makes one in My Work', async () => {
    const { onCreate } = renderHome(createFakeIndex({ items: [] }));
    await screen.findByRole('heading', { name: 'No plans yet' });
    for (const id of SECTIONS) expect(section(id)).toBeNull();
    expect(screen.getAllByRole('heading', { name: /yet$/ })).toHaveLength(1);
    fireEvent.click(within(nothing() as HTMLElement).getByRole('button', { name: 'New Plan' }));
    expect(onCreate).toHaveBeenCalledWith({ folderId: null, teamId: null });
  });

  it('the same on a phone', async () => {
    phone();
    renderHome(createFakeIndex({ items: [] }));
    await screen.findByRole('heading', { name: 'No plans yet' });
    for (const id of SECTIONS) expect(section(id)).toBeNull();
  });

  it('shows placeholders while any read is out, never the empty state', async () => {
    const index = createFakeIndex({ items: [] });
    index.hold.add('spacePreviews');
    renderHome(index);
    // Home's items read answers; Spaces' is still out, so its placeholders stand and nothing says "No plans yet".
    await waitFor(() => expect(index.count('listItems')).toBe(1));
    expect(document.querySelector('[data-home-spaces-skeleton]')).not.toBeNull();
    expect(nothing()).toBeNull();
    index.hold.delete('spacePreviews');
    index.release();
    await waitFor(() => expect(nothing()).not.toBeNull());
    expect(section('spaces')).toBeNull();
  });

  it('waits for the items read too', async () => {
    const index = createFakeIndex({ items: [] });
    index.hold.add('listItems');
    renderHome(index);
    expect(section('recent')!.getAttribute('aria-busy')).toBe('true');
    expect(nothing()).toBeNull();
    index.hold.delete('listItems');
    index.release();
    await waitFor(() => expect(nothing()).not.toBeNull());
  });

  it('gives way to a section the moment it gains an item, with no reload', async () => {
    const { rerender, props } = renderHome(createFakeIndex({ items: [] }));
    await waitFor(() => expect(nothing()).not.toBeNull());
    const local: ThisBrowserItem = {
      id: 'local-1',
      title: 'Kept here',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: null,
      trashedAt: null,
    };
    rerender(
      <Explorer
        {...props}
        thisBrowser={{ items: [local], itemHref: (i) => `/p/${i.id}`, helpHref: '/help/' }}
      />,
    );
    await waitFor(() => expect(madeRow()).not.toBeNull());
    expect(nothing()).toBeNull();
    // Offline holds it, so Spaces shows (its row); nothing opened, so the timeline holds only what was made.
    expect(section('spaces')).not.toBeNull();
    expect(openedRow()).toBeNull();
  });
});

describe('Home leaves out an empty section', () => {
  it('shows what was made and nothing opened for things made but never opened', async () => {
    renderHome(createFakeIndex({ items: [makeItem(1), makeItem(2)] }));
    await waitFor(() => expect(madeRow()).not.toBeNull());
    await waitFor(() => expect(section('spaces')).not.toBeNull());
    expect(openedRow()).toBeNull();
    expect(section('most-used')).toBeNull();
    expect(section('shared-recently')).toBeNull();
    expect(nothing()).toBeNull();
    expect(screen.queryByText(/gather here/)).toBeNull();
  });

  it('shows an item once, as made, when New holds the one opened item', async () => {
    renderHome(createFakeIndex({ items: [makeItem(1, { lastOpenedAt: 5_000_000 })] }));
    await waitFor(() => expect(madeRow()).not.toBeNull());
    expect(openedRow()).toBeNull();
  });

  it('shows Recent for an opened item New does not hold', async () => {
    const made = Array.from({ length: 5 }, (_, k) =>
      makeItem(k + 1, { createdAt: 9_000_000 - k, lastOpenedAt: k === 4 ? 5_000_000 : null }),
    );
    renderHome(createFakeIndex({ items: made }));
    await waitFor(() => expect(section('recent')).not.toBeNull());
    expect(openedRow()!.querySelector('a[href="/p/item-5"]')).not.toBeNull();
  });

  it('leaves out Spaces while no space holds anything, keeping what was shared', async () => {
    const shared = makeItem(1, {
      ownerId: 'user_other',
      sharedVia: 'code1',
      access: 'view',
      lastOpenedAt: 5_000_000,
    });
    renderHome(createFakeIndex({ items: [shared] }));
    await waitFor(() => expect(section('recent')).not.toBeNull());
    await waitFor(() => expect(section('shared-recently')).not.toBeNull());
    expect(section('spaces')).toBeNull();
    expect(madeRow()).toBeNull();
    expect(nothing()).toBeNull();
  });

  // Work Tracker 1523: with nothing in the timeline its column is not kept empty (one-explorer.md "Home's layout").
  const layout = () =>
    document.querySelector('[data-home-layout]')?.getAttribute('data-home-layout');
  const sharedUsed = makeItem(1, {
    ownerId: 'user_other',
    sharedVia: 'code1',
    access: 'view',
    lastOpenedAt: 5_000_000,
    useDays: 3,
    useOpens: 5,
  });

  it('lays Most Used and Shared With You Recently side by side, half and half, with no timeline', async () => {
    renderHome(createFakeIndex({ items: [sharedUsed] }));
    await waitFor(() => expect(section('shared-recently')).not.toBeNull());
    await waitFor(() => expect(section('most-used')).not.toBeNull());
    expect(section('recent')).toBeNull();
    expect(layout()).toBe('split');
  });

  it('keeps the timeline and the rail when the timeline has rows', async () => {
    renderHome(createFakeIndex({ items: [sharedUsed, makeItem(2)] }));
    await waitFor(() => expect(madeRow()).not.toBeNull());
    await waitFor(() => expect(section('most-used')).not.toBeNull());
    expect(layout()).toBe('rail');
  });
});

describe('homeLayout', () => {
  it.each([
    [{ timeline: true, mostUsed: true, rest: true }, 'rail'],
    [{ timeline: true, mostUsed: false, rest: true }, 'rail'],
    [{ timeline: true, mostUsed: true, rest: false }, 'rail'],
    [{ timeline: true, mostUsed: false, rest: false }, 'single'],
    [{ timeline: false, mostUsed: true, rest: true }, 'split'],
    [{ timeline: false, mostUsed: true, rest: false }, 'single'],
    [{ timeline: false, mostUsed: false, rest: true }, 'single'],
  ] as const)('%o is %s', (shown, expected) => {
    expect(homeLayout(shown)).toBe(expected);
  });
});

describe('Home after a trash', () => {
  it('counts a card trashed here out of its space, asking Spaces again once the index takes it', async () => {
    const index = createFakeIndex({ items: [makeItem(1), makeItem(2)] });
    renderHome(index);
    const mine = () => document.querySelector('[data-space-tile="mine"]');
    await waitFor(() => expect(mine()?.textContent).toContain('2 plans'));
    const asked = index.count('spacePreviews');
    const newSection = section('recent') as HTMLElement;
    fireEvent.click(within(newSection).getByRole('button', { name: 'Menu for Item 1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Move to Trash|Delete/ }));
    await waitFor(() => expect(mine()?.textContent).toContain('1 plan'));
    expect(mine()?.textContent).not.toContain('2 plans');
    expect(index.count('spacePreviews')).toBe(asked + 1);
  });
});
