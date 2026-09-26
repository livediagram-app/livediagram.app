// Realtime-room admission: the ticket mint and the WebSocket upgrade.
//
// The upgrade is the one place in the worker that hands a Durable Object a
// TRUST HEADER — the DO has no identities of its own, so it believes whatever
// arrives as `X-Verified-Role` / `X-Verified-Owner` (diagram-room.ts). What
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
    getDiagramMeta: vi.fn(),
    getDiagramSharePassword: vi.fn(async () => null),
    getShareLink: vi.fn(),
  },
}));
vi.mock('../db', () => db);

const { gates } = vi.hoisted(() => ({
  gates: { canEditDiagram: vi.fn(), canReadDiagram: vi.fn() },
}));
vi.mock('../auth/diagram-access', () => gates);

import { makeTestRouteContext } from './test-route-context';
import { handleDiagramRoomRoutes } from './diagram-room-routes';

// A DIAGRAM_ROOM binding that records the Request it was handed, so a test can
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
    DIAGRAM_ROOM: {
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
  db.getDiagramSharePassword.mockResolvedValue(null);
});

describe('WebSocket upgrade — trust headers', () => {
  it('overwrites a client-supplied X-Verified-Owner on a NON-owner upgrade', async () => {
    // A view-only share visitor of someone else's PERSONAL diagram, claiming
    // to be its owner. Owner-ness gates the facilitator baton (docs/specs/012-collaboration/facilitator.md): it
    // is what lets a session seize the baton off its current holder and end
    // someone else's turn, so a believed claim here is a real privilege.
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ diagramId: 'd1', role: 'edit' });
    const { env, seen } = roomEnv();
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws?s=CODE1234', {
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
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    const { env, seen } = roomEnv();
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws?o=owner-uuid', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(REACHED_ROOM);
    expect(seen[0]!.headers.get('X-Verified-Owner')).toBe('1');
    expect(seen[0]!.headers.get('X-Verified-Role')).toBe('edit');
  });

  it('overwrites a client-supplied X-Verified-Role with the resolved one', async () => {
    // The role claim was already safe (it was always set), and that must not
    // regress either: a view-role link claiming 'edit' gets 'view'.
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue({ diagramId: 'd1', role: 'view' });
    const { env, seen } = roomEnv();
    await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws?s=CODE1234', {
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
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'owner-uuid', teamId: null });
    db.getShareLink.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws', {
        owner: null,
        headers: SPOOFED,
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('does not treat a TEAM diagram owner id in ?o= as the owner', async () => {
    // A team owner id is a Clerk id every teammate can read, so the bare-`o`
    // leg is personal-only; team owners come in through the ticket.
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'user_owner', teamId: 'team-1' });
    db.getShareLink.mockResolvedValue(null);
    const { env, seen } = roomEnv();
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws?o=user_owner', {
        owner: null,
        headers: { Upgrade: 'websocket' },
        env,
      }),
    );
    expect(res?.status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it('admits a ticket holder with the role the mint resolved', async () => {
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'someone-else', teamId: 'team-1' });
    db.consumeWsTicket.mockResolvedValue('edit');
    const { env, seen } = roomEnv();
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('GET', '/api/diagrams/d1/ws?t=TICKET-1', {
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
  it('mints an edit ticket when the edit gate passes', async () => {
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'owner-1', teamId: null });
    gates.canEditDiagram.mockResolvedValue(true);
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('POST', '/api/diagrams/d1/room-ticket', { owner: 'owner-1' }),
    );
    expect(await res!.json()).toEqual({ ticket: 'TICKET-1' });
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', 'edit');
  });

  it('falls back to a view ticket when only the read gate passes', async () => {
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.canEditDiagram.mockResolvedValue(false);
    gates.canReadDiagram.mockResolvedValue(true);
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('POST', '/api/diagrams/d1/room-ticket', { owner: 'visitor' }),
    );
    expect(res!.status).toBe(200);
    expect(db.createWsTicket).toHaveBeenCalledWith(expect.anything(), 'd1', 'view');
  });

  it('404s (no existence leak) and mints nothing when both gates deny', async () => {
    db.getDiagramMeta.mockResolvedValue({ ownerId: 'other', teamId: null });
    gates.canEditDiagram.mockResolvedValue(false);
    gates.canReadDiagram.mockResolvedValue(false);
    const res = await handleDiagramRoomRoutes(
      makeTestRouteContext('POST', '/api/diagrams/d1/room-ticket', { owner: 'stranger' }),
    );
    expect(res!.status).toBe(404);
    expect(db.createWsTicket).not.toHaveBeenCalled();
  });
});
