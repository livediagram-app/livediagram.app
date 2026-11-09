// A document's webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Who adds one", "Managing them"): an account who
// can edit the whole item, checked on every request with the access rule every item route uses (access.ts): its
// owner, its team's people, or a live Editor link to every tab (sent with the request, or opened before and held
// under Shared). Nobody else: a guest, an app or the Drive mirror acting for a person, a Viewer or Participant, a
// one-tab Editor. A webhook whose item the caller can't reach answers 404, so its id tells them nothing.
//
//   GET    /items/:id/webhooks       the item's
//   POST   /items/:id/webhooks       {name, kind, url, events, who?} → 201 {webhook, secret}
//   PATCH  /webhooks/:id             {name?, events?, who?, paused?} → {webhook}
//   DELETE /webhooks/:id             204
//   POST   /webhooks/:id/test        202: queues a `ping`
//   GET    /webhooks/:id/deliveries  {deliveries}: its newest, pending and finished

import { trimInvisible, withoutBidiControls } from '@liveworkspace/api-kit/typed-text';
import { importSealKey, seal } from '@liveworkspace/api-kit/sealed';
import {
  isWebhookKind,
  isWebhookWho,
  WEBHOOK_DELIVERIES_KEPT,
  WEBHOOK_EVENT_APPS,
  WEBHOOK_EVENTS,
  WEBHOOK_NAME_MAX,
  WEBHOOKS_PER_DOCUMENT_MAX,
  type App,
  type CardMove,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookKind,
  type WebhookPauseReason,
  type WebhookWho,
  CARD_MOVES_MAX,
} from '@liveworkspace/index-client';
import { loadItem, type Loaded } from '../access';
import { sharedWithUpsert } from '../items';
import { FUTURE_SLACK_MS } from '../timeline';
import { isId } from '../codec';
import type { PersonContext } from '../context';
import type { Env } from '../env';
import {
  badRequest,
  conflict,
  fail,
  forbidden,
  json,
  noContent,
  notFound,
  readObject,
} from '../http';
import { dohResolve, parseWebhookUrl, resolvesPublic, type Resolve } from './address';
import { secretContext, urlContext } from './dispatch';
import { cardMovesStatement, pingStatement } from './outbox';
import { newSigningSecret } from './sign';
import { webhookAuditStatement } from '../team-audit';

export type WebhookRouteDeps = { resolve: Resolve; now: () => number };

const defaultDeps = (): WebhookRouteDeps => ({ resolve: dohResolve, now: () => Date.now() });

// The newest deliveries a webhook's list shows: its kept finished ones and, beside them, the newest still waiting.
// Each part has its own limit, so a backlog of retries never pushes the finished ones (their statuses) off the list.
const DELIVERIES_LISTED = 40;
const PENDING_LISTED = DELIVERIES_LISTED - WEBHOOK_DELIVERIES_KEPT;
const DELIVERY_COLUMNS =
  'id, type, app, title, state, attempts, status, error, occurred_at, last_at, next_at';

type WebhookRow = {
  id: string;
  item_id: string;
  app: App;
  kind: WebhookKind;
  name: string;
  host: string;
  events: string;
  who: WebhookWho;
  created_by: string;
  created_at: number;
  paused_at: number | null;
  paused_reason: WebhookPauseReason | null;
  last: string | null;
};

// The newest finished delivery's time is its last try's; one given up untried (a pause gives up what waited) has
// none, so it is when it was given up (next_at), never null (a null read as 1 January 1970 in the dialog).
const COLUMNS = `w.id, w.item_id, i.app, w.kind, w.name, w.host, w.events, w.who, w.created_by, w.created_at,
  w.paused_at, w.paused_reason,
  (SELECT json_object('state', d.state, 'status', d.status, 'at', COALESCE(d.last_at, d.next_at, d.occurred_at))
    FROM webhook_deliveries d
    WHERE d.webhook_id = w.id AND d.state <> 'pending' ORDER BY d.id DESC LIMIT 1) AS last`;
const FROM = 'FROM webhooks w JOIN items i ON i.id = w.item_id';

export function webhookOf(row: WebhookRow, personId: string): Webhook {
  const held = new Set(row.events.split(','));
  return {
    id: row.id,
    itemId: row.item_id,
    app: row.app,
    name: row.name,
    kind: row.kind,
    host: row.host,
    events: WEBHOOK_EVENTS.filter((event) => held.has(event)),
    who: row.who,
    mine: row.created_by === personId,
    createdAt: row.created_at,
    pausedAt: row.paused_at,
    pausedReason: row.paused_reason,
    lastDelivery: row.last ? (JSON.parse(row.last) as Webhook['lastDelivery']) : null,
  };
}

// Events as stored: comma-wrapped, so one `instr` matches a type.
const storedEvents = (events: readonly WebhookEvent[]) => `,${events.join(',')},`;

// A name as the account names are kept (typed-text): no bidi control to turn the words around it backwards, and no
// spaces or invisible characters at its ends to make it look blank. Longer than the limit is refused, as before.
function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = trimInvisible(withoutBidiControls(value));
  return name.length > 0 && name.length <= WEBHOOK_NAME_MAX ? name : null;
}

// The events asked for: each one the document's app sends (a canvas has no card moves). Anything else refuses the
// whole list. De-duplicated, in WEBHOOK_EVENTS order.
function readEvents(value: unknown, app: App): WebhookEvent[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const held = new Set<unknown>(value);
  for (const event of held) {
    // Own keys only: `in` also finds Object.prototype's (`constructor`, `toString`), which have no app list.
    if (typeof event !== 'string' || !Object.hasOwn(WEBHOOK_EVENT_APPS, event)) return null;
    if (!WEBHOOK_EVENT_APPS[event as WebhookEvent].includes(app)) return null;
  }
  return WEBHOOK_EVENTS.filter((event) => held.has(event));
}

async function readRow(env: Env, id: string): Promise<WebhookRow | null> {
  return env.INDEX_DB.prepare(`SELECT ${COLUMNS} ${FROM} WHERE w.id = ?`)
    .bind(id)
    .first<WebhookRow>();
}

/**
 * The item, when the caller may manage its webhooks: an account (never an app, the Drive mirror or the export acting
 * for one) who can edit all of it. A refusal is the response to send: 404 for an item they can't reach, 403
 * `webhooks_need_editor` for one they read but can't edit whole.
 */
async function editableItem(ctx: PersonContext, itemId: string): Promise<Loaded | Response> {
  const loaded = await loadItem(ctx.env, itemId, ctx.caller, 'view');
  if (loaded instanceof Response) return loaded;
  const { access } = loaded;
  if (access.level !== 'edit' || access.tabId !== null) return forbidden('webhooks_need_editor');
  return loaded;
}

// An Editor through a link has it recorded under Shared, as opening the document does (items.ts), so the dispatcher
// finds the link their webhook sends through (dispatch.ts "creatorCanEdit"); nothing for an owner or team member.
const linkHeld = (ctx: PersonContext, { row, access }: Loaded) =>
  access.via === 'link' && access.code
    ? [sharedWithUpsert(ctx.env, ctx.person.id, row.id, access.code, Date.now())]
    : [];

/** `/items/:id/webhooks`: the document's list, and adding one. */
export async function handleItemWebhooks(
  ctx: PersonContext,
  itemId: string,
  deps: WebhookRouteDeps = defaultDeps(),
): Promise<Response> {
  const refused = refuseCaller(ctx);
  if (refused) return refused;
  const key = await importSealKey(ctx.env.WEBHOOK_KEY);
  if (!key) return fail(503, 'webhooks_unavailable');
  const loaded = await editableItem(ctx, itemId);
  if (loaded instanceof Response) return loaded;
  const item = loaded.row;
  const method = ctx.request.method;
  if (method === 'GET') {
    const rows =
      (
        await ctx.env.INDEX_DB.prepare(
          `SELECT ${COLUMNS} ${FROM} WHERE w.item_id = ? ORDER BY w.created_at, w.id`,
        )
          .bind(item.id)
          .all<WebhookRow>()
      ).results ?? [];
    return json({ webhooks: rows.map((row) => webhookOf(row, ctx.person.id)) });
  }
  if (method === 'POST') return createWebhook(ctx, deps, key, loaded);
  return notFound();
}

// An account's own session only: never a guest, an app or the Drive mirror acting for one.
function refuseCaller({ person }: PersonContext): Response | null {
  if (person.kind !== 'account' || person.app || person.drive || person.export) {
    return forbidden('webhooks_need_account');
  }
  return null;
}

/** `/webhooks/:id…`: one webhook, its document's to manage. */
export async function handleWebhooks(
  ctx: PersonContext,
  deps: WebhookRouteDeps = defaultDeps(),
): Promise<Response> {
  const { request, env, segments, person } = ctx;
  const refused = refuseCaller(ctx);
  if (refused) return refused;
  const key = await importSealKey(env.WEBHOOK_KEY);
  if (!key) return fail(503, 'webhooks_unavailable');
  const method = request.method;
  const id = segments[1];
  if (!id || !isId(id)) return notFound('webhook_not_found');
  const row = await readRow(env, id);
  if (!row) return notFound('webhook_not_found');
  // The webhook's document, editable whole by the caller now; one they can't reach hides the webhook too.
  const loaded = await editableItem(ctx, row.item_id);
  if (loaded instanceof Response) {
    return loaded.status === 404 ? notFound('webhook_not_found') : loaded;
  }
  const item = loaded.row;
  const now = deps.now();

  if (segments.length === 2 && method === 'PATCH') {
    const body = await readObject(request);
    if (!body) return badRequest('invalid_webhook');
    const name = body.name === undefined ? row.name : readName(body.name);
    const events = body.events === undefined ? null : readEvents(body.events, item.app);
    const who = body.who === undefined ? row.who : isWebhookWho(body.who) ? body.who : null;
    if (name === null || who === null || (body.events !== undefined && !events)) {
      return badRequest('invalid_webhook');
    }
    if (body.paused !== undefined && typeof body.paused !== 'boolean') {
      return badRequest('invalid_webhook');
    }
    const db = env.INDEX_DB;
    const statements = [
      db
        .prepare('UPDATE webhooks SET name = ?, who = ?, events = COALESCE(?, events) WHERE id = ?')
        .bind(name, who, events ? storedEvents(events) : null, id),
    ];
    if (body.paused === true && row.paused_at === null) {
      statements.push(
        db
          .prepare("UPDATE webhooks SET paused_at = ?, paused_reason = 'paused' WHERE id = ?")
          .bind(now, id),
        db
          .prepare(
            `UPDATE webhook_deliveries SET state = 'failed', error = 'paused', next_at = ?
             WHERE webhook_id = ? AND state = 'pending'`,
          )
          .bind(now, id),
      );
    }
    // Resumed: the count of failures starts again, and whoever resumed it is its creator now (it sends while they can
    // edit the document, and Only Me is them).
    if (body.paused === false && row.paused_at !== null) {
      statements.push(
        db
          .prepare(
            `UPDATE webhooks SET paused_at = NULL, paused_reason = NULL, failures = 0, created_by = ?
             WHERE id = ?`,
          )
          .bind(person.id, id),
        ...linkHeld(ctx, loaded),
      );
    }
    // Set to Only Me: it is the one who chose it, so they become its creator (and it sends while they can edit).
    if (who === 'me' && row.who !== 'me' && row.created_by !== person.id) {
      statements.push(
        db.prepare('UPDATE webhooks SET created_by = ? WHERE id = ?').bind(person.id, id),
        ...linkHeld(ctx, loaded),
      );
    }
    await db.batch(statements);
    return json({ webhook: webhookOf((await readRow(env, id))!, person.id) });
  }

  if (segments.length === 2 && method === 'DELETE') {
    const db = env.INDEX_DB;
    // A team document's goes in the team's audit log, in the same batch (team-audit.ts).
    await db.batch([
      db.prepare('DELETE FROM webhooks WHERE id = ?').bind(id),
      ...(item.team_id
        ? [
            webhookAuditStatement(db, {
              type: 'webhook_removed',
              teamId: item.team_id,
              webhookId: id,
              name: row.name,
              kind: row.kind,
              host: row.host,
              actorId: person.id,
              at: now,
            }),
          ]
        : []),
    ]);
    return noContent();
  }

  if (segments.length === 3 && segments[2] === 'test' && method === 'POST') {
    if (row.paused_at !== null) return conflict('webhook_paused');
    const queued = await pingStatement(env.INDEX_DB, id, row.name, now).run();
    // Paused since it was read.
    if (queued.meta.changes === 0) return conflict('webhook_paused');
    return json({ queued: true }, { status: 202 });
  }

  if (segments.length === 3 && segments[2] === 'deliveries' && method === 'GET') {
    const rows =
      (
        await env.INDEX_DB.prepare(
          `SELECT * FROM (SELECT ${DELIVERY_COLUMNS} FROM webhook_deliveries
                          WHERE webhook_id = ?1 AND state <> 'pending' ORDER BY id DESC LIMIT ?2)
           UNION ALL
           SELECT * FROM (SELECT ${DELIVERY_COLUMNS} FROM webhook_deliveries
                          WHERE webhook_id = ?1 AND state = 'pending' ORDER BY id DESC LIMIT ?3)
           ORDER BY id DESC`,
        )
          .bind(id, WEBHOOK_DELIVERIES_KEPT, PENDING_LISTED)
          .all<{
            id: number;
            type: WebhookDelivery['type'];
            app: WebhookDelivery['app'];
            title: string;
            state: WebhookDelivery['state'];
            attempts: number;
            status: number | null;
            error: string | null;
            occurred_at: number;
            last_at: number | null;
            next_at: number;
          }>()
      ).results ?? [];
    return json({
      deliveries: rows.map((d): WebhookDelivery => ({
        id: d.id,
        type: d.type,
        app: d.app,
        title: d.title,
        state: d.state,
        attempts: d.attempts,
        status: d.status,
        error: d.error,
        occurredAt: d.occurred_at,
        lastAttemptAt: d.last_at,
        nextAttemptAt: d.state === 'pending' ? d.next_at : null,
      })),
    });
  }
  return notFound();
}

async function createWebhook(
  ctx: PersonContext,
  deps: WebhookRouteDeps,
  key: CryptoKey,
  loaded: Loaded,
): Promise<Response> {
  const { request, env, person } = ctx;
  const item = loaded.row;
  const body = await readObject(request);
  if (!body) return badRequest('invalid_webhook');
  const name = readName(body.name);
  const events = readEvents(body.events, item.app);
  const kind = body.kind;
  const who = body.who ?? 'anyone';
  if (!name || !events || !isWebhookKind(kind) || !isWebhookWho(who)) {
    return badRequest('invalid_webhook');
  }
  const parsed = parseWebhookUrl(body.url, kind);
  if (!parsed.ok) return badRequest(parsed.error);
  const resolved = await resolvesPublic(parsed.host, deps.resolve);
  if (resolved === 'private') return badRequest('webhook_url_private');
  if (resolved === 'unresolved') return badRequest('webhook_url_invalid');
  const count = await env.INDEX_DB.prepare('SELECT COUNT(*) AS n FROM webhooks WHERE item_id = ?')
    .bind(item.id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= WEBHOOKS_PER_DOCUMENT_MAX) return conflict('webhook_limit');

  const id = crypto.randomUUID();
  const secret = kind === 'json' ? newSigningSecret() : null;
  const db = env.INDEX_DB;
  const at = deps.now();
  // The cap again inside the insert: adds racing past the count above can't together pass it.
  const [added] = await db.batch([
    db
      .prepare(
        `INSERT INTO webhooks
           (id, item_id, kind, name, url_sealed, host, secret_sealed, events, who, created_by, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
         WHERE (SELECT COUNT(*) FROM webhooks WHERE item_id = ?2) < ?12`,
      )
      .bind(
        id,
        item.id,
        kind,
        name,
        await seal(key, urlContext(id), parsed.url.href),
        parsed.host,
        secret ? await seal(key, secretContext(id), secret) : null,
        storedEvents(events),
        who,
        person.id,
        at,
        WEBHOOKS_PER_DOCUMENT_MAX,
      ),
    ...linkHeld(ctx, loaded),
    // A team document's goes in the team's audit log, in the same batch (team-audit.ts).
    ...(item.team_id
      ? [
          webhookAuditStatement(db, {
            type: 'webhook_added',
            teamId: item.team_id,
            webhookId: id,
            name,
            kind,
            host: parsed.host,
            actorId: person.id,
            at,
          }),
        ]
      : []),
  ]);
  if (!added?.meta.changes) return conflict('webhook_limit');
  return json(
    { webhook: webhookOf((await readRow(env, id))!, person.id), secret },
    { status: 201 },
  );
}

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const shortText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;

/** PUT /app/items/:id/card-moves from the item's own app: its cards that changed status, for its own webhooks. */
export async function pushCardMoves(env: Env, itemId: string, request: Request): Promise<Response> {
  const body = await readObject(request);
  const list = body?.moves;
  if (!Array.isArray(list) || list.length > CARD_MOVES_MAX) return badRequest('invalid_moves');
  const moves: CardMove[] = [];
  for (const value of list) {
    const m = value as Record<string, unknown> | null;
    if (!m || typeof m !== 'object' || !isId(m.cardId) || !isTime(m.at)) {
      return badRequest('invalid_moves');
    }
    const from = shortText(m.from, 200);
    const to = shortText(m.to, 200);
    const cardKey = m.cardKey ?? null;
    if (!from || !to || (cardKey !== null && !Number.isInteger(cardKey))) {
      return badRequest('invalid_moves');
    }
    moves.push({
      cardId: m.cardId,
      cardKey: cardKey as number | null,
      card: shortText(m.card, 200) ?? 'Untitled',
      from,
      to,
      actorId: shortText(m.actorId, 200),
      actorName: shortText(m.actorName, 200),
      at: Math.min(Math.floor(m.at), Date.now() + FUTURE_SLACK_MS),
    });
  }
  if (moves.length > 0) await cardMovesStatement(env.INDEX_DB, itemId, moves).run();
  return noContent();
}
