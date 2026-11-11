// An item's forms in its collab push (./collab-push): a form's state as an app pushes it, when it was last seen,
// and a form found by its public code. Re-exported from ./collab-push.
import type { App, CollabFormInput } from '@liveworkspace/index-client';
import { isId, isPartId } from './codec';
import type { Env } from './env';
import { badRequest, json, noContent, notFound, readObject } from './http';
import { formResponseStatement } from './webhooks/outbox';
import { FORM_CODE, LABEL_MAX, RESPONSES_MAX, clip, isCount, isTime } from './collab-parse';

export function parseForm(value: unknown): CollabFormInput | null | undefined {
  if (value === null) return null;
  const f = value as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return undefined;
  const heading = clip(f.heading, LABEL_MAX);
  const boardTabId = f.boardTabId ?? null;
  const code = f.code ?? null;
  if (
    heading === null ||
    !(code === null || (typeof code === 'string' && FORM_CODE.test(code))) ||
    !(boardTabId === null || isPartId(boardTabId)) ||
    !isCount(f.responses) ||
    f.responses > RESPONSES_MAX ||
    !isTime(f.latestAt)
  ) {
    return undefined;
  }
  return {
    heading,
    boardTabId,
    responses: f.responses,
    latestAt: f.latestAt,
    ...(code === null ? {} : { code }),
  };
}

/** A form's response count (`{ form }`), or `{ form: null }` to take it off the Inbox with everyone's reads. A push
 * with a `code` names the live link's public code (`GET /app/forms/:code`); one without keeps the code it has. */
export async function pushForm(
  request: Request,
  env: Env,
  app: App,
  itemId: string,
  tabId: string,
): Promise<Response> {
  const body = await readObject(request);
  const form = body ? parseForm(body.form) : undefined;
  if (form === undefined) return badRequest('invalid_form');
  const db = env.INDEX_DB;
  if (form === null) {
    await db.batch([
      db.prepare('DELETE FROM collab_forms WHERE item_id = ? AND tab_id = ?').bind(itemId, tabId),
      db
        .prepare('DELETE FROM collab_form_reads WHERE item_id = ? AND tab_id = ?')
        .bind(itemId, tabId),
    ]);
    return noContent();
  }
  const store = db
    .prepare(
      `INSERT INTO collab_forms (app, item_id, tab_id, heading, board_tab_id, responses, latest_at, code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (item_id, tab_id) DO UPDATE SET heading = excluded.heading,
         board_tab_id = excluded.board_tab_id, responses = excluded.responses,
         latest_at = MAX(collab_forms.latest_at, excluded.latest_at),
         code = COALESCE(excluded.code, collab_forms.code)`,
    )
    .bind(
      app,
      itemId,
      tabId,
      form.heading,
      form.boardTabId,
      form.responses,
      form.latestAt,
      form.code ?? null,
    );
  // A count above none can be news to a webhook: its statement reads the held count, so it goes first, in one batch.
  if (form.responses > 0) await db.batch([formResponseStatement(db, itemId, tabId, form), store]);
  else await store.run();
  return noContent();
}

/** A person has seen a form's first `seen` responses. A seen count never goes back. */
export async function pushFormSeen(
  request: Request,
  env: Env,
  itemId: string,
  tabId: string,
): Promise<Response> {
  const body = await readObject(request);
  if (!body || !isId(body.personId) || !isCount(body.seen) || body.seen > RESPONSES_MAX) {
    return badRequest('invalid_form_seen');
  }
  await env.INDEX_DB.prepare(
    `INSERT INTO collab_form_reads (person_id, item_id, tab_id, seen) VALUES (?, ?, ?, ?)
     ON CONFLICT (person_id, item_id, tab_id) DO UPDATE SET seen = MAX(seen, excluded.seen)`,
  )
    .bind(body.personId, itemId, tabId, body.seen)
    .run();
  return noContent();
}

/** The item and tab a live form's public code names, for the app that pushed it (`GET /app/forms/:code`). */
export async function formByCode(env: Env, app: App, code: string): Promise<Response> {
  if (!FORM_CODE.test(code)) return notFound();
  const row = await env.INDEX_DB.prepare(
    'SELECT item_id, tab_id FROM collab_forms WHERE code = ? AND app = ?',
  )
    .bind(code, app)
    .first<{ item_id: string; tab_id: string }>();
  return row ? json({ itemId: row.item_id, tabId: row.tab_id }) : notFound();
}

/** How many of a form's responses a person has seen (`GET /app/items/:id/forms/:tabId/seen/:personId`). */
export async function formSeen(
  env: Env,
  itemId: string,
  tabId: string,
  personId: string,
): Promise<Response> {
  const row = await env.INDEX_DB.prepare(
    'SELECT seen FROM collab_form_reads WHERE person_id = ? AND item_id = ? AND tab_id = ?',
  )
    .bind(personId, itemId, tabId)
    .first<{ seen: number }>();
  return json({ seen: row?.seen ?? 0 });
}
