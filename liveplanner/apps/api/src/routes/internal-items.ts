// /api/internal/items/**: the One Explorer index's doors into a plan's content (docs/specs/015-api/api.md
// "Internal"). Server to server only: the caller sends `Authorization: Bearer <INDEX_KEY>`, compared in constant
// time; without INDEX_KEY configured every path here is a plain 404, as if it did not exist.
//
//   POST   /api/internal/items/:from/copy-to/:to  {tabId?}  copy a plan's content (or one tab) into a new plan
//   DELETE /api/internal/items/:id                          drop everything the plan stores, end its sessions
//   POST   /api/internal/items/:id/revoke         {codes}   end the sessions of revoked share links
//
// Each is one call to the plan's Durable Object (plan-client.ts). The project row and its D1 side (sharing,
// placement, trash) are the index's to manage; these touch the plan's own store only.
import { timingSafeEqual } from '../auth/timing-safe';
import { planRoom } from '../plan-client';
import { badRequest, json, notFound } from '../responses';
import type { Env } from '../types';

const MAX_ID = 200;
const MAX_CODES = 500;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID;
}

async function authorised(request: Request, key: string): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  const sent = header.startsWith('Bearer ') ? header.slice(7) : '';
  return sent.length > 0 && (await timingSafeEqual(sent, key));
}

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function handleInternalItems(request: Request, env: Env): Promise<Response> {
  // `api/internal/items/...`, as index.ts splits it.
  const segments = new URL(request.url).pathname.replace(/^\//, '').split('/');
  const key = env.INDEX_KEY;
  if (!key || segments[2] !== 'items') return notFound();
  if (!(await authorised(request, key))) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  const id = segments[3];
  if (!validId(id)) return notFound();

  // DELETE /api/internal/items/:id
  if (segments.length === 4 && request.method === 'DELETE') {
    await planRoom(env, id).purge();
    return json({ ok: true });
  }

  // POST /api/internal/items/:id/revoke {codes}
  if (segments.length === 5 && segments[4] === 'revoke' && request.method === 'POST') {
    const body = await bodyOf(request);
    const codes = body?.['codes'];
    if (
      !Array.isArray(codes) ||
      codes.length > MAX_CODES ||
      !codes.every((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= MAX_ID)
    ) {
      return badRequest('codes must be an array of share codes');
    }
    const closed = await planRoom(env, id).revokeCodes(codes);
    return json({ ok: true, closed });
  }

  // POST /api/internal/items/:from/copy-to/:to {tabId?}
  if (segments.length === 6 && segments[4] === 'copy-to' && request.method === 'POST') {
    const to = segments[5];
    if (!validId(to) || to === id) return badRequest('invalid copy target');
    const body = (await bodyOf(request)) ?? {};
    const tabId = body['tabId'];
    if (tabId !== undefined && tabId !== null && !validId(tabId)) {
      return badRequest('invalid tabId');
    }
    const copy = await planRoom(env, id).exportCopy(validId(tabId) ? tabId : null, null);
    // No such plan, or no such tab in it.
    if (!copy || (validId(tabId) && copy.tabs.length === 0)) return notFound();
    // The target is a new plan: a copy into one that already holds this content fails its keys, and nothing is
    // written (importCopy is one transaction).
    try {
      await planRoom(env, to).importCopy(copy);
    } catch (err) {
      console.error('[internal] copy-to failed', err);
      return json({ error: 'copy_conflict' }, { status: 409 });
    }
    return json({ ok: true, tabs: copy.tabs.length, items: copy.items.length }, { status: 201 });
  }

  return notFound();
}
