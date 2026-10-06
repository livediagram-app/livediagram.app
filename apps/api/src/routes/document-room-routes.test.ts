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
    getDocumentSharePassword: vi.fn(async () => null),
    getShareLink: vi.fn(),
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

describe('WebSocket upgrade — trust headers', () => {
  it('overwrites a client-supplied X-Verified-Owner on a NON-owner upgrade', async () => {
    // A view-only share visitor of someone else's PERSONAL document, claiming
    // to be its owner. Owner-ness gates the facilitator baton (docs/specs/012-collaboration/facilitator.md): it
    // is what lets a session seize the baton off its current holder and end
    // someone else's turn, so a believed claim here is a real privilege.
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'edit' });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
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

  it('stamps X-Verified-Owner on a genuine owner upgrade', async () => {
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
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('1');
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
      expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('1');
    });
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
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('0');
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
    // A team owner id is a Clerk id every teammate can read, so the bare-`o`
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
    // A ticket admits a team MEMBER, not the owner — the owner bit stays off.
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('0');
  });
});

describe('POST room-ticket', () => {
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

  it('refuses a Community post link on the share-code upgrade', async () => {
    db.getDocumentMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({
      documentId: 'd1',
      role: 'view',
      tabId: null,
      code: 'POSTLINK',
      purpose: 'community',
    });
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=POSTLINK', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res!.status).toBe(403);
    expect(seen).toHaveLength(0);
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
      account: false,
      personTag: null,
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

  it('stamps X-Verified-Account from the ticket, and 0 on every other leg', async () => {
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

    db.getShareLink.mockResolvedValue({ documentId: 'd1', role: 'view' });
    const anonymous = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', '/api/documents/d1/ws?s=CODE1234', {
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

  it('stamps X-Verified-Person from the ticket, and empty on every other leg', async () => {
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
});
