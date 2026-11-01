// A This Browser document moved by product, the browser's one-time door after the move from the old livehuddle.app
// (docs/migration.md step 6; docs/specs/015-api/api.md "Migration"): `POST /api/migration/local-parts`, body a
// LocalPartsRequest, as the caller's guest or account (an account access token or a guest token: an API token or a
// workbench session is a script's, never a browser returning). Its Pages, Plan and design tabs move to their apps as
// the caller's (migration/local-parts.ts). The other door, the legacy guest claim, is routes/legacy-guest.ts.

import type { LocalDocumentInput } from '@liveworkspace/migration';
import { bodyExceedsCap } from '../limits';
import { moveLocalParts, type LocalPartsDeps } from '../migration/local-parts';
import { badRequest, json, notFound, payloadTooLarge } from '../responses';
import { readBody, type RouteContext } from './context';

// The largest local document the door reads: a Durable Object RPC message's cap, which each part crosses whole
// (index.ts lets this path's body past the api's 8 MB gate up to it).
export const LOCAL_PARTS_MAX_BYTES = 32 * 1024 * 1024;
// The most tabs a local document may send: far past any real one (the old editor capped a document at 100 tabs).
export const LOCAL_PARTS_MAX_TABS = 500;
const MAX_LOCAL_ID = 200;

// The browser's own guest or account, never a script's credential.
export function browserCaller(ctx: RouteContext): string | null {
  if (ctx.token || ctx.workbench) return null;
  return ctx.resolveOwner();
}

export const identityRequired = () => json({ error: 'identity_required' }, { status: 401 });

const optional = (v: unknown, ok: (v: unknown) => boolean) => v === undefined || ok(v);
const isFiniteNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

// The request as the splitter's input, or why not: the local document's id and name, its raw tabs, and the rest of
// its raw record under the names the old editor kept them (each optional).
export function readLocalPartsRequest(
  body: Record<string, unknown>,
): { ok: true; input: LocalDocumentInput } | { ok: false; error: string } {
  const { id, name, tabs } = body;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_LOCAL_ID)
    return { ok: false, error: 'id must be the local document id' };
  if (typeof name !== 'string') return { ok: false, error: 'name must be text' };
  if (!Array.isArray(tabs) || tabs.length > LOCAL_PARTS_MAX_TABS)
    return { ok: false, error: `tabs must be up to ${LOCAL_PARTS_MAX_TABS} tabs` };
  if (
    !optional(body.ownerId, (v) => typeof v === 'string') ||
    !optional(body.createdAt, isFiniteNumber) ||
    !optional(body.savedAt, isFiniteNumber) ||
    !optional(body.presentation, (v) => v === null || typeof v === 'string') ||
    !optional(body.items, Array.isArray) ||
    !optional(body.sheets, Array.isArray) ||
    !optional(body.itemsRev, isFiniteNumber) ||
    !optional(body.itemsNextKey, isFiniteNumber)
  )
    return { ok: false, error: 'a record field has the wrong type' };
  const input: LocalDocumentInput = { id, name, tabs };
  for (const key of [
    'ownerId',
    'createdAt',
    'savedAt',
    'presentation',
    'items',
    'itemsRev',
    'itemsNextKey',
    'itemTypes',
    'sheets',
  ] as const) {
    if (body[key] !== undefined) (input as Record<string, unknown>)[key] = body[key];
  }
  return { ok: true, input };
}

export async function handleLocalParts(
  ctx: RouteContext,
  deps?: LocalPartsDeps,
): Promise<Response> {
  if (
    ctx.request.method !== 'POST' ||
    ctx.segments.length !== 3 ||
    ctx.segments[2] !== 'local-parts'
  )
    return notFound();
  const callerId = browserCaller(ctx);
  if (!callerId) return identityRequired();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  if (bodyExceedsCap(ctx.request, body, LOCAL_PARTS_MAX_BYTES)) return payloadTooLarge();
  const read = readLocalPartsRequest(body);
  if (!read.ok) return badRequest(read.error);
  if (!ctx.env.INDEX_KEY) return json({ error: 'index_unavailable' }, { status: 503 });
  const result = await moveLocalParts(ctx.env, callerId, read.input, deps);
  return json(result.body, { status: result.status });
}
