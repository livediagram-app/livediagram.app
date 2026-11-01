# Webhooks: blueprint

Derived from [webhooks.md](../webhooks.md). The spec decides; this file only adds engineering precision, read from the
code. Paths are relative to the repository root.

Scope, by file:

| File                                                      | Role                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/migrations/0008_webhooks.sql`   | `webhooks` and `webhook_deliveries`                                                                                                                                                                                                                                          |
| `liveworkspace/apps/index/src/webhooks/routes.ts`         | `handleWebhooks` (the person routes), `pushCardMoves` (`PUT /app/items/:id/card-moves`), `webhookOf`                                                                                                                                                                         |
| `liveworkspace/apps/index/src/webhooks/outbox.ts`         | `webhookOutboxStatement`, `cardMovesStatement`, `pingStatement`, `isListened`, `queuedCount`, `kickWebhooks`                                                                                                                                                                 |
| `liveworkspace/apps/index/src/webhooks/dispatch.ts`       | `dispatch`: one alarm's sends, retries, give-ups and pauses                                                                                                                                                                                                                  |
| `liveworkspace/apps/index/src/webhooks/durable-object.ts` | `WebhookDispatcher`: `kick`, `alarm`                                                                                                                                                                                                                                         |
| `liveworkspace/apps/index/src/webhooks/address.ts`        | `parseWebhookUrl`, `isPrivateAddress`, `resolvesPublic`, `dohResolve`                                                                                                                                                                                                        |
| `liveworkspace/apps/index/src/webhooks/messages.ts`       | `summaryOf`, `jsonBodyOf`, `slackBodyOf`, `teamsBodyOf`, `bodyFor` (the 16 KiB cap)                                                                                                                                                                                          |
| `liveworkspace/apps/index/src/webhooks/sign.ts`           | `newSigningSecret`, `signatureOf`                                                                                                                                                                                                                                            |
| `liveworkspace/apps/index/src/webhooks/access.ts`         | `accountsAdminTeams`: the teams a person is an admin of now                                                                                                                                                                                                                  |
| `liveworkspace/apps/index/src/webhooks/purge.ts`          | `webhookPurgeStatements`: a closed account's webhooks                                                                                                                                                                                                                        |
| `liveworkspace/apps/index/src/webhooks/config.ts`         | the delivery numbers                                                                                                                                                                                                                                                         |
| `packages/index-client/src/webhooks.ts`                   | the events, kinds, labels, limits, headers and wire shapes; the client's webhook and card-move calls                                                                                                                                                                         |
| `packages/api-kit/src/sealed.ts`                          | `importSealKey`, `seal`, `unseal` (AES-GCM, `v1.<iv>.<ct>`), shared with the Drive mirror's refresh tokens                                                                                                                                                                   |
| `packages/index-app/src/outbox.ts`                        | the `card_moved` outbox kind, drained through `pushCardMoves`                                                                                                                                                                                                                |
| `liveplanner/apps/api/src/db/item-history.ts`             | a card's status change written as a `card_moved` outbox key beside its history                                                                                                                                                                                               |
| `liveworkspace/apps/site/components/settings/webhooks/`   | Settings › Webhooks: `WebhooksPanel` (the card), `AddWebhook` and `pickers` (destination, scope and event tiles), `WebhookRow`, `Deliveries`, `useSendTest` (a test's result, read back), `marks` (each destination's mark), `webhooks-api` (the client, refusals and words) |
| `packages/settings/src/account.ts`                        | `WEBHOOKS_CATEGORY`: the category's words, and a guest's stand-in in each editor's Settings                                                                                                                                                                                  |

## Domain and naming

| Term     | Identifier                                                       | Meaning                                                                                                         |
| -------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Webhook  | `webhooks` row, id a UUID                                        | one destination for one scope's events                                                                          |
| Kind     | `json`, `slack`, `teams`                                         | signed JSON, a Slack incoming webhook, a Teams Workflows webhook                                                |
| Scope    | `p:<person>`, `t:<team>`                                         | whose items it hears about: the item's own `items.scope` when the event is recorded                             |
| Event    | `WEBHOOK_EVENTS`                                                 | `created`, `renamed`, `moved`, `trashed`, `shared`, `commented`, `action_assigned`, `action_done`, `card_moved` |
| Delivery | `webhook_deliveries` row, `UNIQUE (webhook_id, event_id)`        | the outbox row, then a recent delivery                                                                          |
| Event id | the Timeline event's id; `cmv:<item>:<card>:<at>`; `ping:<uuid>` | the same on every retry: `X-Liveworkspace-Delivery`                                                             |
| Pause    | `paused`, `creator_left`, `failing`, `gone`                      | why nothing is sent                                                                                             |

## Behaviour and state

### Queuing (`outbox.ts`)

- `eventStatements` and `bulkEventStatements` (`timeline.ts`) append `webhookOutboxStatement` for each event whose
  type `isListened` (and, in bulk, that has an item). It is `INSERT OR IGNORE … SELECT` from `json_each(ids)` joined to
  `timeline_events`, `items` (for `i.scope`) and the scope's live webhooks (`webhooks_scope_live`), kept when
  `instr(w.events, ',<type>,')`, the event is no older than `WEBHOOK_FRESH_MS` (1 h) and the webhook has fewer than
  `WEBHOOK_PENDING_MAX` (500) pending (a count stopped at 500). The event's app, item, title, actor, name, detail and
  time are copied in; `next_at` is now.
- `cardMovesStatement`: the same over a plan's moves, `type` `card_moved`, `actor_id` null, the item's own title, the
  detail `{cardId, cardKey, card, from, to}`.
- `pingStatement`: a `ping` for one webhook, `app` `liveworkspace`, no item, its title the webhook's name.
- Each statement built adds one to the isolate's `queuedCount`. The Worker's `fetch` compares it before and after a
  request and, when it moved, `waitUntil(kickWebhooks(env))`: one read on `webhook_deliveries_due`
  (`state = 'pending' AND next_at <= now + 1 s`, `LIMIT 1`) and, when something is due, the dispatcher's `kick()`.
  Without the `WEBHOOKS` binding, nothing. The 15-minute cron calls `kickWebhooks` too (`step('webhooks')`).

### Sending (`dispatch.ts`, `durable-object.ts`)

- `kick()`: `setAlarm(now)` unless an alarm is set within `KICK_SLACK_MS` (500 ms).
- `alarm()`: `dispatch`, then `setAlarm(max(nextAt, now))` when `nextAt` is not null.
- `dispatch`: without a `WEBHOOK_KEY` that imports, nothing. Reads the due rows (`next_at <= now`, webhook live)
  oldest first, `LIMIT DISPATCH_BATCH` (50); groups them by webhook; runs `DISPATCH_CONCURRENCY` (6) webhooks at once,
  each webhook's rows in order:
  1. A team's: `adminTeams(created_by)`, once a run per person. Null (accounts down, no key): every row's `next_at`
     moves to now + `ACCESS_RETRY_MS` (1 min), no try counted. Not an admin of the team: paused `creator_left`.
  2. Unseal the URL (`<id>:url`) and, for `json`, the secret (`<id>:secret`); re-check the URL's shape. Either fails:
     each row given up, `error` `unreadable`.
  3. Resolve the host, once a run per host: `private` gives each row up (`private_address`); `unresolved` retries
     (`dns`).
  4. Send: `POST`, `redirect: 'manual'`, `AbortSignal.timeout(DELIVERY_TIMEOUT_MS)` (10 s), the body from `bodyFor`,
     headers `Content-Type`, `User-Agent: liveworkspace-webhooks/1`, `X-Liveworkspace-Event`, `-Delivery`,
     `-Timestamp` (Unix seconds) and, for `json`, `-Signature` (`v1=` HMAC-SHA256 hex over `<timestamp>.<body>`). The
     answer's body is cancelled, never read.
  5. 2xx: `delivered`. 3xx: given up (`redirect`). 410: given up and paused `gone`, stopping. 408, 429, 5xx, a
     timeout (`timeout`) or a network error (`network`): `attempts + 1` and `next_at = now + RETRY_DELAYS_MS[attempts]`,
     the webhook's later rows moved to at least that time, stopping; with no delay left, given up. Any other 4xx:
     given up.
  6. One batch: each row's update, `failures` (reset to the run's given-ups after a success, else added to,
     `RETURNING failures`), and the trim (finished rows past the newest `WEBHOOK_DELIVERIES_KEPT`, 20). At
     `FAILING_PAUSE_AFTER` (20) failures, paused `failing`.
- Pausing: `paused_at`, `paused_reason`, and every pending row `failed` with `error` `paused`.
- `nextAt`: now when the run took a full batch, else `MIN(next_at)` of the pending rows, else null.

### Routes (`routes.ts`)

| Route                           | Body / answer                                                   | Refusals                                                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /webhooks`                 | `{webhooks}`: `p:<me>` and each `t:<team>` I am an admin of now | accounts down: my own only                                                                                                                                            |
| `POST /webhooks`                | `{name, kind, url, events, teamId?}` → 201 `{webhook, secret}`  | `400 invalid_webhook`, `webhook_url_invalid`, `webhook_url_private`; `403 not_team_admin`; `409 webhook_limit`; `503 webhooks_unavailable` (accounts down for a team) |
| `PATCH /webhooks/:id`           | `{name?, events?, paused?}` → `{webhook}`                       | `400 invalid_webhook`                                                                                                                                                 |
| `DELETE /webhooks/:id`          | 204 (deliveries cascade)                                        |                                                                                                                                                                       |
| `POST /webhooks/:id/test`       | 202 `{queued: true}`                                            | `409 webhook_paused`                                                                                                                                                  |
| `GET /webhooks/:id/deliveries`  | `{deliveries}`, newest 40                                       |                                                                                                                                                                       |
| `PUT /app/items/:id/card-moves` | `{moves}` (≤ `CARD_MOVES_MAX` 100) → 204                        | `400 invalid_moves`; `403 wrong_app`                                                                                                                                  |

Every person route: `403 webhooks_need_account` for a guest, an app's delegate or the Drive mirror (which never gets
this far: `404`); `503 webhooks_unavailable` without `WEBHOOK_KEY`; `404 webhook_not_found` for an id that isn't one,
or isn't mine or a team's I run now. Names are trimmed (1 to 80); events are de-duplicated (at least one). Pausing
gives up what waits; resuming clears `failures` and makes the caller `created_by`. A card move's text is cut to
200, its `at` to now + 5 minutes; `card` empty is `Untitled`.

## Errors and edge cases

- An event about an item no webhook hears writes nothing; one older than an hour (a late push) is not queued.
- A team webhook whose creator left the team, or is no longer an admin, pauses at its next delivery, not before.
- An outbox row whose webhook was deleted goes with it (cascade); one whose webhook paused is failed `paused`.
- A Durable Object call that throws is logged and the next request or the cron tries again: nothing is lost, as
  the rows wait in D1.

## Data and persistence

| Table                | Key                            | Indexes                                                                                                          |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `webhooks`           | `id`                           | `webhooks_scope_live (scope) WHERE paused_at IS NULL`; `webhooks_creator (created_by)`                           |
| `webhook_deliveries` | `id`; `(webhook_id, event_id)` | `webhook_deliveries_due (next_at) WHERE state = 'pending'`; `webhook_deliveries_webhook (webhook_id, state, id)` |

`webhooks.events` is comma-wrapped (`,created,moved,`); `url_sealed` and `secret_sealed` are `v1.<iv>.<ct>`;
`host` is the URL's host, in the clear. `webhook_deliveries` cascades from `webhooks`. A closed account
(`webhookPurgeStatements`, in the purge's first batch): its `p:` webhooks and those of the teams closed with it are
deleted, its others' pending rows failed (`paused`), and they paused `creator_left` with `created_by` `deleted`.

## Security and trust

- `parseWebhookUrl`: a string of 1 to 2,048; `https:`; no user name or password; port empty or 443; host lowercased,
  a trailing dot dropped; an IPv4 or IPv6 literal, `localhost`, a single label, or a name under `.local`,
  `.localhost`, `.internal`, `.lan`, `.home.arpa`, `.intranet` is `webhook_url_private`. Slack: host
  `hooks.slack.com` and a path under `/services/`. Teams: a host under `.logic.azure.com` or `.powerplatform.com`.
- `isPrivateAddress`: IPv4 `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.0.0/24`,
  `192.0.2/24`, `192.88.99/24`, `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4`; IPv6 `::/96`
  (unspecified, loopback, compatible), mapped `::ffff:0:0/96` and NAT64 `64:ff9b::/96` judged by their IPv4,
  `fc00::/7`, `fe80::/10`, `fec0::/10`, `ff00::/8`, `2001:db8::/32`, `2002::/16`, `100::/64`; anything unparsable.
- `dohResolve`: `https://cloudflare-dns.com/dns-query?name=&type=A|AAAA`, `accept: application/dns-json`, 3 s each,
  the A and AAAA answers (CNAMEs skipped); null on any failure.
- Sealing: `importSealKey(WEBHOOK_KEY)` (base64 or base64url of 32 bytes); each seal a fresh 12-byte IV and the
  context as AES-GCM additional data.
- The dispatcher never follows a redirect and never reads an answer's body. Its fetches go through
  `global_fetch_strictly_public`.

## Performance and limits

- An event write: one more statement in its batch, an index probe of `webhooks_scope_live` that writes nothing when
  no webhook listens. A request that built one: one indexed read after answering, and one Durable Object call only
  when something is due.
- A run: at most 50 sends, 6 at a time, each at most 10 s; one D1 read, one batch per webhook, one `MIN` read.
- A webhook holds at most 500 pending and 20 finished deliveries; a scope at most 10 webhooks.

## Observability

| Level  | Line                                                  | Where               |
| ------ | ----------------------------------------------------- | ------------------- |
| `log`  | `[webhooks] dispatched {delivered, failed, retrying}` | `durable-object.ts` |
| `warn` | `[index] webhooks kick failed`                        | `outbox.ts`         |

## Testing

| Test                                                     | Pins                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/webhooks/routes.test.ts`   | who may add one (own, team admins checked now, never a guest, delegate, Drive or link Editor), sealing, the checks, the limit, pause and resume, delete, test, deliveries                                                              |
| `liveworkspace/apps/index/src/webhooks/outbox.test.ts`   | what queues (own items, team items, collab events once, not paused, not stale, the pending cap), card moves, waking after the answer and from the cron                                                                                 |
| `liveworkspace/apps/index/src/webhooks/dispatch.test.ts` | the signed POST, Slack, retries and give-ups, each status, timeouts, 410, failing, private and unresolved hosts, unreadable seals, a team creator who left, accounts down, the batch, the trim, the Durable Object, closing an account |
| `liveworkspace/apps/index/src/webhooks/address.test.ts`  | the URL rules, each blocked range, resolving                                                                                                                                                                                           |
| `liveworkspace/apps/index/src/webhooks/messages.test.ts` | each sentence, each body, the cap, the signature                                                                                                                                                                                       |
| `packages/index-client/src/webhooks.test.ts`             | the contract and the client's calls                                                                                                                                                                                                    |
| `packages/api-kit/src/sealed.test.ts`                    | sealing                                                                                                                                                                                                                                |
| `packages/index-app/src/outbox.test.ts`                  | the `card_moved` kind                                                                                                                                                                                                                  |
| `liveplanner/apps/api/src/db/item-history.test.ts`       | a card's status change queues a move                                                                                                                                                                                                   |

## Constants and configuration

`WEBHOOK_FRESH_MS` 1 h, `DELIVERY_TIMEOUT_MS` 10 s, `RETRY_DELAYS_MS` 1 min, 5 min, 30 min, 2 h, 6 h, 12 h,
`DISPATCH_BATCH` 50, `DISPATCH_CONCURRENCY` 6, `FAILING_PAUSE_AFTER` 20, `ACCESS_RETRY_MS` 1 min, `DISPATCHER_NAME`
`deliveries` (`config.ts`); `KICK_SLACK_MS` 500 ms (`durable-object.ts`); `DELIVERIES_LISTED` 40 (`routes.ts`);
`DETAIL_TEXT_MAX` 500, `CHAT_TEXT_MAX` 300 (`messages.ts`); `WEBHOOKS_PER_SCOPE_MAX` 10, `WEBHOOK_NAME_MAX` 80,
`WEBHOOK_URL_MAX` 2,048, `WEBHOOK_PAYLOAD_MAX_BYTES` 16,384, `WEBHOOK_DELIVERIES_KEPT` 20, `WEBHOOK_PENDING_MAX` 500,
`CARD_MOVES_MAX` 100 (`packages/index-client`). Secret `WEBHOOK_KEY`; binding `WEBHOOKS` (`WebhookDispatcher`,
migration tag `v1`, `new_sqlite_classes`).

## Defaults ledger

- `IDX15`: an address given as an IP literal is refused, public or not.
- `IDX16`: only port 443 is taken.
- `IDX17`: a redirect gives the delivery up without retrying; other 4xx but 408, 410 and 429 give up too.
- `IDX18`: accounts unreachable holds a team webhook's deliveries a minute, counting no try.
- `IDX19`: a card move dated more than 5 minutes ahead is dated now + 5 minutes; its texts are cut to 200.
- `IDX20`: a webhook's deliveries list answers at most 40, newest first.
