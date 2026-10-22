// `PUT` and `DELETE /api/documents/:id/tabs/:tabId/presence` (docs/specs/024-agents/agent-presence.md "Presence",
// blueprint "REST"): an agent shows itself on a tab with a status line and focus, without holding a socket. Token
// callers only, through the participation gate; the room keeps the entry and expires it on its ttl.

import {
  parseAgentPresenceRequest,
  type AgentPresenceResult,
  type ShareRole,
} from '@livediagram/api-schema';
import { resolveRef } from '@livediagram/document';
import { buildViewModel } from '@livediagram/document-views';
import { frontDoorOf } from '../changesets/front-door';
import { getDocument, getParticipant, getTab } from '../db';
import { personTagFor } from '../person-tag';
import { json, noContent, notFound } from '../responses';
import { deleteAgentPresence, putAgentPresence, RoomUnavailableError } from '../room-client';
import { reportServerEvent } from '../server-telemetry';
import type { TabDTO } from '../types';
import { logRefusal } from './refusal-log';
import {
  deniedOnTab,
  gateEdit,
  gateRead,
  missingDocument,
  shareCodeOf,
  type RouteContext,
} from './context';

const refuse = (status: number, body: Record<string, unknown>) => json(body, { status });

const roomUnavailable = (documentId: string, tabId: string, err: unknown) => {
  console.warn('[agent-presence] room unavailable', { documentId, tabId, error: String(err) });
  return refuse(503, { error: 'room_unavailable' });
};

// Focus refs resolved against the tab's view refs (PR8): full ids, de-duplicated, in request order; a ref matching
// nothing or several is refused as the views refuse it.
function resolveFocus(tab: TabDTO, refs: readonly string[]): string[] | Response {
  const table = buildViewModel(tab).refs;
  const ids: string[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const found = resolveRef(ref, table);
    if (found.kind === 'ambiguous')
      return refuse(400, {
        error: 'focus_ambiguous',
        ref,
        candidates: found.candidates.map((id) => table.refOf(id)),
      });
    if (found.kind === 'not-found') missing.push(ref);
    else if (!ids.includes(found.id)) ids.push(found.id);
  }
  return missing.length > 0 ? refuse(400, { error: 'focus_not_found', refs: missing }) : ids;
}

// Every refusal of a presence request is logged here, once, with its code.
export async function handleAgentPresenceRoute(ctx: RouteContext): Promise<Response | null> {
  const res = await presenceRoute(ctx);
  if (res && res.status >= 400)
    await logRefusal('[agent-presence] refused', res, {
      documentId: ctx.segments[2],
      tabId: ctx.segments[4],
      method: ctx.request.method,
      tokenId: ctx.token?.id ?? null,
    });
  return res;
}

async function presenceRoute(ctx: RouteContext): Promise<Response | null> {
  const { segments, request, env } = ctx;
  if (segments.length !== 6 || segments[3] !== 'tabs' || segments[5] !== 'presence') return null;
  if (request.method !== 'PUT' && request.method !== 'DELETE') return null;
  const documentId = segments[2]!;
  const tabId = segments[4]!;
  const token = ctx.token;
  const owner = ctx.resolveOwner();
  if (!token || !owner) return refuse(403, { error: 'presence_requires_token' });
  const doc = await getDocument(env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  if (!(await gateRead(ctx, documentId, doc.ownerId, doc.teamId, tabId)))
    return deniedOnTab(ctx, doc);

  // A clear skips the tab check, so an entry on a deleted tab can still go (PR34).
  if (request.method === 'DELETE') {
    try {
      await deleteAgentPresence(env, documentId, token.id, tabId);
    } catch (err) {
      if (err instanceof RoomUnavailableError) return roomUnavailable(documentId, tabId, err);
      throw err;
    }
    return noContent();
  }

  const tab = await getTab(env, documentId, tabId);
  if (!tab) return notFound();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return refuse(400, { error: 'invalid_json' });
  }
  const parsed = parseAgentPresenceRequest(raw);
  if (!parsed.ok) return refuse(400, { error: parsed.code });
  const focus = resolveFocus(tab, parsed.value.focus);
  if (focus instanceof Response) return focus;
  // The entry's name and colour are the owner's (I2); its level the one the gates resolve for the token (PR27).
  const participant = await getParticipant(env, owner);
  const role: ShareRole =
    !token.readOnly && (await gateEdit(ctx, documentId, doc.ownerId, doc.teamId, tabId))
      ? 'edit'
      : 'view';
  let answer: Awaited<ReturnType<typeof putAgentPresence>>;
  try {
    answer = await putAgentPresence(env, {
      documentId,
      tokenId: token.id,
      tabId,
      personTag: await personTagFor(documentId, owner),
      shareCode: shareCodeOf(request),
      name: participant?.name ?? 'Anonymous',
      color: participant?.color ?? '#94a3b8',
      role,
      status: parsed.value.status,
      focus,
      ttlMs: parsed.value.ttlMs,
      mode: 'set',
    });
  } catch (err) {
    if (err instanceof RoomUnavailableError) return roomUnavailable(documentId, tabId, err);
    throw err;
  }
  if (!answer.ok) {
    console.warn('[agent-presence] room full', { documentId, tabId, tokenId: token.id });
    return refuse(409, { error: answer.error });
  }
  console.info('[agent-presence] set', {
    documentId,
    tabId,
    tokenId: token.id,
    created: answer.created,
  });
  if (answer.created)
    ctx.waitUntil?.(reportServerEvent(env, 'Agent', 'Present', frontDoorOf(request)));
  const presence: AgentPresenceResult = {
    tabId,
    status: parsed.value.status,
    focus,
    expiresAt: answer.expiresAt,
  };
  return json({ presence });
}
