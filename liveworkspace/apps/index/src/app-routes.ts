// What an item pushes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"), from its app's
// server with the app's key: the summary derived from its content, each tab's comment threads and
// actions for the Inbox, and its Timeline events (timeline.ts). Only the item's own app may push for it.

import { SUMMARY_MAX_BYTES, type App } from '@liveworkspace/index-client';
import { callerApp } from './auth';
import { formByCode, formSeen, pushCollab, pushForm, pushFormSeen } from './collab-push';
import { isId, isPartId } from './codec';
import { handleDriveFlag, sendDriveSignals } from './drive';
import type { Env } from './env';
import { badRequest, fail, noContent, notFound, readObject, unauthorized } from './http';
import { handleMigrationHandoff } from './migration-handoff';
import { handleAppPeople } from './notices';
import { FUTURE_SLACK_MS, pushAppEvents, pushPersonEvents } from './timeline';

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export async function handleApp(
  request: Request,
  env: Env,
  segments: string[],
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  // /app/people/:id/drive: the Drive mirror's flag, with its own key and no app's (drive.ts).
  if (segments[1] === 'people' && segments[3] === 'drive' && segments.length === 4) {
    return handleDriveFlag(request, env, segments[2] ?? '');
  }
  const app = await callerApp(request, env);
  if (!app) return unauthorized();
  // /app/migration/handoff: a browser's Local only part, made in another app (migration-handoff.ts).
  if (segments[1] === 'migration' && segments[2] === 'handoff' && segments.length === 3) {
    return handleMigrationHandoff(request, env, app, waitUntil);
  }
  // /app/people/events: the Timeline's events about people (images uploaded), timeline.ts.
  if (segments[1] === 'people' && segments[2] === 'events' && segments.length === 3) {
    if (request.method !== 'PUT') return notFound();
    const body = await readObject(request);
    if (!body) return badRequest();
    return pushPersonEvents(env, app, body);
  }
  // /app/people/:id/count (notices.ts).
  if (segments[1] === 'people') return handleAppPeople(request, env, app, segments);
  // /app/forms/:code: the item and tab a live form's code names (collab-push.ts).
  if (segments[1] === 'forms' && segments.length === 3 && request.method === 'GET') {
    return formByCode(env, app, segments[2] ?? '');
  }
  // /app/items/:id/forms/:tabId/seen/:personId: how far a person has read a form (the app's unseen count).
  const seenRead =
    request.method === 'GET' &&
    segments.length === 7 &&
    segments[3] === 'forms' &&
    segments[5] === 'seen' &&
    isPartId(segments[4]) &&
    isId(segments[6]);
  // /app/items/:id/summary, /app/items/:id/collab/:tabId, /app/items/:id/events, /app/items/:id/forms/:tabId
  if (segments[1] !== 'items' || !isId(segments[2])) return notFound();
  if (request.method !== 'PUT' && !seenRead) return notFound();
  const itemId = segments[2];
  const item = await env.INDEX_DB.prepare(
    'SELECT app, owner_id, team_id, updated_at FROM items WHERE id = ?',
  )
    .bind(itemId)
    .first<{ app: App; owner_id: string; team_id: string | null; updated_at: number }>();
  if (!item) return notFound();
  if (item.app !== app) return fail(403, 'wrong_app');
  if (seenRead) return formSeen(env, itemId, segments[4]!, segments[6]!);

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
    // A push that arrives late never moves updatedAt back, so one from a clock running fast is taken as now: past
    // it, no later push could bring the item down from the top of every list.
    const updatedAt = Math.min(Math.floor(body.updatedAt), Date.now() + FUTURE_SLACK_MS);
    await env.INDEX_DB.prepare(
      'UPDATE items SET summary = ?, updated_at = MAX(updated_at, ?) WHERE id = ?',
    )
      .bind(text, updatedAt, itemId)
      .run();
    // A content save: the Drive mirror rewrites a personal item's file when its updatedAt moved on.
    if (item.team_id === null && updatedAt > item.updated_at && env.DRIVE) {
      waitUntil(sendDriveSignals(env, [item.owner_id]));
    }
    return noContent();
  }

  if (segments.length === 4 && segments[3] === 'events') {
    const body = await readObject(request);
    if (!body) return badRequest();
    return pushAppEvents(env, itemId, body);
  }

  if (segments.length === 5 && segments[3] === 'collab' && isPartId(segments[4])) {
    return pushCollab(request, env, app, itemId, segments[4]);
  }
  // /app/items/:id/forms/:tabId and .../seen: the Inbox's Form Responses (collab-push.ts).
  if (segments[3] === 'forms' && isPartId(segments[4])) {
    if (segments.length === 5) return pushForm(request, env, app, itemId, segments[4]);
    if (segments.length === 6 && segments[5] === 'seen') {
      return pushFormSeen(request, env, itemId, segments[4]);
    }
  }
  return notFound();
}
