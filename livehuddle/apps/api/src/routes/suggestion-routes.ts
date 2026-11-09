// The Suggestion Box's routes (docs/specs/009-elements/team-pieces.md "Suggestion Box", "The wire"): drop a note
// (Participants and Editors), read a box's notes and remove one (Editors only). A note is stored beside the content as
// its text and its UTC day: nothing about who dropped it is written, logged, relayed to the room or sent to the index,
// so its readers never learn who wrote it.

import { logRefusal } from '@liveworkspace/api-kit/refusal-log';
import type { SuggestionsResponse } from '@livehuddle/api-schema';
import { SUGGESTION_TEXT_MAX, SUGGESTIONS_MAX } from '@livehuddle/document';
import { deleteSuggestion, getDocument, getTab, insertSuggestion, listSuggestions } from '../db';
import { badRequest, conflict, json, methodNotAllowed, noContent, notFound } from '../responses';
import {
  deniedEdit,
  deniedParticipate,
  gateEdit,
  gateParticipate,
  missingDocument,
  readBody,
  requireOwner,
  type DocumentRouteContext,
} from './context';

type Doc = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

// The document, when the caller may reach this door on the tab: `participate` to drop, `edit` to read and remove.
async function admitted(
  ctx: DocumentRouteContext,
  id: string,
  tabId: string,
  level: 'participate' | 'edit',
): Promise<Doc | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, id);
  if (!doc) return missingDocument(ctx, id);
  if (level === 'participate') {
    if (!(await gateParticipate(ctx, id, doc.ownerId, doc.teamId, tabId)))
      return deniedParticipate(ctx, doc, tabId);
  } else if (!(await gateEdit(ctx, id, doc.ownerId, doc.teamId, tabId))) {
    return deniedEdit(ctx, id, tabId);
  }
  return doc;
}

/** Today's day in UTC, `YYYY-MM-DD`: the only time a note keeps, and the same whatever the writer's time zone. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function drop(ctx: DocumentRouteContext, id: string, tabId: string): Promise<Response> {
  const doc = await admitted(ctx, id, tabId, 'participate');
  if (doc instanceof Response) return doc;
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const elementId = typeof body.elementId === 'string' ? body.elementId : '';
  if (!elementId) return badRequest('missing elementId');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return badRequest('missing text');
  if (text.length > SUGGESTION_TEXT_MAX) return badRequest('text too long');
  const tab = await getTab(ctx.env, id, tabId);
  const box = tab?.elements.find((el) => el.id === elementId);
  if (!box || box.type !== 'shape' || box.shape !== 'suggestion-box') return notFound();
  const where = { documentId: id, tabId, elementId };
  const note = { id: crypto.randomUUID(), text, day: utcDay(Date.now()) };
  if (!(await insertSuggestion(ctx.env, where, note, SUGGESTIONS_MAX))) return conflict('box_full');
  // Neither the caller nor the text: the log is read by people too.
  console.info('[suggestions] dropped', { documentId: id, tabId });
  return json({}, { status: 201 });
}

async function list(ctx: DocumentRouteContext, id: string, tabId: string): Promise<Response> {
  const doc = await admitted(ctx, id, tabId, 'edit');
  if (doc instanceof Response) return doc;
  const elementId = ctx.url.searchParams.get('elementId');
  if (!elementId) return badRequest('missing elementId');
  const suggestions = await listSuggestions(ctx.env, { documentId: id, tabId, elementId });
  console.info('[suggestions] listed', { documentId: id, tabId, count: suggestions.length });
  const res: SuggestionsResponse = { suggestions };
  return json(res);
}

async function remove(
  ctx: DocumentRouteContext,
  id: string,
  tabId: string,
  suggestionId: string,
): Promise<Response> {
  const doc = await admitted(ctx, id, tabId, 'edit');
  if (doc instanceof Response) return doc;
  if (!(await deleteSuggestion(ctx.env, id, tabId, suggestionId))) return notFound();
  console.info('[suggestions] removed', { documentId: id, tabId });
  return noContent();
}

async function suggestionRoute(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'tabs' || segments[5] !== 'suggestions') return null;
  const id = segments[2]!;
  const tabId = segments[4]!;
  if (segments.length === 6) {
    if (request.method === 'POST') return drop(ctx, id, tabId);
    if (request.method === 'GET') return list(ctx, id, tabId);
    return methodNotAllowed();
  }
  if (segments.length === 7)
    return request.method === 'DELETE' ? remove(ctx, id, tabId, segments[6]!) : methodNotAllowed();
  return null;
}

/** The Suggestion Box's routes, or null for a path that is not theirs. Each refusal is logged once, with its code. */
export async function handleSuggestionRoutes(ctx: DocumentRouteContext): Promise<Response | null> {
  const res = await suggestionRoute(ctx);
  if (res && res.status >= 400)
    await logRefusal('[suggestions] refused', res, {
      documentId: ctx.segments[2],
      tabId: ctx.segments[4] ?? null,
    });
  return res;
}
