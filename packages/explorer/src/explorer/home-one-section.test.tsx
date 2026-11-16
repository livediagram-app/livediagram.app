// Each item shows once on Home (liveworkspace/docs/specs/004-index/one-explorer.md "Each item shows once"): in the
// first of New, Most Used and Recent it qualifies for. Most Used leaves out New's, Recent leaves out both, and each
// still fills to eight from the next in its order; This Browser's items, an All Apps Home and a phone's strips alike.
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { ThisBrowserItem } from '../this-browser';
import { Explorer } from './Explorer';
import { homeSections } from './home-sections';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const ids = (list: readonly { id: string }[]) => list.map((i) => i.id);

describe('homeSections', () => {
  const used = (id: string, opens: number, openedAt: number) => ({
    id,
    useOpens: opens,
    lastOpenedAt: openedAt,
  });
  const recent = (id: string, openedAt: number | null) => ({ id, lastOpenedAt: openedAt });

  it('shows an item that is new, most used and recent only in New', () => {
    const { mostUsed, recent: rest } = homeSections(
      [used('a', 9, 50), used('b', 5, 40), recent('c', 30)],
      [{ id: 'a' }],
      [],
      8,
    );
    expect(ids(mostUsed)).toEqual(['b']);
    expect(ids(rest)).toEqual(['c']);
  });

  it('shows one most used and recent only in Most Used', () => {
    // The index's set: the most used, then the recent not among them (b is both, so it is only in the first part).
    const { mostUsed, recent: rest } = homeSections([used('b', 5, 40), recent('c', 30)], [], [], 8);
    expect(ids(mostUsed)).toEqual(['b']);
    expect(ids(rest)).toEqual(['c']);
  });

  it('fills Most Used to eight from the next most used, and Recent from the next most recent', () => {
    const opened = [
      ...Array.from({ length: 12 }, (_, k) => used(`u${k}`, 30 - k, 1_000 - k)),
      ...Array.from({ length: 8 }, (_, k) => recent(`r${k}`, 500 - k)),
    ];
    const { mostUsed, recent: rest } = homeSections(opened, [{ id: 'u0' }, { id: 'u3' }], [], 8);
    expect(ids(mostUsed)).toEqual(['u1', 'u2', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9']);
    // The two most used past the eight join Recent by their last open, saying when, not how often.
    expect(ids(rest)).toEqual(['u10', 'u11', 'r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
    expect(rest[0]).toMatchObject({ useOpens: undefined, useDays: undefined });
  });

  it('puts a spilled most used item only edited, never opened, after the opened ones', () => {
    const { mostUsed, recent: rest } = homeSections(
      [used('u0', 9, 50), { id: 'u1', useDays: 2, lastOpenedAt: null }, recent('r0', null)],
      [],
      [],
      1,
    );
    expect(ids(mostUsed)).toEqual(['u0']);
    expect(ids(rest)).toEqual(['r0']);
    expect(
      ids(
        homeSections([used('u0', 9, 50), used('u1', 2, 40), recent('r0', null)], [], [], 1).recent,
      ),
    ).toEqual(['u1']);
  });

  it('keeps the index’s order for Recent when no most used one spills into it', () => {
    const { recent: rest } = homeSections([recent('x', null), recent('y', 10)], [], [], 8);
    expect(ids(rest)).toEqual(['x', 'y']);
  });

  it('leaves This Browser’s items that New shows out of Recent, and merges the rest by last open', () => {
    const local = (id: string, openedAt: number): ThisBrowserItem => ({
      id,
      title: id,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: openedAt,
      trashedAt: null,
      favourite: false,
    });
    const { recent: rest } = homeSections(
      [recent('c', 30)],
      [{ id: 'local-new' }],
      [local('local-new', 90), local('local-old', 20)],
      8,
    );
    expect(ids(rest)).toEqual(['c', 'local-old']);
  });
});

const HOUR = 3_600_000;

/**
 * Twenty-four of the person's items, opened newest first: the first twelve most used (the first the most), the rest
 * only recent. The first four (most used, and the most recently opened) are also the four made last, so New has them.
 */
function seeded(over: (k: number) => Partial<Item> = () => ({})): Item[] {
  return Array.from({ length: 24 }, (_, k) =>
    makeItem(k + 1, {
      lastOpenedAt: Date.now() - (k + 1) * HOUR,
      createdAt: k < 4 ? Date.now() - (k + 1) * 60_000 : 1_000_000 + k,
      ...(k < 12 ? { useOpens: 40 - k, useDays: 1 } : {}),
      ...over(k),
    }),
  );
}

function renderHome(
  index: ReturnType<typeof createFakeIndex>,
  over: Partial<Parameters<typeof Explorer>[0]> = {},
) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      {...over}
    />,
  );
}

// A section's items, by the links its cards (or a phone's tiles) open, each once.
const sectionIds = (id: string) => [
  ...new Set(
    [...document.querySelectorAll(`[data-home-section="${id}"] a[href^="/p/"]`)].map((a) =>
      a.getAttribute('href')!.slice('/p/'.length),
    ),
  ),
];

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => `item-${from + k}`);

async function expectOnce() {
  await waitFor(() => expect(sectionIds('new')).toHaveLength(4));
  await waitFor(() => expect(sectionIds('recent')).toHaveLength(8));
  // New has the four made last (all most used and recent); Most Used the next eight most used; Recent the next eight
  // most recent: no item twice, every section full.
  expect(sectionIds('new')).toEqual(range(1, 4));
  expect(sectionIds('most-used')).toEqual(range(5, 12));
  expect(sectionIds('recent')).toEqual(range(13, 20));
}

describe('Home shows each item once', () => {
  it('in New, then Most Used, then Recent, each still full, from one read of enough rows', async () => {
    const index = createFakeIndex({ items: seeded() });
    renderHome(index);
    await expectOnce();
    expect(index.count('listItems')).toBe(1);
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).toMatchObject({
      view: 'recent',
      used: 12,
      limit: 20,
      newest: 4,
      app: 'liveplanner',
    });
  });

  it('the same under All Apps, across every app’s items', async () => {
    const index = createFakeIndex({
      items: seeded((k) => (k % 2 ? { app: 'livediagram', kind: 'canvas' } : {})),
    });
    renderHome(index, { filter: 'all' });
    await expectOnce();
    expect(index.calls.find((c) => c.method === 'listItems')!.args[0]).not.toHaveProperty('app');
  });

  it('the same in a phone’s strips', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    renderHome(createFakeIndex({ items: seeded() }));
    await expectOnce();
  });

  it('leaves a This Browser item New shows out of Recent', async () => {
    const local: ThisBrowserItem = {
      id: 'local-1',
      title: 'Local 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      trashedAt: null,
      favourite: false,
    };
    renderHome(createFakeIndex({ items: seeded() }), {
      thisBrowser: { items: [local], itemHref: (i) => `/p/${i.id}`, helpHref: '/help/' },
    });
    await waitFor(() => expect(sectionIds('new')).toContain('local-1'));
    await waitFor(() => expect(sectionIds('recent')).toHaveLength(8));
    expect(sectionIds('recent')).not.toContain('local-1');
    // New's four: this browser's, then the three the index made last; the fourth goes on to Most Used.
    expect(sectionIds('new')).toEqual(['local-1', ...range(1, 3)]);
    expect(sectionIds('most-used')).toEqual(range(4, 11));
    expect(sectionIds('recent')).toEqual(range(12, 19));
  });
});
