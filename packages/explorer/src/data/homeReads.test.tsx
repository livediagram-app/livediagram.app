// Home's requests, counted: opening Home asks the index each distinct list once. Jump Back In, the hero's My Work
// count and the first-run question are one items request; Shared With You Recently and the sidebar's Shared With Me
// count are one page of Shared. The folding itself (homeReads.ts): one request per tick and scope, every asker
// answered, cancelled only once every asker lets go, and the old reads when the index answers no fold.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIST_LIMIT_MAX, type IndexClient } from '@liveworkspace/index-client';
import { Explorer } from '../explorer/Explorer';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import type { WelcomeManifest } from '../welcome/types';
import { readAnyItem, readMineCount, readRecentForHome, readSharedFirstPage } from './homeReads';

const MANIFEST: WelcomeManifest = {
  name: 'liveplanner',
  pillFree: 'Free',
  blanks: [],
  popular: [],
  fan: [],
  startBlankHref: '/new',
  allTemplatesHref: '/new',
  searchHref: (q) => `/new?q=${q}`,
};

function seeded() {
  const shared = Array.from({ length: 6 }, (_, i) =>
    makeItem(100 + i, { ownerId: 'user_you', sharedVia: `code${i}`, access: 'view' }),
  );
  return createFakeIndex({
    items: [
      makeItem(1, { lastOpenedAt: 5 }),
      makeItem(2, { lastOpenedAt: 4 }),
      makeItem(3, { teamId: 'team-1' }),
      ...shared,
    ],
  });
}

describe('Home’s requests', () => {
  it('ask each distinct list once: one items read and one Shared page', async () => {
    const index = seeded();
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'home' }}
        onNavigate={vi.fn()}
        itemHref={(item) => `/open/${item.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
        welcome={{ manifest: MANIFEST, signedIn: true }}
      />,
    );
    expect(await screen.findByRole('link', { name: '2 plans' })).toBeTruthy();
    await screen.findByRole('heading', { name: 'Shared With You Recently' });
    await waitFor(() => expect(index.count('timeline')).toBe(1));

    const counts: Record<string, number> = {};
    for (const c of index.calls) counts[c.method] = (counts[c.method] ?? 0) + 1;
    expect(counts).toEqual({
      listItems: 1,
      listShared: 1,
      listFolders: 1,
      listPlacementDefaults: 1,
      timeline: 1,
      inbox: 1,
    });
    const items = index.calls.find((c) => c.method === 'listItems')!.args[0];
    expect(items).toEqual({
      view: 'recent',
      limit: 8,
      used: 4,
      mine: LIST_LIMIT_MAX,
      any: true,
      app: 'liveplanner',
    });
    // The sidebar's count page (100), of which Home shows its four.
    expect(index.calls.find((c) => c.method === 'listShared')!.args[0]).toEqual({
      limit: 100,
      app: 'liveplanner',
    });
    const section = screen
      .getByRole('heading', { name: 'Shared With You Recently' })
      .closest('section')!;
    expect(section.querySelectorAll('[data-item-id]').length).toBeLessThanOrEqual(4);
  });
});

describe('the folding', () => {
  it('answers every asker of one tick from one request, each its own part', async () => {
    const index = seeded();
    const [recent, mine, any] = await Promise.all([
      readRecentForHome(index.client, 'liveplanner', 'app', { limit: 8, used: 4 }),
      readMineCount(index.client, 'liveplanner', 'app', 200),
      readAnyItem(index.client, 'liveplanner', 'app'),
    ]);
    expect(index.count('listItems')).toBe(1);
    expect(recent.items.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    expect(mine).toEqual({ count: 2, more: false });
    expect(any).toBe(true);
    // Another tick, another request; another scope, another request.
    await readMineCount(index.client, 'liveplanner', 'app', 1);
    await Promise.all([
      readAnyItem(index.client, 'liveplanner', 'app'),
      readAnyItem(index.client, 'liveplanner', 'all'),
    ]);
    expect(index.count('listItems')).toBe(4);
  });

  it('reads the larger Shared page once and cuts each asker’s own', async () => {
    const index = seeded();
    const [few, count] = await Promise.all([
      readSharedFirstPage(index.client, 'liveplanner', 'app', 4),
      readSharedFirstPage(index.client, 'liveplanner', 'app', 100),
    ]);
    expect(index.count('listShared')).toBe(1);
    expect(few).toMatchObject({ more: true });
    expect(few.shared).toHaveLength(4);
    expect(count).toMatchObject({ more: false });
    expect(count.shared).toHaveLength(6);
  });

  it('cancels the request only once every asker has let go', async () => {
    const index = seeded();
    index.hold.add('listItems');
    const gone = new AbortController();
    const kept = readMineCount(index.client, 'liveplanner', 'app', 200);
    const dropped = readAnyItem(index.client, 'liveplanner', 'app', gone.signal);
    await Promise.resolve();
    gone.abort();
    await expect(dropped).rejects.toMatchObject({ name: 'AbortError' });
    index.release();
    expect(await kept).toEqual({ count: 2, more: false });
    expect(index.count('listItems')).toBe(1);

    // Every asker gone before it went out: nothing is asked.
    const all = new AbortController();
    const lost = readAnyItem(index.client, 'liveplanner', 'app', all.signal);
    all.abort();
    await expect(lost).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    expect(index.count('listItems')).toBe(1);
  });

  it('falls back to the old reads when the index answers no fold', async () => {
    const index = seeded();
    const bare = {
      ...index.client,
      listItems: async (
        q: Parameters<IndexClient['listItems']>[0],
        o?: { signal?: AbortSignal },
      ) => {
        const { mine: _m, any: _a, ...rest } = await index.client.listItems(q, o);
        return rest;
      },
    } as IndexClient;
    const [mine, any] = await Promise.all([
      readMineCount(bare, 'liveplanner', 'app', 200),
      readRecentForHome(bare, 'liveplanner', 'app', { limit: 8, used: 4 }).then(() =>
        readAnyItem(bare, 'liveplanner', 'app'),
      ),
    ]);
    expect(mine).toEqual({ count: 2, more: false });
    expect(any).toBe(true);
  });
});
