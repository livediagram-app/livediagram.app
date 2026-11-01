// Managing webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them", "Who adds one"): a signed-in
// account's own (`p:<person>`), and those of each team it is an admin of now, asked of accounts each request. Nobody
// else: a guest, an app or the Drive mirror acting for a person, a link visitor. A webhook the caller can't manage
// answers 404, never 403, so its id tells them nothing.
//
//   GET    /webhooks                 the caller's own, and their teams'
//   POST   /webhooks                 {name, kind, url, events, teamId?} → 201 {webhook, secret}
//   PATCH  /webhooks/:id             {name?, events?, paused?} → {webhook}
//   DELETE /webhooks/:id             204
//   POST   /webhooks/:id/test        202: queues a `ping`
//   GET    /webhooks/:id/deliveries  {deliveries}: its newest, pending and finished

import { importSealKey, seal } from '@liveworkspace/api-kit/sealed';
import {
  isWebhookEvent,
  isWebhookKind,
  WEBHOOK_NAME_MAX,
  WEBHOOKS_PER_SCOPE_MAX,
  type CardMove,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookKind,
  type WebhookPauseReason,
  CARD_MOVES_MAX,
} from '@liveworkspace/index-client';
import { personalScope, teamScope } from '../auth';
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
import { accountsAdminTeams, type AdminTeams } from './access';
import { dohResolve, parseWebhookUrl, resolvesPublic, type Resolve } from './address';
import { secretContext, urlContext } from './dispatch';
import { cardMovesStatement, pingStatement } from './outbox';
import { newSigningSecret } from './sign';

export type WebhookRouteDeps = { adminTeams: AdminTeams; resolve: Resolve; now: () => number };

const defaultDeps = (env: Env): WebhookRouteDeps => ({
  adminTeams: accountsAdminTeams(env),
  resolve: dohResolve,
  now: () => Date.now(),
});

// The newest deliveries a webhook's list shows: its kept finished ones and what is still waiting.
const DELIVERIES_LISTED = 40;

type WebhookRow = {
  id: string;
  scope: string;
  kind: WebhookKind;
  name: string;
  host: string;
  events: string;
  created_by: string;
  created_at: number;
  paused_at: number | null;
  paused_reason: WebhookPauseReason | null;
  last: string | null;
};

const COLUMNS = `w.id, w.scope, w.kind, w.name, w.host, w.events, w.created_by, w.created_at, w.paused_at,
  w.paused_reason,
  (SELECT json_object('state', d.state, 'status', d.status, 'at', d.last_at) FROM webhook_deliveries d
    WHERE d.webhook_id = w.id AND d.state <> 'pending' ORDER BY d.id DESC LIMIT 1) AS last`;

export function webhookOf(row: WebhookRow): Webhook {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    teamId: row.scope.startsWith('t:') ? row.scope.slice(2) : null,
    host: row.host,
    events: row.events.split(',').filter(isWebhookEvent),
    createdAt: row.created_at,
    pausedAt: row.paused_at,
    pausedReason: row.paused_reason,
    lastDelivery: row.last ? (JSON.parse(row.last) as Webhook['lastDelivery']) : null,
  };
}

// Events as stored: comma-wrapped, so one `instr` matches a type.
const storedEvents = (events: readonly WebhookEvent[]) => `,${events.join(',')},`;

function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= WEBHOOK_NAME_MAX ? name : null;
}

function readEvents(value: unknown): WebhookEvent[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isWebhookEvent)) return null;
  return [...new Set(value)];
}

async function readRow(env: Env, id: string): Promise<WebhookRow | null> {
  return env.INDEX_DB.prepare(`SELECT ${COLUMNS} FROM webhooks w WHERE w.id = ?`)
    .bind(id)
    .first<WebhookRow>();
}

export async function handleWebhooks(
  ctx: PersonContext,
  deps: WebhookRouteDeps = defaultDeps(ctx.env),
): Promise<Response> {
  const { request, env, segments, person } = ctx;
  // An account's own session only: never a guest, an app or the Drive mirror acting for one.
  if (person.kind !== 'account' || person.app || person.drive) {
    return forbidden('webhooks_need_account');
  }
  const key = await importSealKey(env.WEBHOOK_KEY);
  if (!key) return fail(503, 'webhooks_unavailable');
  const method = request.method;
  const own = personalScope(person.id);
  // The teams the caller runs, asked once per request.
  let admins: Promise<ReadonlySet<string> | null> | null = null;
  const adminTeams = () => (admins ??= deps.adminTeams(person.id));

  if (segments.length === 1) {
    if (method === 'GET') {
      const teams = (await adminTeams()) ?? new Set<string>();
      const scopes = [own, ...[...teams].map(teamScope)];
      const rows =
        (
          await env.INDEX_DB.prepare(
            `SELECT ${COLUMNS} FROM webhooks w WHERE w.scope IN (SELECT value FROM json_each(?))
             ORDER BY w.created_at, w.id`,
          )
            .bind(JSON.stringify(scopes))
            .all<WebhookRow>()
        ).results ?? [];
      return json({ webhooks: rows.map(webhookOf) });
    }
    if (method === 'POST') return createWebhook(ctx, deps, key, adminTeams);
    return notFound();
  }

  const id = segments[1]!;
  if (!isId(id)) return notFound('webhook_not_found');
  const row = await readRow(env, id);
  // Yours, or a team's you run now.
  const manageable =
    row !== null &&
    (row.scope === own ||
      (row.scope.startsWith('t:') && ((await adminTeams())?.has(row.scope.slice(2)) ?? false)));
  if (!row || !manageable) return notFound('webhook_not_found');
  const now = deps.now();

  if (segments.length === 2 && method === 'PATCH') {
    const body = await readObject(request);
    if (!body) return badRequest('invalid_webhook');
    const name = body.name === undefined ? row.name : readName(body.name);
    const events = body.events === undefined ? null : readEvents(body.events);
    if (name === null || (body.events !== undefined && !events))
      return badRequest('invalid_webhook');
    if (body.paused !== undefined && typeof body.paused !== 'boolean') {
      return badRequest('invalid_webhook');
    }
    const db = env.INDEX_DB;
    const statements = [
      db
        .prepare('UPDATE webhooks SET name = ?, events = COALESCE(?, events) WHERE id = ?')
        .bind(name, events ? storedEvents(events) : null, id),
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
    // Resumed: the count of failures starts again, and whoever resumed it is its creator now (a team's, an admin).
    if (body.paused === false && row.paused_at !== null) {
      statements.push(
        db
          .prepare(
            `UPDATE webhooks SET paused_at = NULL, paused_reason = NULL, failures = 0, created_by = ?
             WHERE id = ?`,
          )
          .bind(person.id, id),
      );
    }
    await db.batch(statements);
    return json({ webhook: webhookOf((await readRow(env, id))!) });
  }

  if (segments.length === 2 && method === 'DELETE') {
    await env.INDEX_DB.prepare('DELETE FROM webhooks WHERE id = ?').bind(id).run();
    return noContent();
  }

  if (segments.length === 3 && segments[2] === 'test' && method === 'POST') {
    if (row.paused_at !== null) return conflict('webhook_paused');
    await pingStatement(env.INDEX_DB, id, row.name, now).run();
    return json({ queued: true }, { status: 202 });
  }

  if (segments.length === 3 && segments[2] === 'deliveries' && method === 'GET') {
    const rows =
      (
        await env.INDEX_DB.prepare(
          `SELECT id, type, title, state, attempts, status, error, occurred_at, last_at, next_at
           FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT ?`,
        )
          .bind(id, DELIVERIES_LISTED)
          .all<{
            id: number;
            type: WebhookDelivery['type'];
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
  adminTeams: () => Promise<ReadonlySet<string> | null>,
): Promise<Response> {
  const { request, env, person } = ctx;
  const body = await readObject(request);
  if (!body) return badRequest('invalid_webhook');
  const name = readName(body.name);
  const events = readEvents(body.events);
  const kind = body.kind;
  const teamId = body.teamId ?? null;
  if (!name || !events || !isWebhookKind(kind) || (teamId !== null && !isId(teamId))) {
    return badRequest('invalid_webhook');
  }
  if (teamId !== null) {
    const teams = await adminTeams();
    if (!teams) return fail(503, 'webhooks_unavailable');
    if (!teams.has(teamId)) return forbidden('not_team_admin');
  }
  const parsed = parseWebhookUrl(body.url, kind);
  if (!parsed.ok) return badRequest(parsed.error);
  const resolved = await resolvesPublic(parsed.host, deps.resolve);
  if (resolved === 'private') return badRequest('webhook_url_private');
  if (resolved === 'unresolved') return badRequest('webhook_url_invalid');
  const scope = teamId ? teamScope(teamId) : personalScope(person.id);
  const count = await env.INDEX_DB.prepare('SELECT COUNT(*) AS n FROM webhooks WHERE scope = ?')
    .bind(scope)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= WEBHOOKS_PER_SCOPE_MAX) return conflict('webhook_limit');

  const id = crypto.randomUUID();
  const secret = kind === 'json' ? newSigningSecret() : null;
  await env.INDEX_DB.prepare(
    `INSERT INTO webhooks (id, scope, kind, name, url_sealed, host, secret_sealed, events, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      scope,
      kind,
      name,
      await seal(key, urlContext(id), parsed.url.href),
      parsed.host,
      secret ? await seal(key, secretContext(id), secret) : null,
      storedEvents(events),
      person.id,
      deps.now(),
    )
    .run();
  return json({ webhook: webhookOf((await readRow(env, id))!), secret }, { status: 201 });
}

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const shortText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;

/** PUT /app/items/:id/card-moves from the item's own app: its cards that changed status, for its scope's webhooks. */
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
      actorName: shortText(m.actorName, 200),
      at: Math.min(Math.floor(m.at), Date.now() + FUTURE_SLACK_MS),
    });
  }
  if (moves.length > 0) await cardMovesStatement(env.INDEX_DB, itemId, moves).run();
  return noContent();
}
