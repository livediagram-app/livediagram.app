// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.hoisted(() => vi.fn());
vi.mock('./index-client', () => ({ indexClient: { getItem } }));

import {
  isTrashedInIndex,
  openOwnAddress,
  openShareLink,
  type ArrivalProduct,
  type ArrivalResolution,
  type ArrivalSetters,
} from './editor-arrival';

type Item = { id: string; ownerId: string };
type Post = { postId: string };
type Community = Post & { ownItemId: string | null };
type Role = 'view' | 'edit';

const trashed = new Error('trashed');

function harness(
  over: Partial<ArrivalProduct<Item, Role, Post, Community, 'item'>> = {},
  stored: { cached?: string | null; session?: string | null; confirmed?: boolean } = {},
) {
  const calls: string[] = [];
  let session = stored.session ?? null;
  const cache = new Map<string, string | null>();
  if (stored.cached) cache.set('code', stored.cached);
  const product: ArrivalProduct<Item, Role, Post, Community, 'item'> = {
    loadShared: vi.fn(async () => null),
    loadOwn: vi.fn(async () => null),
    ownStep: 'item',
    setLoadStep: (step) => calls.push(`step:${step}`),
    sharePassword: {
      readCached: (code) => cache.get(code) ?? null,
      writeCached: (code, password) => {
        cache.set(code, password);
        calls.push(`cache:${password}`);
      },
      getSession: () => session,
      setSession: (password) => {
        session = password;
        calls.push(`session:${password}`);
      },
    },
    hasConfirmedName: () => stored.confirmed ?? false,
    isTrashedError: (err) => err === trashed,
    resolveSession: ({ ownerId, selfId, shareRole, shareCodeParam, community }) => {
      const isOwner = !community && ownerId === selfId;
      return {
        isOwner,
        sessionRole: isOwner ? 'edit' : shareRole,
        sessionShareCode: isOwner ? null : shareCodeParam,
      };
    },
    communitySession: (post, ownItemId) => ({ ...post, ownItemId }),
    grant: vi.fn(async () => ({ level: 'edit' })),
    offlineOwnerId: 'offline',
    ...over,
  };
  const record =
    (name: string) =>
    (value: unknown): void => {
      calls.push(`${name}:${JSON.stringify(value)}`);
    };
  const set: ArrivalSetters<Role, Community> = {
    setItemId: record('itemId'),
    setNotFound: record('notFound'),
    setLoadError: record('loadError'),
    setTrashed: record('trashed'),
    setServerStored: record('serverStored'),
    setHydrated: record('hydrated'),
    setIsOwner: record('isOwner'),
    setLoading: record('loading'),
    setNameConfirmed: record('nameConfirmed'),
    setSessionRole: record('role'),
    setSessionShareCode: record('shareCode'),
    setSessionCommunity: record('community'),
    setSessionTabScope: record('tabScope'),
    setSharePasswordGate: record('gate'),
    setIdentityPromptOpen: record('prompt'),
  };
  const seed = vi.fn(async (_selfId: string, item: Item, code: string | null) => {
    calls.push(`seed:${item.id}:${code}`);
  });
  return { product, run: { self: { id: 'me' }, seed, set }, calls, cache };
}

const resolved = (
  over: Partial<Extract<ArrivalResolution<Item, Role, Post>, { item: Item }>> = {},
): ArrivalResolution<Item, Role, Post> => ({
  item: { id: 'i1', ownerId: 'them' },
  role: 'view',
  tabId: null,
  community: null,
  ...over,
});

const link = { shareCodeParam: 'code', id: null, embed: false };

beforeEach(() => {
  getItem.mockReset();
  window.history.replaceState(null, '', '/item/shared?s=code#h');
});

describe('openShareLink', () => {
  it('ends on the deleted card when the link resolves to an item in the Trash', async () => {
    const h = harness({ loadShared: vi.fn(async () => Promise.reject(trashed)) });
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toEqual([
      'step:share',
      'trashed:true',
      'hydrated:true',
      'loading:false',
      'nameConfirmed:false',
    ]);
  });

  it('ends on the error screen when the server cannot be reached', async () => {
    const h = harness({ loadShared: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toContain('loadError:true');
    expect(h.calls).not.toContain('trashed:true');
  });

  it('ends on not found when the code opens nothing', async () => {
    const h = harness({}, { confirmed: true });
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toEqual([
      'step:share',
      'notFound:true',
      'hydrated:true',
      'loading:false',
      'nameConfirmed:true',
    ]);
  });

  it('shows the gate, clearing a cached password the server refused', async () => {
    const h = harness(
      { loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: true })) },
      { cached: 'old' },
    );
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toEqual([
      'session:old',
      'step:share',
      'cache:null',
      'session:null',
      'gate:{"invalid":true}',
      'loading:false',
      'nameConfirmed:false',
    ]);
  });

  it('shows the gate without touching an empty cache', async () => {
    const h = harness({
      loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: false })),
    });
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toEqual([
      'step:share',
      'gate:{"invalid":false}',
      'loading:false',
      'nameConfirmed:false',
    ]);
  });

  it('opens a visitor on the item, keeping the password and putting the item in the bar', async () => {
    const h = harness(
      {
        loadShared: vi.fn(async () => resolved({ tabId: 't1' })),
        sharedAddress: (id) => `/item/${id}`,
      },
      { session: 'pw' },
    );
    expect(await openShareLink(h.product, h.run, link)).toBe(true);
    expect(h.calls).toEqual([
      'step:share',
      'cache:pw',
      'tabScope:"t1"',
      'step:first-tab',
      'seed:i1:code',
      'serverStored:true',
      'itemId:"i1"',
      'isOwner:false',
      'role:"view"',
      'shareCode:"code"',
      'community:null',
      'prompt:true',
    ]);
    expect(h.product.loadShared).toHaveBeenCalledWith('code', 'me', null);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/item/i1?s=code#h',
    );
  });

  it('keeps the bar when the address names the item, or the product keeps it', async () => {
    const named = harness({
      loadShared: vi.fn(async () => resolved()),
      sharedAddress: (id) => `/item/${id}`,
    });
    await openShareLink(named.product, named.run, { ...link, id: 'i1' });
    const kept = harness({ loadShared: vi.fn(async () => resolved()), sharedAddress: () => null });
    await openShareLink(kept.product, kept.run, link);
    const none = harness({ loadShared: vi.fn(async () => resolved()) });
    await openShareLink(none.product, none.run, link);
    expect(window.location.pathname).toBe('/item/shared');
  });

  it("opens a Community post read-only with no prompt, naming the author's own item", async () => {
    const h = harness({
      loadShared: vi.fn(async () =>
        resolved({ item: { id: 'i1', ownerId: 'me' }, community: { postId: 'p1' } }),
      ),
    });
    expect(await openShareLink(h.product, h.run, link)).toBe(true);
    expect(h.calls).toContain('community:{"postId":"p1","ownItemId":"i1"}');
    expect(h.calls).not.toContain('prompt:true');
  });

  it("names no own item for someone else's post", async () => {
    const h = harness({
      loadShared: vi.fn(async () => resolved({ community: { postId: 'p1' } })),
    });
    await openShareLink(h.product, h.run, link);
    expect(h.calls).toContain('community:{"postId":"p1","ownItemId":null}');
  });

  it('never prompts an owner or a confirmed name', async () => {
    const owner = harness({
      loadShared: vi.fn(async () => resolved({ item: { id: 'i1', ownerId: 'me' } })),
    });
    await openShareLink(owner.product, owner.run, link);
    expect(owner.calls).toContain('isOwner:true');
    expect(owner.calls).not.toContain('prompt:true');
    const named = harness({ loadShared: vi.fn(async () => resolved()) }, { confirmed: true });
    await openShareLink(named.product, named.run, link);
    expect(named.calls).not.toContain('prompt:true');
  });
});

describe('openOwnAddress', () => {
  const own = { id: 'i1', early: false, accountUserId: null };

  it('ends on the deleted card or the error screen when the load fails', async () => {
    const t = harness({ loadOwn: vi.fn(async () => Promise.reject(trashed)) });
    expect(await openOwnAddress(t.product, t.run, own)).toBe(false);
    expect(t.calls).toEqual([
      'step:item',
      'itemId:"i1"',
      'trashed:true',
      'hydrated:true',
      'loading:false',
      'nameConfirmed:false',
    ]);
    const e = harness({ loadOwn: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect(await openOwnAddress(e.product, e.run, own)).toBe(false);
    expect(e.calls).toContain('loadError:true');
  });

  it('asks the index whether a missing item is in the Trash', async () => {
    getItem.mockResolvedValueOnce({ item: { trashedAt: 5 } });
    const t = harness();
    expect(await openOwnAddress(t.product, t.run, own)).toBe(false);
    expect(t.calls).toContain('trashed:true');
    getItem.mockResolvedValueOnce({ item: { trashedAt: null } });
    const n = harness();
    expect(await openOwnAddress(n.product, n.run, own)).toBe(false);
    expect(n.calls).toEqual([
      'step:item',
      'itemId:"i1"',
      'notFound:true',
      'hydrated:true',
      'loading:false',
      'nameConfirmed:false',
    ]);
  });

  it("opens the item as its owner when the grant is edit, prompting a guest's name", async () => {
    const h = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })) });
    expect(await openOwnAddress(h.product, h.run, own)).toBe(true);
    expect(h.calls).toEqual([
      'step:item',
      'step:first-tab',
      'seed:i1:null',
      'serverStored:true',
      'isOwner:true',
      'role:"edit"',
      'prompt:true',
      'itemId:"i1"',
    ]);
  });

  it('opens a team member without the grant as no owner, and never prompts an account or an early open', async () => {
    const h = harness({
      loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'them' })),
      grant: vi.fn(async () => null),
    });
    await openOwnAddress(h.product, h.run, { ...own, accountUserId: 'u1' });
    expect(h.calls).toContain('isOwner:false');
    expect(h.calls).not.toContain('prompt:true');
    const early = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })) });
    await openOwnAddress(early.product, early.run, { ...own, early: true });
    expect(early.calls).not.toContain('prompt:true');
    const named = harness(
      { loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })) },
      { confirmed: true },
    );
    await openOwnAddress(named.product, named.run, own);
    expect(named.calls).not.toContain('prompt:true');
  });

  it('opens an Offline Mode item as its owner with no room, asking no grant', async () => {
    const h = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'offline' })) });
    await openOwnAddress(h.product, h.run, own);
    expect(h.calls).toContain('serverStored:false');
    expect(h.calls).toContain('isOwner:true');
    expect(h.product.grant).not.toHaveBeenCalled();
  });
});

describe('isTrashedInIndex', () => {
  it('is false when the index cannot say', async () => {
    getItem.mockRejectedValueOnce(new Error('down'));
    expect(await isTrashedInIndex('i1')).toBe(false);
  });
});
