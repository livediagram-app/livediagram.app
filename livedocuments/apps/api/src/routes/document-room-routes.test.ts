// Realtime-room admission: the ticket mint and the WebSocket upgrade.
//
// The upgrade is the one place in the worker that hands a Durable Object a
// TRUST HEADER — the DO has no identities of its own, so it believes whatever
// arrives under an `X-Verified-*` name (room-session.ts). What
// makes that safe is not that the DO is unreachable from outside (it is
// reachable, via this route) but that this route OVERWRITES those names on every
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
import { personTagFor } from '../person-tag';
import { signOwnerId } from '../auth/owner-signature';

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

// The upgrade as a hostile non-browser client sends it: a trust header
// pre-set, hoping the route only ever adds and never overwrites.
const SPOOFED = {
  Upgrade: 'websocket',
  'X-Verified-Role': 'edit',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.createWsTicket.mockResolvedValue('TICKET-1');
  db.getDocumentSharePassword.mockResolvedValue(null);
});

describe('WebSocket upgrade — trust headers', () => {
  it('seats a genuine owner upgrade as an editor', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?o=owner-uuid', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(REACHED_ROOM);
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
  });

  // Once the guest signature gate is armed, `o` is the same bearer value as
  // REST's X-Owner-Id and needs the same proof, on `os`.
  describe('with the guest signature gate armed', () => {
    const armed = (env: Env) =>
      Object.assign(env, { GUEST_ID_HMAC_SECRET: 'sek', GUEST_SIG_ENFORCE_AFTER: '0' });

    it('refuses an unsigned owner id', async () => {
      db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
      db.getShareLink.mockResolvedValue(null);
      const { env, seen } = roomEnv();
      const res = await handleDocumentRoomRoutes(
        makeTestRouteContext('GET', '/api/documents/d1/ws?o=owner-uuid', {
          owner: null,
          headers: { Upgrade: 'websocket' },
          env: armed(env),
        }),
      );
      expect(res?.status).toBe(403);
      expect(seen).toHaveLength(0);
    });

    it('seats a correctly signed owner id', async () => {
      db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
      const sig = encodeURIComponent((await signOwnerId('sek', 'owner-uuid'))!);
      const { env, seen } = roomEnv();
      const res = await handleDocumentRoomRoutes(
        makeTestRouteContext('GET', `/api/documents/d1/ws?o=owner-uuid&os=${sig}`, {
          owner: null,
          headers: { Upgrade: 'websocket' },
          env: armed(env),
        }),
      );
      expect(res?.status).toBe(REACHED_ROOM);
      expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
    });
  });

  // The room's `p` spends the caller network's guessing budget like every
  // other share-code door (docs/specs/013-workspace/share-password.md).
  it('spends the network guessing budget on a room password, refusing once it is spent', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'view' });
    db.getDocumentSharePassword.mockResolvedValue('pbkdf2-sha256$1000$c2FsdA$aGFzaA');
    const limit = vi.fn(async () => ({ success: false }));
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234&p=guess', {
        owner: null,
        headers: { Upgrade: 'websocket', 'CF-Connecting-IP': '203.0.113.9' },
        env: Object.assign(env, { SHARE_RATE_LIMITER: { limit } }),
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
    expect(limit).toHaveBeenCalledWith({ key: 'share-pw:203.0.113.9' });
  });

  it('overwrites a client-supplied X-Verified-Role with the resolved one', async () => {
    // The role claim was already safe (it was always set), and that must not
    // regress either: a view-role link claiming 'edit' gets 'view'.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'view' });
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('view');
  });

  it('never reaches the room at all without a resolvable role', async () => {
    // The spoofed headers must not substitute for admission: no ticket, no
    // share code, not the owner.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('does not treat a TEAM document owner id in ?o= as the owner', async () => {
    // A team owner id is an account id every teammate can read, so the bare-`o`
    // leg is personal-only; team owners come in through the ticket.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'user_owner', teamId: 'team-1' });
    db.getShareLink.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?o=user_owner', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('refuses an account id in ?o= on a personal document', async () => {
    // An account id is readable by teammates (team member lists), unlike a
    // guest owner's server-minted UUID, so it is never a room credential:
    // signed-in owners come in through the ticket, as on REST (§4.1).
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'user_2abcDEF', teamId: null });
    db.getShareLink.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?o=user_2abcDEF', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('admits a ticket holder with the role the mint resolved', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'someone-else', teamId: 'team-1' });
    db.consumeWsTicket.mockResolvedValue({ role: 'edit', tabScope: null, shareCode: null });
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
  });

  it('lets the ticket answer for the session when the owner id rides beside it', async () => {
    // The ticket answers for the session: a visitor's ticket with the owner's id in `o` stays a visitor.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'view',
      tabScope: null,
      shareCode: 'CODE1234',
    });
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?t=TICKET-1&o=owner-uuid', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('view');
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
          scope: 'document',
          documentId: 'd1',
          folderId: null,
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
      personTag: await personTagFor('d1', 'user_1'),
      workbenchPairing: 'pair-1',
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
      personTag: null,
      workbenchPairing: null,
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
      personTag: null,
      workbenchPairing: null,
    });
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

  it("forwards a scoped link's tab and code on the share-code path", async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({
      documentId: 'd1',
      role: 'view',
      tabId: 't2',
      code: 'CODE1234',
    });
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
        owner: null,
        headers: SPOOFED_SCOPE,
        env,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Tab-Scope')).toBe('t2');
    expect(seen[0]!.headers.get('X-Verified-Share-Code')).toBe('CODE1234');
  });

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
    const { env, seen } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?o=owner-uuid', {
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
      personTag: null,
      workbenchPairing: null,
    });
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
        accountUserId: 'user_ann',
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

  it('stamps X-Verified-Person from the ticket, and empty on every other leg', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
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

    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'edit' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Person': 'forged' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Person')).toBe('');
  });

  it('stamps X-Verified-Workbench-Pairing from the ticket, and empty on every other leg', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'edit',
      tabScope: null,
      shareCode: null,
      personTag: 'tag1',
      workbenchPairing: 'pair-1',
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

    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'edit' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Workbench-Pairing': 'forged' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('');
  });

  // docs/specs/013-workspace/share-roles.md "Integrity": a Participant's ticket is a ticket like any other.
  it("mints a Participant's ticket with nothing beside it", async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.resolveDocumentGrant.mockResolvedValue({
      role: 'participate',
      tabScope: null,
      shareCode: 'C',
    });
    const minted = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(await minted!.json()).toEqual({ ticket: 'TICKET-1' });
    expect(db.createWsTicket).toHaveBeenCalledWith(
      expect.anything(),
      'd1',
      expect.objectContaining({ role: 'participate' }),
    );
  });

  it('stamps X-Verified-Document on every leg', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.consumeWsTicket.mockResolvedValue({
      role: 'participate',
      tabScope: null,
      shareCode: 'C',
      personTag: null,
      workbenchPairing: null,
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
    expect(ticketed.seen[0]!.headers.get('X-Verified-Document')).toBe('d1');

    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'participate' });
    const spoofed = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
        owner: null,
        headers: { Upgrade: 'websocket', 'X-Verified-Document': 'x' },
        env: spoofed.env,
      }),
    );
    expect(spoofed.seen[0]!.headers.get('X-Verified-Role')).toBe('participate');
    expect(spoofed.seen[0]!.headers.get('X-Verified-Document')).toBe('d1');
  });
});
