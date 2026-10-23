// What an item pushes (liveworkspace/docs/one-explorer-contracts.md "What an item pushes"), from its app's
// server with the app's key: the summary derived from its content, each tab's comment threads and
// actions for the Inbox, and its Timeline events (timeline.ts). Only the item's own app may push for it.

import { SUMMARY_MAX_BYTES, type App } from '@liveworkspace/index-client';
import { callerApp } from './auth';
import { pushCollab, pushForm, pushFormSeen } from './collab-push';
import { isId } from './codec';
import type { Env } from './env';
import { badRequest, fail, noContent, notFound, readObject, unauthorized } from './http';
import { handleAppPeople } from './notices';
import { pushAppEvents } from './timeline';

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export async function handleApp(request: Request, env: Env, segments: string[]): Promise<Response> {
  const app = await callerApp(request, env);
  if (!app) return unauthorized();
  // /app/people/:id/count (notices.ts).
  if (segments[1] === 'people') return handleAppPeople(request, env, app, segments);
  // /app/items/:id/summary, /app/items/:id/collab/:tabId, /app/items/:id/events, /app/items/:id/forms/:tabId
  if (segments[1] !== 'items' || !isId(segments[2]) || request.method !== 'PUT') return notFound();
  const itemId = segments[2];
  const item = await env.INDEX_DB.prepare('SELECT app FROM items WHERE id = ?')
    .bind(itemId)
    .first<{ app: App }>();
  if (!item) return notFound();
  if (item.app !== app) return fail(403, 'wrong_app');

  if (segments.length === 4 && segments[3] === 'summary') {
    const body = await readObject(request);
    if (!body) return badRequest();
    const summary = body.summary;
    if (
      !summary ||
      typeof summary !== 'object' ||
      Array.isArray(summary) ||
      !isTime(body.updatedAt)
    ) {
      return badRequest('invalid_summary');
    }
    const text = JSON.stringify(summary);
    if (new TextEncoder().encode(text).length > SUMMARY_MAX_BYTES)
      return badRequest('invalid_summary');
    // A push that arrives late never moves updatedAt back.
    await env.INDEX_DB.prepare(
      'UPDATE items SET summary = ?, updated_at = MAX(updated_at, ?) WHERE id = ?',
    )
      .bind(text, Math.floor(body.updatedAt), itemId)
      .run();
    return noContent();
  }

  if (segments.length === 4 && segments[3] === 'events') {
    const body = await readObject(request);
    if (!body) return badRequest();
    return pushAppEvents(env, itemId, body);
  }

  if (segments.length === 5 && segments[3] === 'collab' && isId(segments[4])) {
    return pushCollab(request, env, app, itemId, segments[4]);
  }
  // /app/items/:id/forms/:tabId and .../seen: the Inbox's Form Responses (collab-push.ts).
  if (segments[3] === 'forms' && isId(segments[4])) {
    if (segments.length === 5) return pushForm(request, env, app, itemId, segments[4]);
    if (segments.length === 6 && segments[5] === 'seen') {
      return pushFormSeen(request, env, itemId, segments[4]);
    }
  }
  return notFound();
}
