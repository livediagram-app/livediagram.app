// /api/internal/items/**: the One Explorer index's doors into a plan's content (docs/specs/015-api/api.md
// "Internal"). Server to server only: the caller sends `Authorization: Bearer <INDEX_KEY>`, compared in constant
// time; without INDEX_KEY configured every path here is a plain 404, as if it did not exist.
//
//   POST   /api/internal/items/:from/copy-to/:to  {tabId?}  copy a plan's content (or one tab) into a new plan
//   DELETE /api/internal/items/:id                          drop everything the plan stores, end its sessions
//   POST   /api/internal/items/:id/revoke         {codes, reason?}  end the sessions of revoked or rescoped links
//   POST   /api/internal/items/:id/notices        {type, ...}  what happened for an email (index-client notices.ts):
//                                                  a share link made (the first-share milestone), or someone's first
//                                                  time in through a link (the owner's "someone joined" email)
//
// Each is one call to the plan's Durable Object (plan-client.ts). Where the plan is filed, its sharing and its
// Trash are the index's; a purge also drops what D1 and R2 keep about the plan (its form links, the workbench
// tickets and sessions scoped to it, its cached snapshots: db/projects.ts `purgePlanRows`).
import { parseItemNotice } from '@liveworkspace/index-client';
import { timingSafeEqual } from '../auth/timing-safe';
import { notifyFirstShare } from '../email/notifications';
import { purgePlanRows } from '../db/projects';
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

export async function handleInternalItems(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
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
    await purgePlanRows(env, id);
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
    // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends them away.
    const rescoped = body?.['reason'] === 'rescoped';
    const closed = await planRoom(env, id).revokeCodes(codes, rescoped ? 'rescoped' : 'revoked');
    return json({ ok: true, closed });
  }

  // POST /api/internal/items/:id/notices: accepted at once, the email worked out off the index's path.
  if (segments.length === 5 && segments[4] === 'notices' && request.method === 'POST') {
    const notice = parseItemNotice(await bodyOf(request));
    if (!notice) return badRequest('invalid notice');
    waitUntil(
      (notice.type === 'shared'
        ? notifyFirstShare(env, notice.actorId)
        : planRoom(env, id).joined(notice.personId)
      ).catch((err: unknown) => {
        console.warn('[internal] notice failed', { type: notice.type, error: String(err) });
      }),
    );
    return json({ ok: true }, { status: 202 });
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
