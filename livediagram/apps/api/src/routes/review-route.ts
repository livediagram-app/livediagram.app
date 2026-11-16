// GET and PUT /api/documents/<id>/review: the document's review settings
// (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggest Only"), the Share dialog's Suggestions
// section. An Editor's only: a Participant or Viewer is refused, as
// is a grant confined to one tab (the settings are the document's). A PUT keeps the people seen joining, writes the
// rest as sent (parsed and bounded), and tells the room, which tells each Participant session where it stands.

import {
  parseReviewSettings,
  parseStoredReview,
  reviewFromSettings,
  type ReviewResponse,
  type StoredReview,
} from '@liveworkspace/suggestions/review';
import { getDocumentMeta } from '../db/documents';
import { forbidden, json } from '../responses';
import { roomFetch } from '../room-client';
import {
  gateEdit,
  grantOn,
  missingDocument,
  requireOwner,
  type DocumentRouteContext,
} from './context';

// How long the PUT waits on the room's word to its sessions: the settings are written either way.
const REVIEW_RELAY_MS = 2_000;

async function readReview(ctx: DocumentRouteContext): Promise<StoredReview> {
  const row = await ctx.env.DOCUMENT_DB.prepare('SELECT review FROM document LIMIT 1').first<{
    review: string | null;
  }>();
  return parseStoredReview(row?.review ?? null);
}

export async function handleReviewRoute(
  ctx: DocumentRouteContext,
  id: string,
): Promise<Response | null> {
  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'PUT') return null;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const meta = await getDocumentMeta(ctx.env, id);
  if (!meta) return missingDocument(ctx, id);
  if (!(await gateEdit(ctx, id, meta.ownerId, meta.teamId))) return forbidden();
  if ((grantOn(ctx, id)?.tabScope ?? null) !== null) return forbidden();
  if (ctx.token?.readOnly && method === 'PUT') return forbidden('read_only_token');
  const stored = await readReview(ctx);
  if (method === 'GET') return json({ review: stored } satisfies ReviewResponse);
  const body: unknown = await ctx.request.json().catch(() => null);
  if (!body || typeof body !== 'object')
    return json(
      { error: 'invalid_review', message: 'send links, people and agents' },
      { status: 400 },
    );
  // The pins stay but for those the Editor lifted and those whose link left Suggest Only.
  const review: StoredReview = reviewFromSettings(stored, parseReviewSettings(body));
  await ctx.env.DOCUMENT_DB.prepare('UPDATE document SET review = ? WHERE id = ?')
    .bind(JSON.stringify(review), id)
    .run();
  console.info('[review] set', {
    documentId: id,
    links: review.links.length,
    people: review.people.length,
    pins: review.pins.length,
    agents: review.agents,
  });
  try {
    await roomFetch(ctx.env, id, '/review', { method: 'POST' }, REVIEW_RELAY_MS);
  } catch (error) {
    // The settings are written; a room that misses the word reads them on its next Participant frame after it
    // wakes, and a session told late is still held to the rule by the room.
    console.warn('[review] relay-failed', { documentId: id, error: String(error) });
  }
  return json({ review } satisfies ReviewResponse);
}
