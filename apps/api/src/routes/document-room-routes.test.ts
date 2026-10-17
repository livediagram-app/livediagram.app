// Realtime-room admission: the ticket mint and the WebSocket upgrade.
//
// The upgrade is the one place in the worker that hands a Durable Object a
// TRUST HEADER — the DO has no identities of its own, so it believes whatever
// arrives as `X-Verified-Role` / `X-Verified-Owner` (document-room.ts). What
// makes that safe is not that the DO is unreachable from outside (it is
// reachable, via this route) but that this route OVERWRITES both names on every
// path, so a client's own copy can never survive. A browser can't put headers
// on an upgrade at all, but websocat / curl can, so the header the route forgets
// to stamp is the header an attacker supplies. These tests read the headers the
// stub actually received rather than trusting the route's intent.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

const { db } = vi.hoisted(() => ({
  db: {
    consumeWsTicket: vi.fn(),
    createWsTicket: vi.fn(async () => 'TICKET-1'),
    getDocumentMeta: vi.fn(),
    getDocumentSharePassword: vi.fn(async (): Promise<string | null> => null),
    getShareLink: vi.fn(),
    getMembership: vi.fn(async (): Promise<{ status: string } | null> => null),
  },
}));
vi.mock('../db', () => db);

const { gates } = vi.hoisted(() => ({
  gates: { canEditDocument: vi.fn(), canReadDocument: vi.fn(), resolveDocumentGrant: vi.fn() },
}));
vi.mock('../auth/document-access', () => gates);

import { makeTestRouteContext } from './test-route-context';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { networkTagFor } from '../vote-integrity';
import { personTagFor } from '../person-tag';
import { adderKeyFor } from '../adder-key';

// A DOCUMENT_ROOM binding that records the Request it was handed, so a test can
// inspect the forwarded headers.
//
// Answers 204, not the 101 the real room sends: these tests run on node, whose
// Response constructor refuses a 1xx status outright. Nothing here turns on the
// status — REACHING the room is the signal (and `seen` records that directly),
// while the upgrade's own 101 comes from workerd's WebSocketPair.
const REACHED_ROOM = 204;
function roomEnv() {
  const seen: Request[] = [];
  const env = {
    DOCUMENT_ROOM: {
      idFromName: (name: string) => `id:${name}`,
      get: () => ({
        fetch: async (req: Request) => {
          seen.push(req);
          return new Response(null, { status: REACHED_ROOM });
        },
      }),
    },
  } as unknown as Env;
  return { env, seen };
}

// The upgrade as a hostile non-browser client sends it: both trust headers
// pre-set, hoping the route only ever adds and never overwrites.
const SPOOFED = {
  Upgrade: 'websocket',
  'X-Verified-Role': 'edit',
  'X-Verified-Owner': '1',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.createWsTicket.mockResolvedValue('TICKET-1');
  db.getDocumentSharePassword.mockResolvedValue(null);
});

const visitorTicket = {
  role: 'view',
  tabScope: null,
  shareCode: 'CODE1234',
  owner: false,
} as const;
const ownerTicket = { role: 'edit', tabScope: null, shareCode: null, owner: true } as const;

describe('WebSocket upgrade — trust headers', () => {
  it('overwrites a client-supplied X-Verified-Owner on a NON-owner upgrade', async () => {
    // A share visitor's ticket, claiming to be the owner. Owner-ness gates the facilitator baton
    // (docs/specs/012-collaboration/facilitator.md): it lets a session seize the baton off its current holder and
    // end someone else's turn, so a believed claim here is a real privilege.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({ ...visitorTicket, role: 'edit' });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(res?.status).toBe(REACHED_ROOM);
    expect(seen).toHaveLength(1);
    // '0', not absent: the DO reads `=== '1'`, so an explicit falsy value is
    // what proves the client's '1' was replaced rather than merely ignored.
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('0');
  });

  it("seats the owner from an owner's ticket", async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue(ownerTicket);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: { ...SPOOFED, 'X-Verified-Owner': '0' },
        env,
      }),
    );
    expect(res?.status).toBe(REACHED_ROOM);
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('1');
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
  });

  it('overwrites a client-supplied X-Verified-Role with the ticket role', async () => {
    // A view ticket claiming 'edit' gets 'view'.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue(visitorTicket);
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('view');
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('0');
  });

  it('admits a team member by ticket, without the owner bit', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'someone-else', teamId: 'team-1' });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      owner: false,
    });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(res?.status).toBe(REACHED_ROOM);
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('0');
  });

  it('never reaches the room without a ticket, whatever headers the client sent', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws', { owner: null, headers: SPOOFED, env }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
    expect(db.consumeWsTicket).not.toHaveBeenCalled();
  });

  it('refuses a spent, expired or foreign ticket', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=SPENT', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
    expect(db.consumeWsTicket).toHaveBeenCalledWith(env, 'SPENT', 'd1');
  });

  // docs/specs/015-api/api.md "Realtime model": the owner id, its signature, the share code and the share password
  // no longer admit anyone on the upgrade URL, however valid. They are never even looked up.
  it.each([
    ['the owner id', '?o=owner-uuid'],
    ['a signed owner id', '?o=owner-uuid&os=sig'],
    ['a share code', '?s=CODE1234'],
    ['a share code with its password', '?s=CODE1234&p=pw'],
    ['an account id', '?o=user_2abcDEF'],
  ])('admits nobody on %s, the retired legs', async (_leg, query) => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'edit', code: 'CODE1234' });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', `/api/documents/d1/ws${query}`, {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
    expect(db.getShareLink).not.toHaveBeenCalled();
    // The refusal names which retired params came, never their values.
    expect(info).toHaveBeenCalledWith(
      '[room-upgrade] refused',
      expect.objectContaining({ documentId: 'd1', ticket: false }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/owner-uuid|CODE1234|pw|sig|user_2/);
    info.mockRestore();
  });

  it('answers 404 for a document in the Trash, ticket or not', async () => {
    db.getDocumentMeta.mockResolvedValue(null);
    db.consumeWsTicket.mockResolvedValue(ownerTicket);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(404);
    expect(seen).toHaveLength(0);
  });
});

describe('POST room-ticket', () => {
  // docs/specs/013-workspace/workbench-embeds.md: a workbench session joins as the person, at most at its level.
  it('mints for a workbench session as the owner, capped and carrying its pairing', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'user_1', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: null });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', {
        owner: 'user_1',
        verifiedUserId: 'user_1',
        workbench: {
          sessionId: 's',
          ownerId: 'user_1',
          tokenId: 'tok1',
          pairingId: 'pair-1',
          documentId: 'd1',
          tabId: null,
          origin: 'https://w.example',
          level: 'view',
          expiresAt: 1,
        },
      }),
    );
    expect(res!.status).toBe(200);
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', {
      role: 'view',
      tabScope: null,
      shareCode: null,
      account: true,
      personTag: await personTagFor('d1', 'user_1'),
      workbenchPairing: 'pair-1',
      adderKey: null,
      owner: true,
    });
  });

  it('mints an edit ticket when the caller holds edit', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-1', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: null });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'owner-1' }),
    );
    expect(await res!.json()).toEqual({ ticket: 'TICKET-1' });
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', {
      role: 'edit',
      tabScope: null,
      shareCode: null,
      account: false,
      personTag: null,
      workbenchPairing: null,
      adderKey: null,
      owner: true,
    });
  });

  it('mints a view ticket for a view grant', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'view', tabScope: null, shareCode: 'C' });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(res!.status).toBe(200);
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', {
      role: 'view',
      tabScope: null,
      shareCode: 'C',
      account: false,
      personTag: null,
      workbenchPairing: null,
      adderKey: null,
      owner: false,
    });
  });

  // docs/specs/025-community/community.md: a Community visitor never joins the author's room.
  it('mints no ticket for a Community post link', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({
      role: 'view',
      tabScope: null,
      shareCode: 'POSTLINK',
      community: true,
    });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(res!.status).toBe(403);
    expect(await res!.json()).toEqual({ error: 'community_link' });
    expect(db.createWsTicket).not.toHaveBeenCalled();
  });

  // docs/specs/012-collaboration/facilitator.md: the mint decides owner-ness with ownsDocument, so a team
  // document's owner counts only while verified and still joined.
  it('mints the owner bit only for the verified, joined owner of a team document', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'user_own', teamId: 'team-1' });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: null });
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const asOwner = () =>
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', {
        owner: 'user_own',
        clerkUserId: 'user_own',
        verifiedUserId: 'user_own',
      });
    await handleDocumentRoomRoutes(asOwner());
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ owner: true }),
    );
    db.getMembership.mockResolvedValue(null);
    await handleDocumentRoomRoutes(asOwner());
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ owner: false }),
    );
  });

  it('404s (no existence leak) and mints nothing without a grant', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue(null);
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'stranger' }),
    );
    expect(res!.status).toBe(404);
    expect(db.createWsTicket).not.toHaveBeenCalled();
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: the room learns each session's scope and the code that
// admitted it from the worker, on every path, and never from the client.
describe('WebSocket upgrade: tab scope', () => {
  const SPOOFED_SCOPE = {
    Upgrade: 'websocket',
    'X-Verified-Tab-Scope': '',
    'X-Verified-Share-Code': 'NOTMINE2',
  };

  it('forwards what the ticket carried', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'someone-else', teamId: null });
    db.consumeWsTicket.mockResolvedValue({ role: 'edit', tabScope: 't2', shareCode: 'CODE1234' });
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: SPOOFED_SCOPE,
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Tab-Scope')).toBe('t2');
    expect(seen[0]!.headers.get('X-Verified-Share-Code')).toBe('CODE1234');
  });

  it('blanks both for the owner, whatever the client sent', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue(ownerTicket);
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
        owner: null,
        headers: { ...SPOOFED_SCOPE, 'X-Verified-Tab-Scope': 't9' },
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Tab-Scope')).toBe('');
    expect(seen[0]!.headers.get('X-Verified-Share-Code')).toBe('');
  });

  it('mints a ticket carrying the grant scope and code', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({
      role: 'edit',
      tabScope: 't2',
      shareCode: 'CODE1234',
    });
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', {
      role: 'edit',
      tabScope: 't2',
      shareCode: 'CODE1234',
      account: false,
      personTag: null,
      workbenchPairing: null,
      adderKey: null,
      owner: false,
    });
  });
});

// The account bit (docs/specs/014-identity/profile-picture.md §6): only a verified Clerk session
// mints an account ticket, and the upgrade stamps the bit on every path, so a client header can
// never claim it.
describe('account sessions', () => {
  it('mints an account ticket for a verified Clerk caller only', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'view', tabScope: null, shareCode: 'C' });
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', {
        owner: 'user_ann',
        clerkUserId: 'user_ann',
      }),
    );
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ account: true }),
    );
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', {
        owner: 'user_ann',
        verifiedUserId: 'user_ann',
      }),
    );
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ account: false }),
    );
  });

  it('stamps X-Verified-Account from the ticket, and 0 on a ticket without it', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      account: true,
    });
    const ticketed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env: ticketed.env,
      }),
    );
    expect(ticketed.seen[0]!.headers.get('X-Verified-Account')).toBe('1');

    db.consumeWsTicket.mockResolvedValue({ ...visitorTicket, role: 'view' });
    const anonymous = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T2', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Account': '1' },
        env: anonymous.env,
      }),
    );
    expect(anonymous.seen[0]!.headers.get('X-Verified-Account')).toBe('0');
  });
});

// The person tag (docs/specs/024-agents/agent-changesets.md "Held elements", CS39): an account's
// ticket carries it, and the upgrade stamps it on every path, so a client can never claim one.
describe('person tag', () => {
  it("mints a verified account's ticket with its person tag, and nobody else's", async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'user_ann', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: null });
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', {
        owner: 'user_ann',
        clerkUserId: 'user_ann',
      }),
    );
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ personTag: await personTagFor('d1', 'user_ann') }),
    );
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'guest-uuid' }),
    );
    expect(db.createWsTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ personTag: null }),
    );
  });

  it('stamps X-Verified-Person from the ticket, and empty on a ticket without it', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      account: true,
      personTag: 'tag1',
    });
    const ticketed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env: ticketed.env,
      }),
    );
    expect(ticketed.seen[0]!.headers.get('X-Verified-Person')).toBe('tag1');

    db.consumeWsTicket.mockResolvedValue({ ...visitorTicket, role: 'edit' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T2', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Person': 'forged' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Person')).toBe('');
  });

  it('stamps X-Verified-Workbench-Pairing from the ticket, and empty on a ticket without it', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      account: true,
      personTag: 'tag1',
      workbenchPairing: 'pair-1',
      adderKey: null,
    });
    const ticketed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env: ticketed.env,
      }),
    );
    expect(ticketed.seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('pair-1');

    db.consumeWsTicket.mockResolvedValue({ ...visitorTicket, role: 'edit' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T2', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Workbench-Pairing': 'forged' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('');
  });

  // docs/specs/013-workspace/share-roles.md "Integrity": a Participant's ticket carries its adder key, which the
  // upgrade forwards; every other leg forwards none, whatever the client sent.
  it("mints a Participant's ticket with its adder key, and nobody else's", async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({
      role: 'participate',
      tabScope: null,
      shareCode: 'C',
    });
    const minted = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    const key = await adderKeyFor('d1', 'visitor');
    expect(await minted!.json()).toEqual({ ticket: 'TICKET-1', adderKey: key });
    expect(db.createWsTicket).toHaveBeenCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ role: 'participate', adderKey: key }),
    );
    db.createWsTicket.mockClear();
    gates.resolveDocumentGrant.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: 'C' });
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(db.createWsTicket).toHaveBeenCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ adderKey: null }),
    );
  });

  it('stamps X-Verified-Adder from the ticket and X-Verified-Document on every ticket', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'participate',
      tabScope: null,
      shareCode: 'C',
      account: false,
      personTag: null,
      workbenchPairing: null,
      adderKey: 'k'.repeat(32),
    });
    const ticketed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env: ticketed.env,
      }),
    );
    expect(ticketed.seen[0]!.headers.get('X-Verified-Role')).toBe('participate');
    expect(ticketed.seen[0]!.headers.get('X-Verified-Adder')).toBe('k'.repeat(32));
    expect(ticketed.seen[0]!.headers.get('X-Verified-Document')).toBe('d1');

    db.consumeWsTicket.mockResolvedValue({ ...visitorTicket, role: 'participate' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=T2', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Adder': 'forged', 'X-Verified-Document': 'x' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Role')).toBe('participate');
    expect(spoofed.seen[0]!.headers.get('X-Verified-Adder')).toBe('');
    expect(spoofed.seen[0]!.headers.get('X-Verified-Document')).toBe('d1');
  });

  // docs/specs/012-collaboration/vote-integrity.md: what caps one network's poll answers. The worker derives it
  // from the edge's client address on every leg, so a client can never choose its own.
  it('stamps X-Verified-Network from the caller address, over anything the client sent', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue(visitorTicket);
    const upgrade = async (ip: string) => {
      const { env, seen } = roomEnv();
      await handleDocumentRoomRoutes(
        makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1', {
          owner: null,
          headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip, 'X-Verified-Network': 'forged' },
          env,
        }),
      );
      return seen[0]!.headers.get('X-Verified-Network');
    };
    const a = await upgrade('203.0.113.7');
    expect(a).toBe(await networkTagFor('d1', '203.0.113.7'));
    expect(a).not.toBe('forged');
    // One IPv6 /64 is one network.
    expect(await upgrade('2001:db8:0:1::5')).toBe(await upgrade('2001:db8:0:1:ffff::9'));
  });
});
