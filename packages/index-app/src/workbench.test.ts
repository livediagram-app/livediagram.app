import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryWorkbenchNamespace } from './testing';
import {
  WORKBENCH_SESSION_PATTERN,
  WORKBENCH_SWEEP_MS,
  WORKBENCH_TICKET_PATTERN,
  WORKBENCH_TOKEN_CHECK_MS,
  workbenchStoreClass,
  workbenchStoreOf,
  workbenchStoreOfSecret,
  type WorkbenchToken,
} from './workbench';

const NOW = 1_800_000_000_000;
const ORIGIN = 'https://acme.test';
const TOKEN: WorkbenchToken = { id: 'tok1', name: 'CLI', readOnly: false, expiresAt: NOW + 1e10 };
const CREDENTIALS = { accountsUrl: 'https://accounts.test', clientId: 'app', clientSecret: 's' };

function arrange(live: (ids: string[]) => string[] = (ids) => ids) {
  const closed: [string, string][] = [];
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { ids } = JSON.parse(String(init?.body)) as { ids: string[] };
    return Response.json({ live: live(ids) });
  });
  const ns = memoryWorkbenchNamespace<'project'>({
    credentials: () => CREDENTIALS,
    closeRoom: async (itemId, pairingId) => {
      closed.push([itemId, pairingId]);
      return true;
    },
    fetcher: fetcher as unknown as typeof fetch,
  });
  return { ns, closed, fetcher, store: ns.storeOf('user_1') };
}

async function paired(
  store: ReturnType<typeof arrange>['store'],
  scope: 'project' | 'workspace' = 'project',
) {
  const { code } = await store.openPairingRequest({
    personId: 'user_1',
    token: TOKEN,
    origin: ORIGIN,
    scope,
    name: 'Acme',
    now: NOW,
  });
  const answer = await store.answerPairingRequest({ code, answer: 'approve', now: NOW });
  if (answer.outcome !== 'approved') throw new Error('not approved');
  return answer.pairing;
}

async function session(store: ReturnType<typeof arrange>['store'], itemId: string | null = 'doc1') {
  const pairing = await paired(store, itemId ? 'project' : 'workspace');
  const reach = itemId
    ? ({ scope: 'project', itemId, folderId: null } as const)
    : ({ scope: 'workspace', itemId: null, folderId: null } as const);
  const { ticket } = await store.mintTicket({
    personId: 'user_1',
    token: TOKEN,
    pairingId: pairing.id,
    reach,
    tabId: null,
    origin: ORIGIN,
    role: 'edit',
    now: NOW,
    expiresAt: NOW + 60_000,
  });
  const consumed = await store.consumeTicket(ticket, NOW);
  if (!consumed.ok) throw new Error('not consumed');
  return store.openSession({
    personId: 'user_1',
    tokenId: TOKEN.id,
    pairingId: pairing.id,
    reach,
    tabId: null,
    origin: ORIGIN,
    role: 'edit',
    now: NOW,
    expiresAt: NOW + 8 * 3600_000,
  });
}

describe('the workbench store', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));

  it('reads nothing and makes nothing for a person who never paired', async () => {
    const { ns, store } = arrange();
    expect(await store.findPairing('tok1', ORIGIN)).toBeNull();
    expect(await store.readSession('lvw_x')).toBeNull();
    expect(await store.consumeTicket('x', NOW)).toEqual({ ok: false, reason: 'unknown' });
    expect(await store.listPairings(NOW)).toEqual([]);
    const { storage } = [...ns.stores.values()][0]!;
    expect(
      storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray(),
    ).toEqual([]);
  });

  it('reuses one live request per token, origin and scope, and takes a new name', async () => {
    const { store } = arrange();
    const first = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: null,
      now: NOW,
    });
    const again = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: 'Acme',
      now: NOW + 1,
    });
    expect(again).toEqual({ code: first.code, expiresAt: first.expiresAt, reused: true });
    const read = await store.readPairingRequest(first.code, NOW);
    expect(read).toMatchObject({
      name: 'Acme',
      tokenName: 'CLI',
      status: 'pending',
      scope: 'project',
    });
    expect(await store.pairingRequestStatus(first.code, 'other', NOW)).toBeNull();
    const later = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: null,
      now: first.expiresAt,
    });
    expect(later.reused).toBe(false);
  });

  it('answers a request once; a workspace approval widens a project pairing in place', async () => {
    const { store } = arrange();
    const pairing = await paired(store, 'project');
    const { code } = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'workspace',
      name: null,
      now: NOW,
    });
    const widened = await store.answerPairingRequest({ code, answer: 'approve', now: NOW });
    expect(widened).toMatchObject({
      outcome: 'approved',
      pairing: { id: pairing.id, scope: 'workspace', name: 'Acme' },
    });
    expect(await store.answerPairingRequest({ code, answer: 'decline', now: NOW })).toEqual({
      outcome: 'answered',
    });
    const narrow = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: null,
      now: NOW,
    });
    await store.answerPairingRequest({ code: narrow.code, answer: 'approve', now: NOW });
    expect((await store.findPairing('tok1', ORIGIN))?.scope).toBe('workspace');
    const expired = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: 'https://b.test',
      scope: 'project',
      name: null,
      now: NOW,
    });
    expect(
      await store.answerPairingRequest({
        code: expired.code,
        answer: 'approve',
        now: expired.expiresAt,
      }),
    ).toEqual({ outcome: 'expired' });
    expect(await store.answerPairingRequest({ code: 'nope', answer: 'approve', now: NOW })).toEqual(
      { outcome: 'missing' },
    );
  });

  it('issues routed secrets that reach the store from the secret alone, once', async () => {
    const { ns, store } = arrange();
    const pairing = await paired(store);
    const { ticket } = await store.mintTicket({
      personId: 'user_1',
      token: TOKEN,
      pairingId: pairing.id,
      reach: { scope: 'project', itemId: 'doc1', folderId: null },
      tabId: 't1',
      origin: ORIGIN,
      role: 'edit',
      now: NOW,
      expiresAt: NOW + 60_000,
    });
    expect(ticket).toMatch(WORKBENCH_TICKET_PATTERN);
    const routed = workbenchStoreOfSecret<'project'>(ns, ticket)!;
    expect(routed).toBe(store);
    const consumed = await routed.consumeTicket(ticket, NOW + 1);
    expect(consumed).toMatchObject({
      ok: true,
      ticket: {
        ownerId: 'user_1',
        itemId: 'doc1',
        tabId: 't1',
        scope: 'project',
        tokenReadOnly: false,
      },
    });
    expect(await routed.consumeTicket(ticket, NOW + 2)).toEqual({ ok: false, reason: 'used' });
    expect(workbenchStoreOfSecret(ns, 'no-suffix')).toBeNull();
    // A forged suffix reaches a store that knows nothing of the secret.
    const forged = `${ticket.split('.')[0]}.${'0'.repeat(64)}`;
    expect(await workbenchStoreOfSecret(ns, forged)!.consumeTicket(forged, NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });

    const opened = await session(store);
    expect(opened.secret).toMatch(WORKBENCH_SESSION_PATTERN);
    expect(
      await workbenchStoreOfSecret<'project'>(ns, opened.secret)!.readSession(opened.secret),
    ).toMatchObject({
      id: opened.id,
      itemId: 'doc1',
      ownerId: 'user_1',
      tokenRevoked: false,
    });
    expect(workbenchStoreOf(ns, 'user_1')).toBe(store);
  });

  it('refuses an expired ticket as expired and a dead token as unknown', async () => {
    const { store } = arrange();
    const pairing = await paired(store);
    const mint = (expiresAt: number) =>
      store.mintTicket({
        personId: 'user_1',
        token: TOKEN,
        pairingId: pairing.id,
        reach: { scope: 'workspace', itemId: null, folderId: 'f1' },
        tabId: null,
        origin: ORIGIN,
        role: 'view',
        now: NOW,
        expiresAt,
      });
    const old = await mint(NOW + 10);
    expect(await store.consumeTicket(old.ticket, NOW + 10)).toEqual({
      ok: false,
      reason: 'expired',
    });
    const live = await mint(NOW + 60_000);
    await store.endAccess({ tokenId: 'tok1' }, 'revoked');
    expect(await store.consumeTicket(live.ticket, NOW)).toEqual({ ok: false, reason: 'unknown' });
  });

  it('ending a pairing removes its sessions and closes every room they had open', async () => {
    const { store, closed } = arrange();
    const projectSession = await session(store, 'doc1');
    const pairing = (await store.findPairing('tok1', ORIGIN))!;
    const workspace = await store.openSession({
      personId: 'user_1',
      tokenId: 'tok1',
      pairingId: pairing.id,
      reach: { scope: 'workspace', itemId: null, folderId: null },
      tabId: null,
      origin: ORIGIN,
      role: 'edit',
      now: NOW,
      expiresAt: NOW + 1000,
    });
    await store.noteSessionRoom(workspace.id, 'doc2');
    await store.noteSessionRoom(workspace.id, 'doc2');
    expect(await store.hasPairing(pairing.id)).toBe(true);
    const ended = await store.endAccess({ pairingId: pairing.id }, 'unpaired');
    expect(ended).toEqual({ pairings: 1, sessions: 2, rooms: 2, unreached: 0 });
    expect(closed.sort()).toEqual([
      ['doc1', pairing.id],
      ['doc2', pairing.id],
    ]);
    expect(await store.readSession(projectSession.secret)).toBeNull();
    expect(await store.hasPairing(pairing.id)).toBe(false);
  });

  it('lists only pairings of tokens liveworkspace still knows', async () => {
    let alive = true;
    const { store, fetcher } = arrange((ids) => (alive ? ids : []));
    await paired(store);
    expect(await store.listPairings(NOW)).toHaveLength(1);
    alive = false;
    expect(await store.listPairings(NOW)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('checks tokens behind live sessions every five minutes, ending a revoked one', async () => {
    let alive = true;
    const { ns, store, closed, fetcher } = arrange((ids) => (alive ? ids : []));
    const opened = await session(store);
    const { storage } = ns.stores.get(ns.idFromName('user_1').toString())!;
    expect(storage.alarmAt).toBe(NOW + WORKBENCH_TOKEN_CHECK_MS);
    expect(await store.alarm(NOW + WORKBENCH_TOKEN_CHECK_MS)).toEqual({ revoked: [], swept: 0 });
    expect(storage.alarmAt).toBe(NOW + 2 * WORKBENCH_TOKEN_CHECK_MS);
    alive = false;
    expect((await store.alarm(NOW + 2 * WORKBENCH_TOKEN_CHECK_MS)).revoked).toEqual(['tok1']);
    expect(await store.readSession(opened.secret)).toBeNull();
    expect(closed).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps everything when liveworkspace cannot answer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { store } = arrange(() => {
      throw new Error('down');
    });
    const opened = await session(store);
    expect((await store.alarm(NOW + WORKBENCH_TOKEN_CHECK_MS)).revoked).toEqual([]);
    expect(await store.readSession(opened.secret)).not.toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('sweeps spent rows daily and deletes itself once nothing is left', async () => {
    const { ns, store } = arrange();
    await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: null,
      now: NOW,
    });
    const { storage } = ns.stores.get(ns.idFromName('user_1').toString())!;
    expect(storage.alarmAt).toBe(NOW + WORKBENCH_SWEEP_MS);
    const out = await store.alarm(NOW + WORKBENCH_SWEEP_MS);
    expect(out.swept).toBe(2); // the request and the token nothing hangs off now
    expect(storage.alarmAt).toBeNull();
    expect(
      storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray(),
    ).toEqual([]);
  });

  it('closes: ends every pairing and drops the store', async () => {
    const { ns, store, closed } = arrange();
    await session(store);
    await store.close();
    expect(closed).toHaveLength(1);
    const { storage } = ns.stores.get(ns.idFromName('user_1').toString())!;
    expect(
      storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray(),
    ).toEqual([]);
    expect(await store.findPairing('tok1', ORIGIN)).toBeNull();
  });

  it('reads a session in well under a millisecond among a thousand', async () => {
    const { store } = arrange();
    const pairing = await paired(store);
    let last = '';
    for (let i = 0; i < 1000; i++) {
      last = (
        await store.openSession({
          personId: 'user_1',
          tokenId: 'tok1',
          pairingId: pairing.id,
          reach: { scope: 'project', itemId: `doc${i}`, folderId: null },
          tabId: null,
          origin: ORIGIN,
          role: 'edit',
          now: NOW,
          expiresAt: NOW + 1000,
        })
      ).secret;
    }
    const started = performance.now();
    for (let i = 0; i < 100; i++) await store.readSession(last);
    expect((performance.now() - started) / 100).toBeLessThan(1);
  });

  it('builds a Durable Object class on the runtime base with every method', async () => {
    class Base {
      readonly ctx: DurableObjectState;
      constructor(ctx: DurableObjectState, _env: unknown) {
        this.ctx = ctx;
      }
    }
    const { memoryStorage } = await import('./testing');
    const storage = memoryStorage();
    const Store = workbenchStoreClass<unknown, 'project'>(Base, () => ({
      credentials: () => null,
      closeRoom: async () => true,
    }));
    class Concrete extends Store {}
    const ctx = {
      storage,
      id: { toString: () => 'a'.repeat(64) },
    } as unknown as DurableObjectState;
    const store = new Concrete(ctx, {});
    const { code } = await store.openPairingRequest({
      personId: 'user_1',
      token: TOKEN,
      origin: ORIGIN,
      scope: 'project',
      name: null,
      now: NOW,
    });
    expect(await store.pairingRequestStatus(code, 'tok1', NOW)).toMatchObject({
      status: 'pending',
    });
    expect(await store.answerPairingRequest({ code, answer: 'decline', now: NOW })).toMatchObject({
      outcome: 'declined',
    });
    expect(await store.readPairingRequest(code, NOW)).toMatchObject({ status: 'declined' });
    expect(await store.findPairing('tok1', ORIGIN)).toBeNull();
    expect(await store.hasPairing('x')).toBe(false);
    expect(await store.listPairings(NOW)).toEqual([]);
    await expect(store.consumeTicket('x', NOW)).resolves.toMatchObject({ ok: false });
    expect(await store.readSession('x')).toBeNull();
    await store.endSession('x');
    await store.noteSessionRoom('x', 'doc1');
    expect(await store.endAccess({ pairingId: 'x' }, 'unpaired')).toMatchObject({ pairings: 0 });
    await store.alarm();
    await store.close();
    const pairing = await (async () => {
      const r = await store.openPairingRequest({
        personId: 'user_1',
        token: TOKEN,
        origin: ORIGIN,
        scope: 'project',
        name: null,
        now: NOW,
      });
      const a = await store.answerPairingRequest({ code: r.code, answer: 'approve', now: NOW });
      return a.outcome === 'approved' ? a.pairing : null;
    })();
    const minted = await store.mintTicket({
      personId: 'user_1',
      token: TOKEN,
      pairingId: pairing!.id,
      reach: { scope: 'project', itemId: 'd', folderId: null },
      tabId: null,
      origin: ORIGIN,
      role: 'edit',
      now: NOW,
      expiresAt: NOW + 1,
    });
    expect(minted.ticket.endsWith(`.${'a'.repeat(64)}`)).toBe(true);
    const s = await store.openSession({
      personId: 'user_1',
      tokenId: 'tok1',
      pairingId: pairing!.id,
      reach: { scope: 'project', itemId: 'd', folderId: null },
      tabId: null,
      origin: ORIGIN,
      role: 'edit',
      now: NOW,
      expiresAt: NOW + 1,
    });
    await store.endSession(s.id);
    expect(await store.readSession(s.secret)).toBeNull();
  });
});
