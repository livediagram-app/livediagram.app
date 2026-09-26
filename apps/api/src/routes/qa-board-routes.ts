// POST /api/diagrams/<id>/tabs/<tabId>/qa — one action on a Q&A board
// (docs/specs/012-collaboration/qa-board.md).
//
// The board is the one element whose state the SERVER owns: every add, vote
// and facilitator action, from every role, comes through here. That is what
// lets a view-link audience take part (the comment endpoint is the precedent
// for a view-role write, docs/specs/015-api/api.md) and what keeps one vote per person honest,
// because the voter id is derived from the authenticated caller rather than
// claimed by them.
//
// The write itself happens in the diagram's ROOM, not here: a room voting in
// the same second is forty read-modify-writes of one row, and worker requests
// run in parallel isolates, so the only place they can be put in single file
// is the one object every request for this diagram reaches. The room applies
// them one at a time (with a compare-and-swap as a second line against the
// editors' tab autosave) and broadcasts each result as a sequenced system op,
// so every peer, and the sender, converges on exactly what D1 holds.

import { isParticipantQaAction, parseQaAction, qaVoterId, type QaNote } from '@livediagram/diagram';
import { getDiagram, getParticipant } from '../db';
import type { QaWriteRequest } from '../qa-board-write';
import { badRequest, conflict, forbidden, json, notFound } from '../responses';
import { gateEdit, gateRead, requireOwner, type RouteContext } from './context';

export async function handleQaBoardRoute(ctx: RouteContext): Promise<Response | null> {
  const { request, env, segments } = ctx;
  if (!(
    segments.length === 6 &&
    segments[3] === 'tabs' &&
    segments[5] === 'qa' &&
    request.method === 'POST'
  )) {
    return null;
  }
  const id = segments[2]!;
  const tabId = segments[4]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const existing = await getDiagram(env, id);
  if (!existing) return notFound();

  let body: { elementId?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('invalid json');
  }
  const elementId = typeof body.elementId === 'string' ? body.elementId : null;
  if (!elementId) return badRequest('missing elementId');
  const action = parseQaAction(body.action);
  if (!action) return badRequest('invalid action');

  // The audience's two verbs are open to anyone who can read the diagram;
  // running the board needs edit rights. The facilitator baton is a
  // client-side rule on top (docs/specs/012-collaboration/facilitator.md): this route can't see which socket
  // holds it.
  const allowed = isParticipantQaAction(action)
    ? await gateRead(ctx, id, existing.ownerId, existing.teamId)
    : await gateEdit(ctx, id, existing.ownerId, existing.teamId);
  if (!allowed) return forbidden();

  // Server-derived identity: the voter id from the authenticated owner, the
  // author from their participant row (never from the request, docs/specs/012-collaboration/activity-and-audit.md).
  const voterId = await qaVoterId(owner, elementId);
  const author =
    action.type === 'add' && !action.anonymous
      ? await getParticipant(env, owner).then((p) =>
          p ? { name: p.name || 'Someone', color: p.color || '#94a3b8' } : null,
        )
      : null;

  // Hand the write to the diagram's room, which runs board writes one at a
  // time and broadcasts each result in order (DiagramRoom.handleQaWrite).
  const stub = env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(id));
  const res = await stub.fetch('https://room/qa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagramId: id,
      tabId,
      elementId,
      action,
      actor: { voterId, author, now: Date.now() },
    } satisfies QaWriteRequest),
  });
  if (res.status === 404) return notFound();
  if (res.status === 413) return json({ error: 'payload_too_large' }, { status: 413 });
  if (!res.ok) return conflict('qa_busy');
  const state = (await res.json()) as { notes: QaNote[]; rev: number };
  return json({ ...state, voterId });
}
