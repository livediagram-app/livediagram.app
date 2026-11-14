// Realtime-room admission: the ticket mint and the WebSocket upgrade, on the index's grants
// (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants").
//
// The upgrade is the one place in the worker that hands a Durable Object a TRUST HEADER: the room has no
// identities of its own, so it believes whatever arrives as `X-Verified-Role` (room-session.ts). What makes that
// safe is that this route OVERWRITES every name on every path, so a client's own copy can never survive, and
// that it reaches the room only with a grant the index signed for this document. These tests read the headers the
// stub actually received rather than trusting the route's intent.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import type { Env } from '../types';
import { setGrantVerifierForTests } from '../index-service';
import { ITEM_GRANT_HEADER, sealRoomTicket } from '@liveworkspace/index-app';
import { adderKeyFor } from '../adder-key';
import { makeTestRouteContext } from './test-route-context';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { personTagFor } from '../person-tag';
import { getParticipant } from '../liveworkspace/profiles';

// The profiles liveworkspace keeps (docs/specs/014-identity/auth-and-guest-access.md "Presence names"), by owner id.
const profiles = vi.hoisted(() => new Map<string, string>());
vi.mock('../liveworkspace/profiles', () => ({
  getParticipant: vi.fn(async (_env: unknown, id: string) => {
    const name = profiles.get(id);
    return name ? { id, name, color: '#123456', createdAt: 0 } : null;
  }),
}));

const NOW = Math.floor(Date.now() / 1000);

// A stand-in for the index's signature: `G.<base64 claims>`. Anything else is forged.
function grantFor(claims: Partial<GrantClaims> & { item: string; sub: string }): string {
  const full: GrantClaims = {
    iss: 'index',
    aud: 'livehuddle',
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
afterEach(() => {
  setGrantVerifierForTests(null);
  profiles.clear();
  vi.mocked(getParticipant).mockClear();
});

// Answers 204, not the 101 the real room sends: node refuses a 1xx Response. REACHING the room is the signal.
const REACHED_ROOM = 204;
// `post`: the canvas's Community post's link, as its room answers it.
function roomEnv(post: { code: string; open: boolean } | null = null) {
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
        community: async () => post,
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
  'X-Verified-Document': 'evil',
  'X-Verified-Grant-Exp': '99999999999',
  'X-Verified-Owner': '1',
  'X-Verified-Adder': 'forged',
  'X-Verified-Item-Owner': 'evil',
  'X-Verified-Item-Team': 'evil',
  'X-Verified-Account': '1',
  'X-Verified-Name': 'The%20Host',
};

async function upgrade(env: Env, path: string) {
  return handleDocumentRoomRoutes(
    makeTestRouteContext('GET', path, { env, headers: SPOOFED, grant: null }),
  );
}

describe('WebSocket upgrade', () => {
  it('answers 410 document_trashed, never reaching the room, for a grant on a canvas in the Trash', async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit', trashed: true });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(res?.status).toBe(410);
    expect(seen).toHaveLength(0);
  });

  it("admits an owner's grant as an editor, overwriting every spoofed trust header", async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(res?.status).toBe(REACHED_ROOM);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Role')).toBe('edit');
    expect(h.get('X-Verified-Tab-Scope')).toBe('');
    expect(h.get('X-Verified-Share-Code')).toBe('');
    expect(h.get('X-Verified-Person')).toBe(await personTagFor('p1', 'user_a'));
    // An account's session: it may publish a Google picture and is sent others'.
    expect(h.get('X-Verified-Account')).toBe('1');
    expect(h.get('X-Verified-Document')).toBe('p1');
    expect(h.get('X-Verified-Grant-Exp')).toBe(String(NOW + 600));
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
    // No account: never a Google picture, over the spoofed header.
    expect(h.get('X-Verified-Account')).toBe('0');
  });

  it('takes the share code a signed-in link opener names on ?s=', async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'guest_g', level: 'participate' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}&s=code1`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Share-Code')).toBe('code1');
    expect(h.get('X-Verified-Role')).toBe('participate');
  });

  // The shared ticket's level cap still holds, though livehuddle has no workbenches to seal one
  // (docs/specs/002-project-scope/not-in-livehuddle.md).
  it('caps a ticket sealed with a cap at that level', async () => {
    const { env, seen } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const ticket = await sealRoomTicket(env, grant, { pairing: 'wp-1', cap: 'view' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Role')).toBe('view');
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
        headers: { [ITEM_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    expect(res?.status).toBe(200);
    expect(await res!.json()).toEqual({ ticket: t });
  });

  it('answers 410 document_trashed, and no ticket, for a canvas its grant says is in the Trash', async () => {
    const { env } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'edit', trashed: true });
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        headers: { [ITEM_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    expect(res?.status).toBe(410);
    expect(await res!.json()).toEqual({ error: 'document_trashed' });
  });

  it('404s (no existence leak) without a grant or anyone to ask for one', async () => {
    const { env } = roomEnv();
    const res = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', { env, grant: null }),
    );
    expect(res?.status).toBe(404);
  });
});

// The headers only this app's room reads: who owns the canvas (the facilitator baton), a Participant's adder key,
// the caller's network (vote integrity) and the canvas's owner and team as the index has them.
describe("WebSocket upgrade: the room's own trust headers", () => {
  it("seats the owner only from a grant whose person is the canvas's owner", async () => {
    const { env, seen } = roomEnv();
    const own = grantFor({ item: 'p1', sub: 'user_a', owner: 'user_a', team: 'team-1' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(own)}`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Owner')).toBe('1');
    expect(h.get('X-Verified-Item-Owner')).toBe('user_a');
    expect(h.get('X-Verified-Item-Team')).toBe('team-1');
    // A teammate, and a link visitor, are '0', not absent: the room reads `=== '1'`, so the client's '1' is replaced.
    for (const sub of ['user_b', 'link:abc']) {
      const t = grantFor({ item: 'p1', sub, owner: 'user_a' });
      await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
      expect(seen.at(-1)!.headers.get('X-Verified-Owner'), sub).toBe('0');
    }
  });

  it("stamps a Participant's adder key, and nobody else's", async () => {
    const { env, seen } = roomEnv();
    const participant = grantFor({ item: 'p1', sub: 'guest_g', level: 'participate' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(participant)}`);
    expect(seen[0]!.headers.get('X-Verified-Adder')).toBe(await adderKeyFor('p1', 'guest_g'));
    const editor = grantFor({ item: 'p1', sub: 'guest_g', level: 'edit' });
    const visitor = grantFor({ item: 'p1', sub: 'link:abc', level: 'participate' });
    for (const t of [editor, visitor]) {
      await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
      expect(seen.at(-1)!.headers.get('X-Verified-Adder')).toBe('');
    }
  });
});

// docs/specs/025-community/community.md: a Community visitor never joins the author's room.
describe('a Community post link', () => {
  it("never reaches the room through the post's link", async () => {
    const { env, seen } = roomEnv({ code: 'POSTLINK', open: true });
    const t = grantFor({ item: 'p1', sub: 'link:POSTLINK', level: 'view' });
    const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('mints no ticket for it, and answers a Participant their adder key', async () => {
    const { env } = roomEnv({ code: 'POSTLINK', open: true });
    const post = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        headers: {
          [ITEM_GRANT_HEADER]: grantFor({ item: 'p1', sub: 'link:POSTLINK', level: 'view' }),
          'X-Share-Code': 'POSTLINK',
        },
        grant: null,
      }),
    );
    expect(post?.status).toBe(403);
    expect(await post!.json()).toEqual({ error: 'community_link' });

    const t = grantFor({ item: 'p1', sub: 'guest_g', level: 'participate' });
    const minted = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-ticket', {
        env,
        headers: { [ITEM_GRANT_HEADER]: t },
        grant: null,
      }),
    );
    expect(await minted!.json()).toEqual({
      ticket: t,
      adderKey: await adderKeyFor('p1', 'guest_g'),
    });
  });
});

// docs/specs/014-identity/auth-and-guest-access.md "Presence names" (Work Tracker 797): the room's name for a person is
// their profile's, stamped here; a name the client sends, as a header or in its hello, is never believed.
describe('the presence name', () => {
  it("stamps a person's profile name on the upgrade, over a spoofed one, URI-encoded", async () => {
    const { env, seen } = roomEnv();
    profiles.set('user_a', 'Zoë Ng');
    const t = grantFor({ item: 'p1', sub: 'user_a', level: 'participate' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}`);
    expect(seen[0]!.headers.get('X-Verified-Name')).toBe(encodeURIComponent('Zoë Ng'));
    // A person with no profile, and a link visitor, carry none: the room gives them a guest name.
    for (const sub of ['guest_new', 'link:abc']) {
      const g = grantFor({ item: 'p1', sub, level: 'view' });
      await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(g)}`);
      expect(seen.at(-1)!.headers.get('X-Verified-Name'), sub).toBe('');
    }
  });

  // The room's side of the door: it answers how many sessions it renamed.
  function nameEnv() {
    const relayed: { url: string; body: unknown }[] = [];
    const env = {
      INDEX_KEY: 'test-index-key',
      DOCUMENT_ROOM: {
        idFromName: (name: string) => `id:${name}`,
        get: () => ({
          fetch: async (input: Request | string, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.url;
            relayed.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
            return Response.json({ renamed: 1 });
          },
          community: async () => null,
        }),
      },
    } as unknown as Env;
    return { env, relayed };
  }
  const rename = (env: Env, grant: string) =>
    handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-name', {
        env,
        headers: { [ITEM_GRANT_HEADER]: grant },
        grant: null,
      }),
    );

  it('shows a renamed person their fresh profile name in the room, at every share level', async () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      const { env, relayed } = nameEnv();
      profiles.set('guest_g', 'Grace');
      const res = await rename(env, grantFor({ item: 'p1', sub: 'guest_g', level }));
      expect(res?.status, level).toBe(200);
      expect(await res!.json()).toEqual({ name: 'Grace' });
      expect(getParticipant).toHaveBeenLastCalledWith(env, 'guest_g', { fresh: true });
      expect(relayed).toEqual([
        {
          url: 'https://room/presence-name',
          body: { personTag: await personTagFor('p1', 'guest_g'), name: 'Grace' },
        },
      ]);
    }
  });

  it('relays nothing for a link visitor or a person with no profile name', async () => {
    const { env, relayed } = nameEnv();
    for (const sub of ['link:abc', 'guest_nobody']) {
      const res = await rename(env, grantFor({ item: 'p1', sub, level: 'edit' }));
      expect(await res!.json(), sub).toEqual({ name: null });
    }
    expect(relayed).toEqual([]);
  });

  it('still answers the name when the room cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = {
      INDEX_KEY: 'test-index-key',
      DOCUMENT_ROOM: {
        idFromName: (name: string) => `id:${name}`,
        get: () => ({ fetch: async () => new Response('down', { status: 500 }) }),
      },
    } as unknown as Env;
    profiles.set('user_a', 'Ada');
    const res = await rename(env, grantFor({ item: 'p1', sub: 'user_a' }));
    expect(await res!.json()).toEqual({ name: 'Ada' });
    expect(warn).toHaveBeenCalledWith('[presence-name] room_unavailable');
    warn.mockRestore();
  });

  it('answers 404 with no grant, 410 for a canvas in the Trash, 403 for a Community link', async () => {
    const { env, relayed } = nameEnv();
    profiles.set('user_a', 'Ada');
    const none = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-name', { env, grant: null }),
    );
    expect(none?.status).toBe(404);
    const trashed = await rename(env, grantFor({ item: 'p1', sub: 'user_a', trashed: true }));
    expect(trashed?.status).toBe(410);
    const community = roomEnv({ code: 'POSTLINK', open: true });
    const post = await handleDocumentRoomRoutes(
      makeTestRouteContext('POST', '/api/documents/p1/room-name', {
        env: community.env,
        headers: {
          [ITEM_GRANT_HEADER]: grantFor({ item: 'p1', sub: 'link:POSTLINK', level: 'view' }),
          'X-Share-Code': 'POSTLINK',
        },
        grant: null,
      }),
    );
    expect(post?.status).toBe(403);
    expect(relayed).toEqual([]);
  });
});
