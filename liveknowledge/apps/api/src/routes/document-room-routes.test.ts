// Realtime-room admission: the ticket mint and the WebSocket upgrade, on the index's grants
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants").
//
// The upgrade is the one place in the worker that hands a Durable Object a TRUST HEADER: the room has no
// identities of its own, so it believes whatever arrives as `X-Verified-Role` (room-session.ts). What makes that
// safe is that this route OVERWRITES every name on every path, so a client's own copy can never survive, and
// that it reaches the room only with a grant the index signed for this document. These tests read the headers the
// stub actually received rather than trusting the route's intent.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The note a token's ticket leaves at liveworkspace (public-api-and-tokens.md "Revoking a token").
const { noteTokenRoom } = vi.hoisted(() => ({ noteTokenRoom: vi.fn(async () => {}) }));
vi.mock('../auth/workbench-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/workbench-session')>()),
  noteTokenRoom,
}));
import type { GrantClaims } from '@liveworkspace/index-client';
import { INDEX_GRANT_HEADER } from '@liveknowledge/api-schema';
import type { Env } from '../types';
import { setGrantVerifierForTests } from '../index-service';
import { sealRoomTicket } from '@liveworkspace/index-app';
import { makeTestRouteContext } from './test-route-context';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { personTagFor } from '../person-tag';
import type { RouteContext, WorkbenchContext } from './context';

const NOW = Math.floor(Date.now() / 1000);

// A stand-in for the index's signature: `G.<base64 claims>`. Anything else is forged.
function grantFor(claims: Partial<GrantClaims> & { item: string; sub: string }): string {
  const full: GrantClaims = {
    iss: 'index',
    aud: 'liveknowledge',
    level: 'edit',
    tab: null,
    team: null,
    iat: NOW,
    exp: NOW + 600,
    jti: 'j',
    ...claims,
  };
  return `G.${btoa(JSON.stringify(full))}`;
}

beforeEach(() => {
  setGrantVerifierForTests(async (token: string) => {
    if (!token.startsWith('G.')) return null;
    const claims = JSON.parse(atob(token.slice(2))) as GrantClaims;
    return claims.exp > Date.now() / 1000 ? claims : null;
  });
});
afterEach(() => setGrantVerifierForTests(null));

// Answers 204, not the 101 the real room sends: node refuses a 1xx Response. REACHING the room is the signal.
const REACHED_ROOM = 204;
function roomEnv() {
  const seen: Request[] = [];
  const env = {
    INDEX_KEY: 'test-index-key',
    DOCUMENT_ROOM: {
      idFromName: (name: string) => `id:${name}`,
      get: () => ({
        fetch: async (req: Request) => {
          seen.push(req);
          return new Response(null, { status: REACHED_ROOM });
        },
        // No Community post: a link visitor joins as any link's does.
        community: async () => null,
      }),
    },
  } as unknown as Env;
  return { env, seen };
}

// The upgrade as a hostile non-browser client sends it: every trust header pre-set.
const SPOOFED = {
  Upgrade: 'websocket',
  'X-Verified-Role': 'edit',
  'X-Verified-Tab-Scope': 'tab-evil',
  'X-Verified-Share-Code': 'evil',
  'X-Verified-Person': 'evil',
  'X-Verified-Account': '1',
  'X-Verified-Workbench-Pairing': 'evil',
  'X-Verified-Document': 'evil',
  'X-Verified-Grant-Exp': '99999999999',
  'X-Verified-Owner': 'user_evil',
  'X-Verified-Team': 'team_evil',
};

async function upgrade(env: Env, path: string) {
  return handleDocumentRoomRoutes(
    makeTestRouteContext('GET', path, { env, headers: SPOOFED, grant: null }),
  );
}

describe('WebSocket upgrade', () => {
  it("admits an owner's grant as an editor, overwriting every spoofed trust header", async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit', owner: 'user_o', team: 't1' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(res?.status).toBe(REACHED_ROOM);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Role')).toBe('edit');
    expect(h.get('X-Verified-Tab-Scope')).toBe('');
    expect(h.get('X-Verified-Share-Code')).toBe('');
    expect(h.get('X-Verified-Person')).toBe(await personTagFor('p1', 'user_a'));
    // A signed-in account: it may show its Google picture and see others' (profile-picture.md §2).
    expect(h.get('X-Verified-Account')).toBe('1');
    expect(h.get('X-Verified-Workbench-Pairing')).toBe('');
    expect(h.get('X-Verified-Document')).toBe('p1');
    expect(h.get('X-Verified-Grant-Exp')).toBe(String(NOW + 600));
    // The document's owner and team as the index has them, for the room's own copy.
    expect(h.get('X-Verified-Owner')).toBe('user_o');
    expect(h.get('X-Verified-Team')).toBe('t1');
  });

  it('never reaches the room without a ticket, with a forged one, or with a lapsed one', async () => {
    const { env, seen } = roomEnv();
    const lapsed = grantFor({ item: 'p1', sub: 'user_a', exp: NOW - 1 });
    for (const q of ['', '?t=forged', `?t=${encodeURIComponent(lapsed)}`]) {
      const res = await upgrade(env, `/api/documents/p1/ws${q}`);
      expect(res?.status, q).toBe(403);
    }
    expect(seen).toHaveLength(0);
  });

  it("refuses another document's grant", async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p2', sub: 'user_a' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it("forwards a link visitor's level, tab and code from the grant, with no person", async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'link:abc', level: 'view', tab: 'tab-2' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}&s=other`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Role')).toBe('view');
    expect(h.get('X-Verified-Tab-Scope')).toBe('tab-2');
    expect(h.get('X-Verified-Share-Code')).toBe('abc');
    expect(h.get('X-Verified-Person')).toBe('');
    expect(h.get('X-Verified-Account')).toBe('0');
  });

  // The room reads the share code and a verified collab key from the grant, so revoking the link closes its sockets.
  it("takes a guest's or a signed-in link opener's share code from the grant's link claim, never ?s=", async () => {
    for (const sub of ['guest_g', 'user_a']) {
      const { env, seen } = roomEnv();
      const t = grantFor({ item: 'p1', sub, level: 'participate', link: 'code1' });
      await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}&s=other`);
      const h = seen[0]!.headers;
      expect(h.get('X-Verified-Share-Code'), sub).toBe('code1');
      expect(h.get('X-Verified-Role')).toBe('participate');
      expect(h.get('X-Verified-Collab-Key')).toMatch(/^[0-9a-f]{32}$/);
      expect(h.get('X-Verified-Account')).toBe(sub === 'user_a' ? '1' : '0');
    }
  });

  it('names no share code for a grant without a link, whatever ?s= says', async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'guest_g', level: 'participate' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}&s=code1`);
    expect(seen[0]!.headers.get('X-Verified-Share-Code')).toBe('');
  });

  it('caps a workbench ticket at its sealed level and stamps its pairing', async () => {
    const { env, seen } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const ticket = await sealRoomTicket(env, grant, { pairing: 'wp-1', cap: 'view' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Role')).toBe('view');
    expect(h.get('X-Verified-Workbench-Pairing')).toBe('wp-1');
  });

  it('refuses a workbench ticket that was tampered with, or the old readable shape', async () => {
    const { env, seen } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const ticket = await sealRoomTicket(env, grant, { pairing: 'wp-1', cap: 'view' });
    const body = ticket.slice('rt2~'.length);
    const flipped = `rt2~${body.slice(0, 20)}${body[20] === 'A' ? 'B' : 'A'}${body.slice(21)}`;
    const forged = [
      flipped,
      `rt2~${body.slice(0, -4)}`,
      'rt2~',
      'rt2~!!!',
      // The old `<grant>~<pairing>~<cap>~<hmac>` shape, which showed the grant in plaintext.
      `${grant}~wp-1~edit~${'0'.repeat(64)}`,
    ];
    for (const bad of forged) {
      const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(bad)}`);
      expect(res?.status).toBe(403);
    }
    expect(seen).toHaveLength(0);
  });

  it('never shows a workbench session the grant it seals', async () => {
    const { env, seen } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const ticket = await sealRoomTicket(env, grant, { pairing: 'wp-1', cap: 'view' });
    expect(ticket.startsWith('rt2~')).toBe(true);
    expect(ticket).not.toContain(grant);
    for (const part of ticket.split(/[~.]/)) {
      const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(part)}`);
      expect(res?.status).toBe(403);
    }
    expect(seen).toHaveLength(0);
  });
});

describe('POST room-ticket', () => {
  it('answers the grant the editor sent as the ticket', async () => {
    const { env } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        headers: { [INDEX_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({ ticket: t });
  });

  it('404s (no existence leak) without a grant or anyone to ask for one', async () => {
    const { env } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', { env, grant: null }),
    );
    expect(res?.status).toBe(404);
  });

  it('seals a workbench session ticket to its pairing and cap', async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const workbench = {
      sessionId: 'ws-1',
      ownerId: 'user_a',
      tokenId: 'tok',
      pairingId: 'wp-1',
      tabId: null,
      origin: 'https://w.example',
      level: 'participate',
      expiresAt: Date.now() + 60_000,
      scope: 'document',
      documentId: 'p1',
    } as unknown as WorkbenchContext;
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        workbench,
        headers: { [INDEX_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    const { ticket } = await res!.json<{ ticket: string }>();
    expect(ticket.startsWith('rt2~')).toBe(true);
    expect(ticket).not.toContain(t);
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('participate');
    expect(seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('wp-1');
  });
});

// mcp-server.md "Live updates": the MCP view's view-only ticket (`?cap=view`). It admits at view whatever the token's
// owner may do, lapses with the grant sealed inside it (10 minutes), and is never the grant bare.
describe('a view-only ticket (the MCP view)', () => {
  const mint = (
    env: Env,
    grant: string | null,
    query = '?cap=view',
    token: RouteContext['token'] = null,
  ) =>
    handleDocumentRoomRoutes(
      makeTestRouteContext('POST', `/api/documents/p1/room-ticket${query}`, {
        env,
        headers: grant ? { [INDEX_GRANT_HEADER]: grant } : {},
        grant: null,
        ...(token ? { token, owner: 'user_a' } : {}),
      }),
    );

  for (const level of ['edit', 'participate', 'view'] as const) {
    it(`admits a ${level}-level token's owner at view only, with no adder key`, async () => {
      const { env, seen } = roomEnv();
      const grant = grantFor({ item: 'p1', sub: 'user_a', owner: 'user_a', level });
      const res = await mint(env, grant);
      expect(res?.status).toBe(200);
      const answer = await res!.json<{
        ticket: string;
        expiresAt: number;
        adderKey?: string;
        level: string;
      }>();
      expect(answer.ticket.startsWith('rt2~')).toBe(true);
      expect(answer.ticket).not.toContain(grant);
      // Short-lived: it lapses with the grant inside, which the answer names because its holder cannot read it.
      expect(answer.expiresAt).toBe((NOW + 600) * 1000);
      expect(answer.adderKey).toBeUndefined();
      expect(answer.level).toBe(level);
      await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(answer.ticket)}`);
      const h = seen[0]!.headers;
      expect(h.get('X-Verified-Role')).toBe('view');
      expect(h.get('X-Verified-Workbench-Pairing')).toBe('');
      expect(h.get('X-Verified-Adder') ?? '').toBe('');
      expect(h.get('X-Verified-Person')).toBe(await personTagFor('p1', 'user_a'));
    });
  }

  it('mints none once the grant is revoked: the index answers no grant', async () => {
    const { env } = roomEnv();
    const res = await mint(env, null);
    expect(res?.status).toBe(404);
  });

  it('refuses a ticket whose grant has lapsed, never reaching the room', async () => {
    const { env, seen } = roomEnv();
    const lapsed = grantFor({ item: 'p1', sub: 'user_a', exp: NOW - 1 });
    const ticket = await sealRoomTicket(env, lapsed, { pairing: null, cap: 'view' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it("refuses another document's view-only ticket", async () => {
    const { env, seen } = roomEnv();
    const other = grantFor({ item: 'p2', sub: 'user_a' });
    const ticket = await sealRoomTicket(env, other, { pairing: null, cap: 'view' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('refuses any cap but view, before asking for a grant', async () => {
    const { env } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a' });
    for (const query of ['?cap=edit', '?cap=participate', '?cap=']) {
      const res = await mint(env, grant, query);
      expect(res?.status, query).toBe(400);
      expect(await res!.json()).toMatchObject({ message: 'invalid_cap' });
    }
  });

  it('answers a read-only token’s level as view, over an edit grant', async () => {
    const { env } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', owner: 'user_a', level: 'edit' });
    const levelFor = async (readOnly: boolean) =>
      (
        await (await mint(env, grant, '?cap=view', { id: 'tok-1', readOnly }))!.json<{
          level: string;
        }>()
      ).level;
    expect(await levelFor(true)).toBe('view');
    expect(await levelFor(false)).toBe('edit');
  });

  it('says no lapse and no level on a ticket without the cap', async () => {
    const { env } = roomEnv();
    const res = await mint(env, grantFor({ item: 'p1', sub: 'user_a' }), '');
    const answer = await res!.json();
    expect(answer).not.toHaveProperty('level');
    expect(answer).not.toHaveProperty('expiresAt');
  });

  it('holds a workbench session that asks for one to view, on its own pairing', async () => {
    const { env, seen } = roomEnv();
    const workbench = {
      sessionId: 'ws-1',
      ownerId: 'user_a',
      tokenId: 'tok',
      pairingId: 'wp-1',
      tabId: null,
      origin: 'https://w.example',
      level: 'edit',
      expiresAt: Date.now() + 60_000,
      scope: 'document',
      documentId: 'p1',
    } as unknown as WorkbenchContext;
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket?cap=view', {
        env,
        workbench,
        headers: { [INDEX_GRANT_HEADER]: grantFor({ item: 'p1', sub: 'user_a' }) },
        grant: null,
      }),
    );
    const { ticket, level } = await res!.json<{ ticket: string; level: string }>();
    expect(level).toBe('edit');
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('view');
    expect(seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('wp-1');
  });
});

// docs/specs/015-api/public-api-and-tokens.md "Revoking a token": the token that minted a ticket rides in it, sealed,
// so the room can close its sockets when it is revoked; liveworkspace notes the room until the ticket lapses.
describe("a token's ticket", () => {
  const grant = () => grantFor({ item: 'p1', sub: 'user_a', owner: 'user_a', level: 'edit' });
  const mint = (env: Env, query = '', pending: Promise<unknown>[] = []) =>
    handleDocumentRoomRoutes(
      makeTestRouteContext('POST', `/api/documents/p1/room-ticket${query}`, {
        env,
        owner: 'user_a',
        token: { id: 'tok-1', readOnly: false },
        headers: { [INDEX_GRANT_HEADER]: grant() },
        grant: null,
        waitUntil: (p) => void pending.push(p),
      }),
    );

  it('seals the minting token into its ticket, notes the room, and the room hears it', async () => {
    noteTokenRoom.mockClear();
    const { env, seen } = roomEnv();
    const pending: Promise<unknown>[] = [];
    const res = await mint(env, '', pending);
    const { ticket } = await res!.json<{ ticket: string }>();
    expect(ticket.startsWith('rt2~')).toBe(true);
    expect(ticket).not.toContain('tok-1');
    expect(ticket).not.toContain(grant());
    await Promise.all(pending);
    expect(noteTokenRoom).toHaveBeenCalledWith(env, {
      ownerId: 'user_a',
      tokenId: 'tok-1',
      itemId: 'p1',
      until: (NOW + 600) * 1000,
    });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Api-Token')).toBe('tok-1');
    // No cap asked: the ticket admits at the grant's own level.
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
  });

  // An MCP server's live view: a view-only ticket through the token.
  it('seals the token into a view-only ticket too', async () => {
    noteTokenRoom.mockClear();
    const { env, seen } = roomEnv();
    const res = await mint(env, '?cap=view');
    const { ticket } = await res!.json<{ ticket: string }>();
    expect(noteTokenRoom).toHaveBeenCalledTimes(1);
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Api-Token')).toBe('tok-1');
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('view');
  });

  it('notes nothing when the caller resolves to no owner, but still seals the token', async () => {
    noteTokenRoom.mockClear();
    const { env, seen } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        owner: null,
        token: { id: 'tok-1', readOnly: false },
        headers: { [INDEX_GRANT_HEADER]: grant() },
        grant: null,
      }),
    );
    const { ticket } = await res!.json<{ ticket: string }>();
    expect(noteTokenRoom).not.toHaveBeenCalled();
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Api-Token')).toBe('tok-1');
  });

  it('waits for the note when the request has no waitUntil', async () => {
    noteTokenRoom.mockClear();
    const { env } = roomEnv();
    await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        owner: 'user_a',
        token: { id: 'tok-1', readOnly: false },
        headers: { [INDEX_GRANT_HEADER]: grant() },
        grant: null,
      }),
    );
    expect(noteTokenRoom).toHaveBeenCalledTimes(1);
  });

  it("stamps no token on a person's own ticket, over a spoofed header, and notes nothing", async () => {
    noteTokenRoom.mockClear();
    const { env, seen } = roomEnv();
    const t = grant();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        headers: { [INDEX_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    const { ticket } = await res!.json<{ ticket: string }>();
    expect(ticket).toBe(t);
    await handleDocumentRoomRoutes(
      makeTestRouteContext('GET', `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`, {
        env,
        headers: { ...SPOOFED, 'X-Verified-Api-Token': 'evil' },
        grant: null,
      }),
    );
    expect(seen[0]!.headers.get('X-Verified-Api-Token')).toBe('');
    expect(noteTokenRoom).not.toHaveBeenCalled();
  });
});
