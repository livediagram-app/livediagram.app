// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getItem = vi.hoisted(() => vi.fn());
vi.mock('./index-client', () => ({ indexClient: { getItem } }));

import {
  isTrashedInIndex,
  openOwnAddress,
  openShareLink,
  readerOfGrant,
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
    passwordLink: vi.fn(async () => null),
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

  it('shows the gate as changed, with no mismatch, when the remembered password is refused', async () => {
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
      'gate:{"invalid":false,"changed":true}',
      'loading:false',
      'nameConfirmed:false',
    ]);
  });

  it('shows the mismatch for a typed password the server refused', async () => {
    const h = harness(
      { loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: true })) },
      { session: 'typed' },
    );
    expect(await openShareLink(h.product, h.run, link)).toBe(false);
    expect(h.calls).toContain('gate:{"invalid":true}');
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

  // The owner opening an archived item's address: the api relays the index's `409 archived`. It ends on not found
  // (the editor's archived card), never on the error screen that blames the connection.
  it('ends an archived item on not found, never the error screen', async () => {
    const archived = Object.assign(new Error('load failed: 409'), {
      status: 409,
      code: 'archived',
    });
    const a = harness({ loadOwn: vi.fn(async () => Promise.reject(archived)) });
    expect(await openOwnAddress(a.product, a.run, own)).toBe(false);
    expect(a.calls).toEqual([
      'step:item',
      'itemId:"i1"',
      'notFound:true',
      'hydrated:true',
      'loading:false',
      'nameConfirmed:false',
    ]);
    // Another 409 is a real failure, and keeps the error screen.
    const other = Object.assign(new Error('load failed: 409'), { status: 409, code: 'busy' });
    const o = harness({ loadOwn: vi.fn(async () => Promise.reject(other)) });
    expect(await openOwnAddress(o.product, o.run, own)).toBe(false);
    expect(o.calls).toContain('loadError:true');
    expect(o.calls).not.toContain('notFound:true');
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

  // Work Tracker 1117: a visitor reopening the item by its own address, with no code, used to open as Editing and
  // lose what they typed to refused saves. The grant names the link they came through, so they open as its visitor.
  it("opens a link visitor reopening the own address at the grant's level, tab and code", async () => {
    const lastSeen = {
      remember: vi.fn(async () => {}),
      forget: vi.fn(async () => {}),
    };
    const h = harness({
      loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'them' })),
      grant: vi.fn(async () => ({ level: 'view', tabId: 't1', link: 'code' })),
      lastSeen,
    });
    expect(await openOwnAddress(h.product, h.run, { ...own, accountUserId: 'u1' })).toBe(true);
    expect(h.calls).toEqual([
      'step:item',
      'tabScope:"t1"',
      'step:first-tab',
      'seed:i1:code',
      'serverStored:true',
      'isOwner:false',
      'role:"view"',
      'shareCode:"code"',
      'itemId:"i1"',
    ]);
    expect(lastSeen.remember).toHaveBeenCalledWith(
      expect.objectContaining({
        via: 'code',
        access: { role: 'view', isOwner: false, sessionShareCode: 'code', tabScope: 't1' },
      }),
    );
  });

  it('never escalates: an unknown level reads as view, and below edit is never the owner', async () => {
    expect(readerOfGrant({ level: 'admin', link: 'code' })).toMatchObject({
      role: 'view',
      isOwner: false,
      visitor: true,
    });
    expect(readerOfGrant({ level: 'participate' })).toEqual({
      isOwner: false,
      role: 'participate',
      visitor: true,
      shareCode: null,
      tabScope: null,
    });
    expect(readerOfGrant({ level: 'edit', link: 'code' })).toMatchObject({
      isOwner: false,
      role: 'edit',
      shareCode: 'code',
    });
    expect(readerOfGrant({ level: 'edit' })).toMatchObject({ isOwner: true, visitor: false });
    expect(readerOfGrant(null)).toMatchObject({ isOwner: false, role: 'edit', visitor: false });
  });

  // Work Tracker 1244: a visitor reopening a password-protected item by its own address sends no code, so the index
  // refuses the grant. The refusal names the link, and the item opens through it: the gate, never Not Found.
  it('shows the password gate when a protected item is reopened with no code, whether the load misses or fails', async () => {
    const refused = Object.assign(new Error('load failed: 401'), {
      status: 401,
      code: 'password_required',
    });
    for (const loadOwn of [vi.fn(async () => null), vi.fn(async () => Promise.reject(refused))]) {
      const lastSeen = { remember: vi.fn(async () => {}), forget: vi.fn(async () => {}) };
      const loadShared = vi.fn(async () => ({ passwordRequired: true as const, invalid: false }));
      const h = harness({
        loadOwn,
        loadShared,
        passwordLink: vi.fn(async () => 'code'),
        lastSeen,
      });
      expect(await openOwnAddress(h.product, h.run, own)).toBe(false);
      expect(h.product.passwordLink).toHaveBeenCalledWith('i1');
      // Through the link the refusal named, for the item the address names.
      expect(loadShared).toHaveBeenCalledWith('code', 'me', 'i1');
      expect(h.calls).toContain('gate:{"invalid":false}');
      expect(h.calls).not.toContain('notFound:true');
      expect(h.calls).not.toContain('loadError:true');
      expect(lastSeen.forget).toHaveBeenCalledWith('me', 'i1');
      expect(getItem).not.toHaveBeenCalled();
    }
  });

  it('opens a protected item reopened with no code straight away with the password this browser remembers', async () => {
    const loadShared = vi.fn(async () => resolved({ role: 'view', tabId: 't1' }));
    const h = harness(
      { loadShared, passwordLink: vi.fn(async () => 'code') },
      { cached: 'hunter2' },
    );
    expect(await openOwnAddress(h.product, h.run, own)).toBe(true);
    expect(h.calls).toContain('session:hunter2');
    expect(h.calls).not.toContain('gate:{"invalid":false}');
    // As the link's visitor, at its level and tab, carrying its code; the address stays the item's own.
    expect(h.calls).toEqual(
      expect.arrayContaining(['tabScope:"t1"', 'isOwner:false', 'role:"view"', 'shareCode:"code"']),
    );
    expect(window.location.pathname).toBe('/item/shared');
  });

  it('says a remembered password was changed when a protected item reopened with no code refuses it', async () => {
    const h = harness(
      {
        loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: true })),
        passwordLink: vi.fn(async () => 'code'),
      },
      { cached: 'old' },
    );
    expect(await openOwnAddress(h.product, h.run, own)).toBe(false);
    expect(h.calls).toContain('gate:{"invalid":false,"changed":true}');
    expect(h.cache.get('code')).toBeNull();
  });

  it('still ends on not found or the error screen when no link is named, or asking for one fails', async () => {
    getItem.mockResolvedValue({ item: { trashedAt: null } });
    const miss = harness({ passwordLink: vi.fn(async () => Promise.reject(new Error('down'))) });
    expect(await openOwnAddress(miss.product, miss.run, own)).toBe(false);
    expect(miss.calls).toContain('notFound:true');
    const down = harness({
      loadOwn: vi.fn(async () => Promise.reject(new Error('network'))),
      passwordLink: vi.fn(async () => null),
    });
    expect(await openOwnAddress(down.product, down.run, own)).toBe(false);
    expect(down.calls).toContain('loadError:true');
    expect(down.product.loadShared).not.toHaveBeenCalled();
  });

  it('opens an Offline Mode item as its owner with no room, asking no grant', async () => {
    const h = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'offline' })) });
    await openOwnAddress(h.product, h.run, own);
    expect(h.calls).toContain('serverStored:false');
    expect(h.calls).toContain('isOwner:true');
    expect(h.product.grant).not.toHaveBeenCalled();
  });
});

// The last seen copy (livediagram's docs/specs/006-document/offline-mode.md "Warm open of a cloud document"): kept with
// the role each way in gives, forgotten when the reader lost the item, and never awaited by the load.
describe('the last seen copy', () => {
  const doors = () => ({
    remember: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    forgetVia: vi.fn(async () => {}),
  });
  const firstTab = { id: 't1', rev: 3, tab: { id: 't1' } };
  const own = { id: 'i1', early: false, accountUserId: 'me' };

  it('keeps the last seen copy of an Editor on its own address, with the first tab painted', async () => {
    const lastSeen = doors();
    const h = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })), lastSeen });
    h.run.seed.mockResolvedValueOnce(firstTab as never);
    expect(await openOwnAddress(h.product, h.run, own)).toBe(true);
    expect(lastSeen.remember).toHaveBeenCalledWith({
      reader: 'me',
      itemId: 'i1',
      item: { id: 'i1', ownerId: 'me' },
      firstTab,
      via: null,
      access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
    });
    // A team member without the grant keeps Editor access, without the owner's chrome.
    const member = doors();
    const m = harness({
      loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'them' })),
      grant: vi.fn(async () => null),
      lastSeen: member,
    });
    await openOwnAddress(m.product, m.run, own);
    expect(member.remember).toHaveBeenCalledWith(
      expect.objectContaining({
        firstTab: null,
        access: { role: 'edit', isOwner: false, sessionShareCode: null, tabScope: null },
      }),
    );
  });

  it('keeps the last seen copy of an Editor, a Participant and a Viewer link with their role', async () => {
    for (const role of ['edit', 'participate', 'view'] as const) {
      const lastSeen = doors();
      const h = harness({
        loadShared: vi.fn(async () => resolved({ role: role as Role, tabId: 't1' })),
        lastSeen,
      });
      expect(await openShareLink(h.product, h.run, { ...link, id: 'i1' })).toBe(true);
      expect(lastSeen.remember).toHaveBeenCalledWith({
        reader: 'me',
        itemId: 'i1',
        item: { id: 'i1', ownerId: 'them' },
        firstTab: null,
        via: 'code',
        access: { role, isOwner: false, sessionShareCode: 'code', tabScope: 't1' },
      });
    }
  });

  it('keeps none for a Community post, an embed or an item in This Browser', async () => {
    const lastSeen = doors();
    const post = harness({
      loadShared: vi.fn(async () => resolved({ community: { postId: 'p1' } })),
      lastSeen,
    });
    await openShareLink(post.product, post.run, link);
    const embed = harness({ loadShared: vi.fn(async () => resolved()), lastSeen });
    await openShareLink(embed.product, embed.run, { ...link, embed: true });
    const local = harness({
      loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'offline' })),
      lastSeen,
    });
    await openOwnAddress(local.product, local.run, own);
    expect(lastSeen.remember).not.toHaveBeenCalled();
  });

  it('forgets the last seen copy when the reader lost the item the address names', async () => {
    const lastSeen = doors();
    const named = { ...link, id: 'i1' };
    // A revoked link, a link to an item in the Trash, a password now asked.
    const revoked = harness({ lastSeen });
    await openShareLink(revoked.product, revoked.run, named);
    const binned = harness({ loadShared: vi.fn(async () => Promise.reject(trashed)), lastSeen });
    await openShareLink(binned.product, binned.run, named);
    const gated = harness({
      loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: false })),
      lastSeen,
    });
    await openShareLink(gated.product, gated.run, named);
    // Its own address: no longer theirs, or in the Trash.
    getItem.mockResolvedValueOnce({ item: { trashedAt: null } });
    const gone = harness({ lastSeen });
    await openOwnAddress(gone.product, gone.run, own);
    const deleted = harness({ loadOwn: vi.fn(async () => Promise.reject(trashed)), lastSeen });
    await openOwnAddress(deleted.product, deleted.run, own);
    expect(lastSeen.forget.mock.calls).toEqual(Array(5).fill(['me', 'i1']));
    // The link's copies go by its code too.
    expect(lastSeen.forgetVia.mock.calls).toEqual(Array(3).fill(['me', 'code']));
    expect(lastSeen.remember).not.toHaveBeenCalled();
  });

  // The Share dialog's links are `/<route>/shared?s=<code>`: their address names no item, so the code finds the copy.
  it("forgets a link's copies by its code when its own address names no item", async () => {
    const lastSeen = doors();
    const revoked = harness({ lastSeen });
    await openShareLink(revoked.product, revoked.run, link);
    const gated = harness({
      loadShared: vi.fn(async () => ({ passwordRequired: true as const, invalid: false })),
      lastSeen,
    });
    await openShareLink(gated.product, gated.run, link);
    expect(lastSeen.forget).not.toHaveBeenCalled();
    expect(lastSeen.forgetVia.mock.calls).toEqual(Array(2).fill(['me', 'code']));
    // Doors without forgetVia (an older binding) still arrive.
    const plain = harness({
      lastSeen: { remember: vi.fn(async () => {}), forget: vi.fn(async () => {}) },
    });
    expect(await openShareLink(plain.product, plain.run, link)).toBe(false);
  });

  it('keeps the copy when the server cannot be reached, and forgets no item a link does not name', async () => {
    const lastSeen = doors();
    const down = () => vi.fn(async () => Promise.reject(new Error('down')));
    const shared = harness({ loadShared: down(), lastSeen });
    await openShareLink(shared.product, shared.run, { ...link, id: 'i1' });
    const owned = harness({ loadOwn: down(), lastSeen });
    await openOwnAddress(owned.product, owned.run, own);
    const unnamed = harness({ lastSeen });
    await openShareLink(unnamed.product, unnamed.run, link);
    expect(lastSeen.forget).not.toHaveBeenCalled();
    // The revoked link with no item in its address goes by its code alone; the unreachable one keeps its copy.
    expect(lastSeen.forgetVia.mock.calls).toEqual([['me', 'code']]);
  });

  it('never holds or fails the load on the store', async () => {
    const lastSeen = {
      remember: vi.fn(() => Promise.reject(new Error('quota'))),
      forget: vi.fn(() => Promise.reject(new Error('quota'))),
      forgetVia: vi.fn(() => Promise.reject(new Error('quota'))),
    };
    const kept = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })), lastSeen });
    expect(await openOwnAddress(kept.product, kept.run, own)).toBe(true);
    const lost = harness({ lastSeen });
    expect(await openShareLink(lost.product, lost.run, { ...link, id: 'i1' })).toBe(false);
    // A product that keeps no copies (liveplanner) arrives as before.
    const none = harness({ loadOwn: vi.fn(async () => ({ id: 'i1', ownerId: 'me' })) });
    expect(await openOwnAddress(none.product, none.run, own)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve));
  });
});

describe('isTrashedInIndex', () => {
  it('is false when the index cannot say', async () => {
    getItem.mockRejectedValueOnce(new Error('down'));
    expect(await isTrashedInIndex('i1')).toBe(false);
  });
});
