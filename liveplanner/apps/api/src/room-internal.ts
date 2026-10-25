// The room's internal endpoints (docs/specs/015-api/api.md, Realtime model): calls the api worker makes into the
// Durable Object after a privileged action. Not exposed publicly: the worker stubs the DO via
// `env.PLAN_ROOM.get(...).fetch(...)`, which never traverses Cloudflare's edge, so these paths are implicitly
// internal and their bodies trusted. Every other request is a WebSocket upgrade, which the room answers itself.
import { opForTheWire } from '@liveplanner/project';
import { parseAccessCloseMatch, type AccessCloseMatch } from './room-access';

/** The room's surface the internal endpoints act on. */
export type InternalRoom = {
  broadcastSystemOp: (op: unknown) => void;
  broadcastOrderedSystemOp: (op: unknown) => void;
  closeSessionsOfChangedLink: (op: unknown) => void;
  clearAgentsFor: (op: unknown) => Promise<void>;
  closeSessionsForAccessChange: (close: AccessCloseMatch) => void;
  purge: () => Promise<void>;
  handleAgentPresence: (request: Request, url: URL) => Promise<Response>;
  sequenceMutation: (from: string, op: unknown) => number;
  readSelections: (tabId: string, person: string) => Promise<unknown>;
  readLedger: (tabId: string) => Promise<unknown>;
  epoch: () => string;
};

// The room ops the worker originates through /mutation: a view-role visitor's comment, an agent
// changeset, a tab rename (docs/specs/024-agents/agent-changesets.md).
const WORKER_MUTATION_KINDS = new Set(['el-delta', 'changeset', 'tab-meta', 'project-meta']);

/** Answer an internal endpoint, or null when the request is none of them. */
export async function answerInternal(
  room: InternalRoom,
  request: Request,
  url: URL,
): Promise<Response | null> {
  // Internal fan-out endpoint, called by the api worker after a
  // privileged action that every connected client should learn
  // about immediately (e.g. share-link revocation). Not exposed
  // publicly: the worker stubs the DO via `env.PLAN_ROOM.get(...)
  // .fetch(...)`, which never traverses Cloudflare's edge, so the
  // path is implicitly internal. Body is `{ op: RoomOp }` and the
  // op gets broadcast with a synthetic `from: 'system'` so the
  // frontend handler can distinguish it from a peer's op.
  if (request.method === 'POST' && url.pathname === '/broadcast') {
    const body = await readBody(request);
    const op = body?.op;
    if (!op) return new Response('missing op', { status: 400 });
    // `ordered` asks for a seq + a catch-up log slot: a system op that
    // changes the project (an item write, docs/specs/026-plan/items.md) must replay to a
    // peer whose socket blipped, the same as a peer's own mutation would.
    if (body.ordered === true) room.broadcastOrderedSystemOp(op);
    else room.broadcastSystemOp(op);
    room.closeSessionsOfChangedLink(op);
    await room.clearAgentsFor(op);
    return new Response(null, { status: 204 });
  }
  // Internal, like /broadcast: an access change the api made (a share password set, a member
  // leaving their team) ends the sessions it affects, and tells nobody else
  // (docs/specs/015-api/api.md "Access changes end the sessions they affect").
  if (request.method === 'POST' && url.pathname === '/close-sessions') {
    const close = parseAccessCloseMatch(await readBody(request));
    if (!close) return new Response('unknown match', { status: 400 });
    room.closeSessionsForAccessChange(close);
    return new Response(null, { status: 204 });
  }
  // Internal, like /broadcast: the project was removed for good (a Trash purge, Take Offline, account
  // deletion), so everything the room kept about it goes too (docs/specs/015-api/api.md "Purging a room").
  if (request.method === 'POST' && url.pathname === '/purge') {
    await room.purge();
    return new Response(null, { status: 204 });
  }
  if (url.pathname === '/presence' && (request.method === 'PUT' || request.method === 'DELETE')) {
    return room.handleAgentPresence(request, url);
  }
  // Internal: a project change the WORKER made (docs/specs/012-collaboration/collab-race-hardening.md), relayed into the
  // ordered stream like a peer's mutation: sequenced, logged for catch-up,
  // sent to everybody. A view-role visitor's comment is written by the api,
  // not by a client socket (the room refuses view-role mutations), so
  // without this editors never saw it and their next save erased it. An agent
  // changeset, a tab rename (tab-meta) and a project rename (project-meta) the api applied
  // (docs/specs/024-agents/agent-changesets.md)
  // take the same path, one seq and one catch-up slot each whatever their size.
  if (request.method === 'POST' && url.pathname === '/mutation') {
    const op = (await readBody(request))?.op;
    const kind = (op as { kind?: unknown } | undefined)?.kind;
    if (typeof kind !== 'string' || !WORKER_MUTATION_KINDS.has(kind)) {
      return new Response('bad op', { status: 400 });
    }
    room.sequenceMutation('system', opForTheWire(op));
    return new Response(null, { status: 204 });
  }
  // Internal: a tab's collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3), which the
  // api merges into a save before writing D1 so a stale snapshot can't
  // erase an answer the room has seen. Same trust argument as /broadcast:
  // only the worker can reach it.
  // Internal: every selection on a tab, for the api's held check
  // (docs/specs/024-agents/agent-changesets.md "Held elements"). Same trust argument as
  // /broadcast: only the worker can reach it.
  if (request.method === 'GET' && url.pathname === '/selections') {
    const tabId = url.searchParams.get('tab');
    if (!tabId) return new Response('missing tab', { status: 400 });
    const selections = await room.readSelections(tabId, url.searchParams.get('person') ?? '');
    return Response.json({ selections });
  }
  if (request.method === 'GET' && url.pathname === '/ledger') {
    const tabId = url.searchParams.get('tab');
    if (!tabId) return new Response('missing tab', { status: 400 });
    // The saver's cursor is only meaningful in this room's epoch. From any
    // other, we can't tell what it has seen, so merge nothing.
    if (url.searchParams.get('epoch') !== room.epoch()) {
      return Response.json({ elements: {} });
    }
    return Response.json(await room.readLedger(tabId));
  }
  return null;
}

// The JSON body of an internal worker call (`{ op, ordered? }`), or null
// when it doesn't parse as an object.
async function readBody(request: Request): Promise<{ op?: unknown; ordered?: unknown } | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}
