// Realtime-room admission: the ticket mint and the WebSocket upgrade, on the index's grants
// (liveworkspace/docs/one-explorer-contracts.md "Grants").
//
// The upgrade is the one place in the worker that hands a Durable Object a TRUST HEADER: the room has no
// identities of its own, so it believes whatever arrives as `X-Verified-Role` (room-session.ts). What makes that
// safe is that this route OVERWRITES every name on every path, so a client's own copy can never survive, and
// that it reaches the room only with a grant the index signed for this document. These tests read the headers the
// stub actually received rather than trusting the route's intent.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import { INDEX_GRANT_HEADER } from '@livedocuments/api-schema';
import type { Env } from '../types';
import { setGrantVerifierForTests } from '../index-service';
import { sealRoomTicket } from '../room-ticket';
import { makeTestRouteContext } from './test-route-context';
import { handleDocumentRoomRoutes } from './document-room-routes';
import { personTagFor } from '../person-tag';
import type { WorkbenchContext } from './context';

const NOW = Math.floor(Date.now() / 1000);

// A stand-in for the index's signature: `G.<base64 claims>`. Anything else is forged.
function grantFor(claims: Partial<GrantClaims> & { item: string; sub: string }): string {
  const full: GrantClaims = {
    iss: 'index',
    aud: 'livedocuments',
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
  'X-Verified-Workbench-Pairing': 'evil',
  'X-Verified-Document': 'evil',
  'X-Verified-Grant-Exp': '99999999999',
};

async function upgrade(env: Env, path: string) {
  return handleDocumentRoomRoutes(
    makeTestRouteContext('GET', path, { env, headers: SPOOFED, grant: null }),
  );
}

describe('WebSocket upgrade', () => {
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
    expect(h.get('X-Verified-Workbench-Pairing')).toBe('');
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
  });

  it('takes the share code a signed-in link opener names on ?s=', async () => {
    const { env, seen } = roomEnv();
    const t = grantFor({ item: 'p1', sub: 'guest_g', level: 'participate' });
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(t)}&s=code1`);
    const h = seen[0]!.headers;
    expect(h.get('X-Verified-Share-Code')).toBe('code1');
    expect(h.get('X-Verified-Role')).toBe('participate');
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

  it('refuses a workbench ticket whose pairing or cap was changed', async () => {
    const { env, seen } = roomEnv();
    const grant = grantFor({ item: 'p1', sub: 'user_a', level: 'edit' });
    const ticket = await sealRoomTicket(env, grant, { pairing: 'wp-1', cap: 'view' });
    const [g, , , mac] = ticket.split('~');
    for (const forged of [`${g}~wp-2~view~${mac}`, `${g}~wp-1~edit~${mac}`]) {
      const res = await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(forged)}`);
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
    const { ticket } = (await res!.json()) as { ticket: string };
    expect(ticket.split('~')).toHaveLength(4);
    await upgrade(env, `/api/documents/p1/ws?t=${encodeURIComponent(ticket)}`);
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('participate');
    expect(seen[0]!.headers.get('X-Verified-Workbench-Pairing')).toBe('wp-1');
  });
});
