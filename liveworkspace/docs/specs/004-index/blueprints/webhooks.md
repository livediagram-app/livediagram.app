# Webhooks: blueprint

Derived from [webhooks.md](../webhooks.md). The spec decides; this file only adds engineering precision, read from the
code. Paths are relative to the repository root.

Scope, by file:

| File                                                                   | Role                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/migrations/0008_webhooks.sql`                | `webhooks` and `webhook_deliveries` as first made (account and team scopes)                                                                                                                                                                                                                                                                                                                                                 |
| `liveworkspace/apps/index/migrations/0014_document_webhooks.sql`       | both tables dropped and made again, each webhook tied to one item (`item_id`, cascading), with `who`                                                                                                                                                                                                                                                                                                                        |
| `liveworkspace/apps/index/src/webhooks/routes.ts`                      | `handleItemWebhooks` (`/items/:id/webhooks`), `handleWebhooks` (`/webhooks/:id…`), `editableItem` (the access check), `pushCardMoves` (`PUT /app/items/:id/card-moves`), `webhookOf`                                                                                                                                                                                                                                        |
| `liveworkspace/apps/index/src/webhooks/automation-sends.ts`            | `pushAutomationSends` (`POST /app/items/:id/automation-sends`): each send's checks, its delivery id, its result and the refusals' words                                                                                                                                                                                                                                                                                     |
| `liveworkspace/apps/index/src/webhooks/outbox.ts`                      | `webhookOutboxStatement`, `cardMovesStatement`, `formResponseStatement`, `automationTargets`, `automationSendStatement`, `pingStatement`, `isListened`, `kickWebhooks`                                                                                                                                                                                                                                                      |
| `liveworkspace/apps/index/src/collab-push.ts`                          | `pushForm` queues a form's new responses in its batch (`formResponseStatement`)                                                                                                                                                                                                                                                                                                                                             |
| `liveworkspace/apps/index/src/webhooks/dispatch.ts`                    | `dispatch`: one alarm's sends, retries, give-ups and pauses; `creatorCanEdit`                                                                                                                                                                                                                                                                                                                                               |
| `liveworkspace/apps/index/src/webhooks/durable-object.ts`              | `WebhookDispatcher`: `kick`, `alarm`                                                                                                                                                                                                                                                                                                                                                                                        |
| `liveworkspace/apps/index/src/webhooks/address.ts`                     | `parseWebhookUrl`; `isPrivateAddress`, `resolvesPublic` and `dohResolve` from `@liveworkspace/api-kit/public-address`, shared with the MCP's image upload by URL                                                                                                                                                                                                                                                            |
| `liveworkspace/apps/index/src/webhooks/messages.ts`                    | `summaryOf`, `jsonBodyOf`, `slackBodyOf`, `teamsBodyOf`, `bodyFor` (the 16 KiB cap); an automation send's message, card and rule (`AutomationDetail`)                                                                                                                                                                                                                                                                       |
| `liveworkspace/apps/index/src/webhooks/sign.ts`                        | `newSigningSecret`, `signatureOf`                                                                                                                                                                                                                                                                                                                                                                                           |
| `liveworkspace/apps/index/src/accounts-access.ts`                      | `accountsPersonTeams`: every team a person is in now, for a team document's creator check                                                                                                                                                                                                                                                                                                                                   |
| `liveworkspace/apps/index/src/webhooks/purge.ts`                       | `webhookPurgeStatements`: a closed account's webhooks                                                                                                                                                                                                                                                                                                                                                                       |
| `liveworkspace/apps/index/src/webhooks/config.ts`                      | the delivery numbers                                                                                                                                                                                                                                                                                                                                                                                                        |
| `packages/index-client/src/webhooks.ts`                                | the events, `WEBHOOK_EVENT_APPS`, `webhookEventsOf`, Who Did It, kinds, labels, limits, headers and wire shapes (`AutomationSend`, `AutomationSendResult`); the client's webhook, card-move and automation-send calls                                                                                                                                                                                                       |
| `packages/api-kit/src/sealed.ts`                                       | `importSealKey`, `seal`, `unseal` (AES-GCM, `v1.<iv>.<ct>`), shared with the Drive mirror's refresh token                                                                                                                                                                                                                                                                                                                   |
| `packages/index-app/src/outbox.ts`                                     | the `card_moved` outbox kind (with the mover's `actorId`), drained through `pushCardMoves`                                                                                                                                                                                                                                                                                                                                  |
| `liveplanner/apps/api/src/db/item-history.ts`                          | a card's status change written as a `card_moved` outbox key beside its history, `actorId` the history's `by.id`                                                                                                                                                                                                                                                                                                             |
| `packages/settings-ui/src/webhooks/`                                   | `@liveworkspace/settings-ui/webhooks`: `DocumentWebhooksDialog` (the one dialog shell, on the dialog hero header: "Webhooks for “<name>”", "<Kind> · These apply to this <kind> only"), `DocumentWebhooks` (its body: the list, `AddWebhook`, `WebhookRow`, `WebhookEvents`, `Deliveries`, `ConnectPanel`, the pickers), `documentWebhooksApi` (the calls bound to one item and its share link), `DocumentWebhooksProvider` |
| `packages/explorer/src/library/WebhooksDialog.tsx`                     | the Explorer's door: `DocumentWebhooksDialog` with the item's thumbnail and `AppMark`; lazy from `Dialogs.tsx`                                                                                                                                                                                                                                                                                                              |
| `packages/workbench/src/components/dialogs/DocumentWebhooksDialog.tsx` | the editors' door: `DocumentWebhooksDialog` (the shared dialog, lazy, through the workbench's `indexClient` and the page's share code) and `WebhooksGlyph`; each editor's `ExplorerHeaderMenu` offers Webhooks after Export when its host's `canManageWebhooks` (hydrated, signed in, not read-only, not participating, no tab scope)                                                                                       |
| `packages/explorer/src/explorer/menus.tsx`                             | `ItemMenu`'s Webhooks row: an item the person edits (`access === 'edit'`), signed in (`useExtras().signedIn`); opens `{kind: 'webhooks', item}`                                                                                                                                                                                                                                                                             |

## Domain and naming

| Term       | Identifier                                                                                                                           | Meaning                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook    | `webhooks` row, id a UUID                                                                                                            | one destination for one item's events                                                                                                                                                                                                                                              |
| Document   | `webhooks.item_id`                                                                                                                   | the item it belongs to and reports on; its app is the item's                                                                                                                                                                                                                       |
| Kind       | `json`, `slack`, `teams`                                                                                                             | signed JSON, a Slack incoming webhook, a Teams Workflows webhook                                                                                                                                                                                                                   |
| Event      | `WEBHOOK_EVENTS`                                                                                                                     | `renamed`, `moved`, `trashed`, `shared`, `commented`, `action_assigned`, `action_done`, `card_moved`, `form_response`; `card_moved` and `form_response` are liveplanner's alone (`WEBHOOK_EVENT_APPS`); `automation` is a delivery type (`WebhookDeliveryType`), never one of them |
| Who Did It | `who`: `anyone`, `me`                                                                                                                | every editor's events, or only those whose actor is the webhook's `created_by`                                                                                                                                                                                                     |
| Delivery   | `webhook_deliveries` row, `UNIQUE (webhook_id, event_id)`                                                                            | the outbox row, then a recent delivery                                                                                                                                                                                                                                             |
| Event id   | the logged event's id; `cmv:<item>:<card>:<at>`; `frm:<item>:<tab>:<responses>`; `aut:<sha256 of item, webhook, key>`; `ping:<uuid>` | the same on every retry: `X-Liveworkspace-Delivery`                                                                                                                                                                                                                                |
| Pause      | `paused`, `creator_left`, `failing`, `gone`                                                                                          | why nothing is sent                                                                                                                                                                                                                                                                |

## Behaviour and state

### Queuing (`outbox.ts`)

- `eventStatements` and `bulkEventStatements` (`events.ts`) append `webhookOutboxStatement` for each event whose
  type `isListened` (and, in bulk, that has an item). It is `INSERT OR IGNORE … SELECT` from `json_each(ids)` joined to
  `events`, `items` and the item's own live webhooks (`webhooks_item_live`), kept when
  `instr(w.events, ',<type>,')`, `w.who = 'anyone' OR w.created_by = e.actor_id`, the event is no older than
  `WEBHOOK_FRESH_MS` (1 h) and the webhook has fewer than `WEBHOOK_PENDING_MAX` (500) pending (a count stopped at
  500). The event's app, item, title, actor, name, detail and time are copied in; `next_at` is now, or the
  webhook's newest pending row's `next_at` when that is later (a retry waiting), so it never goes ahead of it.
- `cardMovesStatement`: the same over a plan's moves, `type` `card_moved`, `actor_id` the move's `actorId` (Only Me
  matches on it; a move without one never reaches an Only Me webhook), the item's own title, the detail
  `{cardId, cardKey, card, from, to}`.
- `formResponseStatement` (`pushForm`, when the pushed count is above 0): `INSERT OR IGNORE … SELECT` from the held
  `collab_forms` row joined to `items` and the plan's listening webhooks, kept when the pushed `responses` is above
  the held one; one batch with the upsert that stores the new count, the delivery first. `type` `form_response`, no
  actor (so never an Only Me webhook), the detail `{form, responses, total}` (the heading, the rise and the new count,
  as text), `occurred_at` the form's `latestAt` (at most now). No held row (a form never pushed, or published again
  after `form: null`): nothing.
- Automation sends (`automation-sends.ts` `pushAutomationSends`, liveplanner only). Each send is checked whole or
  the push is `400 invalid_sends`: `key` and `webhookId` strings of 1 to 200, `rule` a string (trimmed, cut to
  `AUTOMATION_RULE_MAX` 60, empty `Untitled`), `text` a string not blank (cut to `AUTOMATION_TEXT_MAX` 2,000),
  `card` null or `{key: integer, title: string, url: string}` (the title trimmed and cut to 200, empty `Untitled`),
  `at` a time (at most now). The card's `url` is kept only on the app's own origin (`appOrigin`, the URL's `href`
  with `|` as `%7C`, which would end a Slack link), else null, so a chat's link can't point elsewhere. Each send's
  delivery id is `aut:<sha256 hex of item, webhook and key>`. Then `automationTargets` (`outbox.ts`): one batch of
  two reads, the named webhooks that are the item's (`item_id = ? AND id IN json_each`, with `paused_at`,
  `paused_reason` and the pending count stopped at 500) and which of the sends' deliveries are already written (a
  join on `(webhook_id, event_id)`). That settles each result, in order: already written, or the same webhook and
  key earlier in the push, `queued`; not the item's (or gone) `webhook_not_found`; paused `webhook_paused`, its
  reason in words ("This webhook is paused: the address said it’s gone"); at the cap, counting the push's sends
  queued ahead on the same webhook, `webhook_full` ("Too many messages waiting for this webhook"). Then
  `automationSendStatement`: one `INSERT OR IGNORE … SELECT` from `json_each` of the queued ones, `type`
  `automation`, no actor (`actor_name` `Automation`), the item's title, the detail `{rule, card: {key, title, url} |
null, text}`, `occurred_at` the send's `at`, `next_at` as `cardMovesStatement`'s. It joins the webhook again
  (`item_id`, `paused_at IS NULL`) and checks the cap with each row's `ahead`, so a pause or a burst landing between
  the read and the write writes no row past them (the result already said queued). The event filter, Who Did It and
  `WEBHOOK_FRESH_MS` are not applied: the send is addressed. An empty push answers `{results: []}` and writes
  nothing.
- `messages.ts` for `automation`: the summary is the message itself. Slack: the message, then a line with the card
  (`#48 Publish pricing page`) and `<url|Open in liveplanner>` (the card's link, else the plan's), and "Automation ·
  <rule>" in the context block, every text escaped, the escaped message cut so the section stays within Slack's
  3,000 characters (`SLACK_SECTION_MAX`; never inside an `&amp;`). Teams: the message, the card, "Automation ·
  <rule>", each a plain `TextRun` in a `RichTextBlock` (no Markdown, for every event), and the Open in liveplanner
  button to the same link. A plain webhook's `detail` is the stored one whole (the card nested;
  `shortened` cuts only string values).
- `pingStatement`: a `ping` for one webhook, `app` `liveworkspace`, no item, its title the webhook's name, inserted
  only while the webhook is not paused (`INSERT ... SELECT ... WHERE paused_at IS NULL`); no row written is
  `409 webhook_paused`.
- Each statement built adds one to the isolate's `queuedCount`. The Worker's `fetch` compares it before and after a
  request and, when it moved, `waitUntil(kickWebhooks(env))`: one read on `webhook_deliveries_due`
  (`state = 'pending' AND next_at <= now + 1 s`, `LIMIT 1`) and, when something is due, the dispatcher's `kick()`.
  Without the `WEBHOOKS` binding, nothing. The 15-minute cron calls `kickWebhooks` too (`step('webhooks')`).

### Sending (`dispatch.ts`, `durable-object.ts`)

- `kick()`: `setAlarm(now)` unless an alarm is set within `KICK_SLACK_MS` (500 ms).
- `alarm()`: `dispatch`, then `setAlarm(roomAlarmAt(nextAt, now))` when `nextAt` is not null: never sooner than a
  second from now (`@liveworkspace/api-kit/room-alarm`), so a row stuck due can't fire the alarm back to back.
- `dispatch`: without a `WEBHOOK_KEY` that imports, nothing. Reads the due rows (`next_at <= now`, webhook live, no
  earlier pending row of the webhook not yet due) oldest first by `id`, `LIMIT DISPATCH_BATCH` (50), through
  `INDEXED BY webhook_deliveries_due` (unforced, SQLite walks every row in `id` order to skip the sort); groups them by webhook; runs `DISPATCH_CONCURRENCY` (6) webhooks at once,
  each webhook's rows in order:
  1. `creatorCanEdit`: `created_by` still edits the whole item. The owner of a personal item: yes. Else a
     `shared_with` row for them on the item whose `share_links` row is live, `level = 'edit'` and `tab_id IS NULL`:
     yes. Else a team item: `personTeams(created_by)` (accounts' `/api/account/index/teams`), once a run per person,
     holding the item's team. Null (accounts down, no key): every pending row of the webhook from the run's first has its `next_at` moved to now +
     `ACCESS_RETRY_MS` (1 min), no try counted. No: paused `creator_left`.
  2. Unseal the URL (`<id>:url`) and, for `json`, the secret (`<id>:secret`); re-check the URL's shape. Either fails:
     each row given up, `error` `unreadable`.
  3. Resolve the host again right before each row's send, never cached across rows (DNS rebinding): `private` gives
     that row and the run's later rows up (`private_address`); `unresolved` retries (`dns`).
  4. Send: `POST`, `redirect: 'manual'`, `AbortSignal.timeout(DELIVERY_TIMEOUT_MS)` (10 s), the body from `bodyFor`,
     headers `Content-Type`, `User-Agent: liveworkspace-webhooks/1`, `X-Liveworkspace-Event`, `-Delivery`,
     `-Timestamp` (Unix seconds) and, for `json`, `-Signature` (`v1=` HMAC-SHA256 hex over `<timestamp>.<body>`). The
     answer's body is cancelled, never read.
  5. 2xx: `delivered`. 3xx: given up (`redirect`). 410: given up and paused `gone`, stopping. 408, 429, 5xx, a
     timeout (`timeout`) or a network error (`network`): `attempts + 1` and `next_at = now + RETRY_DELAYS_MS[attempts]`,
     every later pending row of the webhook (in the run or not) moved to at least that time, stopping; with no delay left, given up. Any other 4xx:
     given up.
  6. One batch: each row's update, `failures` (reset to the run's given-ups after a success, else added to,
     `RETURNING failures`), and the trim (finished rows past the newest `WEBHOOK_DELIVERIES_KEPT`, 20). At
     `FAILING_PAUSE_AFTER` (20) failures, paused `failing`.
- Pausing: `paused_at`, `paused_reason`, and every pending row `failed` with `error` `paused`.
- `nextAt`: now when the run took a full batch, else the soonest `next_at` of the pending rows whose webhook is not
  paused (the due index in order, `LIMIT 1`), at least `DISPATCH_MIN_GAP_MS` (1 s) from now, else null. A pending
  row left on a paused webhook is never due, so it must not schedule a run either, or the alarm loops.

### Routes (`routes.ts`)

| Route                                  | Body / answer                                               | Refusals                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /items/:id/webhooks`              | `{webhooks}`: the item's, oldest first                      | `403 webhooks_need_editor`; `404 not_found`                                                                                           |
| `POST /items/:id/webhooks`             | `{name, kind, url, events, who?}` → 201 `{webhook, secret}` | `400 invalid_webhook`, `webhook_url_invalid`, `webhook_url_private`; `403 webhooks_need_editor`; `404 not_found`; `409 webhook_limit` |
| `PATCH /webhooks/:id`                  | `{name?, events?, who?, paused?}` → `{webhook}`             | `400 invalid_webhook`                                                                                                                 |
| `DELETE /webhooks/:id`                 | 204 (deliveries cascade)                                    |                                                                                                                                       |
| `POST /webhooks/:id/test`              | 202 `{queued: true}`                                        | `409 webhook_paused`                                                                                                                  |
| `GET /webhooks/:id/deliveries`         | `{deliveries}`, newest 40                                   |                                                                                                                                       |
| `PUT /app/items/:id/card-moves`        | `{moves}` (≤ `CARD_MOVES_MAX` 100) → 204                    | `400 invalid_moves`; `403 wrong_app`                                                                                                  |
| `POST /app/items/:id/automation-sends` | `{sends}` (≤ `AUTOMATION_SENDS_MAX` 5) → 200 `{results}`    | `400 invalid_sends`; `403 wrong_app`                                                                                                  |

Every person route takes the page's share link as the item routes do (`X-Share-Code`, and its password), and checks
on every call (`editableItem`): `403 webhooks_need_account` for a guest, an app's delegate, the Drive mirror or the
export; `503 webhooks_unavailable` without `WEBHOOK_KEY`; `loadItem(…, 'view')` (the access rule of `access.ts`), its
`404` for an item the caller can't reach (`webhook_not_found` on `/webhooks/:id`, so an id tells them nothing) and
its password refusals as they are; then `403 webhooks_need_editor` unless `access.level` is `edit` and
`access.tabId` is null. Names are trimmed (1 to 80); `events` must each be one the item's app sends
(`WEBHOOK_EVENT_APPS`), de-duplicated in `WEBHOOK_EVENTS` order, at least one; `who` is `anyone` (the default) or
`me`. An Editor through a link has it recorded under Shared (`sharedWithUpsert`) in the batch that adds, resumes or
sets Only Me, so `creatorCanEdit` finds it. Pausing gives up what waits; resuming clears `failures` and makes the
caller `created_by`, as setting Only Me does. A team item's add and delete log `webhook_added` and `webhook_removed`
in the same batch (`team-audit.ts`). `mine` is `created_by` = the caller. A card move's text is cut to 200, its `at`
to now + 5 minutes; `card` empty is `Untitled`; `actorId` is kept as sent, cut to 200.

## Errors and edge cases

- An event about an item no webhook hears writes nothing; one older than an hour (a late push) is not queued.
- A webhook whose creator can no longer edit the whole item (left its team, lost the Editor link, the link was
  revoked or narrowed to a tab) pauses at its next delivery, not before.
- A document deleted for good takes its webhooks and their deliveries with it (`ON DELETE CASCADE`).
- An outbox row whose webhook was deleted goes with it (cascade); one whose webhook paused is failed `paused`.
- A Durable Object call that throws is logged and the next request or the cron tries again: nothing is lost, as
  the rows wait in D1.

## Data and persistence

| Table                | Key                                          | Indexes                                                                                                                        |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `webhooks`           | `id`; `item_id` references `items` (cascade) | `webhooks_item_live (item_id) WHERE paused_at IS NULL`; `webhooks_item (item_id, created_at)`; `webhooks_creator (created_by)` |
| `webhook_deliveries` | `id`; `(webhook_id, event_id)`               | `webhook_deliveries_due (next_at) WHERE state = 'pending'`; `webhook_deliveries_webhook (webhook_id, state, id)`               |

`webhooks.events` is comma-wrapped events (`,renamed,card_moved,`); `webhookOf` drops anything not an event. `who`
is `anyone` or `me` (a `CHECK`). `url_sealed` and `secret_sealed` are `v1.<iv>.<ct>`; `host` is the URL's host, in
the clear. `webhook_deliveries` cascades from `webhooks`, and `webhooks` from `items`.
`0014_document_webhooks.sql` dropped both tables and made them again, empty: every account and team webhook before
it is gone, with its deliveries. A closed account (`webhookPurgeStatements`, in the purge's first batch): the webhooks
on its personal items and on the items of the teams closed with it are deleted, its others' pending rows failed
(`paused`), and they paused `creator_left` with `created_by` `deleted`. Then, in the purge's chunked steps
(`webhookDeliveryPurgeStatement`), every delivery of an event they did has `actor_id` `deleted` and `actor_name` null.

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

- An event write: one more statement in its batch, an index probe of `webhooks_item_live` on the event's own item
  that writes nothing when no webhook listens. A form push with responses: the same, in a batch of two in place of
  one write. A request that built one: one indexed read after answering, and one Durable Object call only when
  something is due.
- An automation push: the item read every app push makes, one batch of two indexed reads, and one insert when a
  send queues; measured at about 1.4 ms of CPU for a push of five in the test harness (`automation-sends.test.ts`
  "cost", budget 50 ms a push).
- Every webhook route: one item read and the access rule's reads (as any item route), then one or two indexed reads
  or one batch.
- A run: at most 50 sends, 6 at a time, each at most 10 s; one D1 read, one batch per webhook, one read for the next run.
- A webhook holds at most 500 pending and 20 finished deliveries; a document at most 10 webhooks. Both caps are checked
  inside the insert: the pending one with each row's place in its JSON list added (`listening`'s `ahead`, `j.key`), as
  the count is read once before a statement writes; the webhook one as `INSERT ... SELECT ... WHERE count < 10`, a
  refused add answering `409 webhook_limit` and its team audit row written only when the webhook exists.

## Presentation and UX

- The ⋯ menu's Webhooks row (`ItemMenu`, every Explorer: the five apps', their editors' panels, liveworkspace.app's)
  sits after History, for an item the person edits while signed in. It opens `WebhooksDialog`, size `2xl`, loaded on
  first open: `HeroDialogHeader` with `webhooksHeroArt` (`@liveworkspace/ui/dialog-hero-art/webhooks`), the title
  "Webhooks for “<name>”" (isolated, the whole of it in a hover title), and the app's mark with "<Kind> · These apply
  to this <kind> only". The header's mark is the art's, so the dialog takes no thumbnail. Its body is
  `DocumentWebhooks`.
- `DocumentWebhooks`: a heading, a line saying what a webhook does for this <kind>, and a chip "Only for this <kind>.
  Your other <kinds> have their own." Then the list (each `WebhookRow`: its destination's tile, name, state, "Added
  by you" or "Added by another editor", the host, the last delivery, Send Test, Pause or Resume, Delete, Sends with
  Edit Events, Recent Deliveries), Add Webhook (hidden at 10, with a line saying so), the empty state, and a
  refusal's words (`webhooks_need_editor` with no Try Again).
- `AddWebhook`, four numbered steps: Where Should It Post? (three destination cards), Connect It (`ConnectPanel`'s
  numbered guide around the address, then Name), What Should It Send? (the document's app's events in groups, in
  its words, as rows in one card, none chosen at first, with "n of m", Select All and Clear; no app header or
  logos), Who Did It? (Anyone, the default, or Only Me). Edit Events opens the same two pickers in the row.

## Observability

| Level  | Line                                                  | Where               |
| ------ | ----------------------------------------------------- | ------------------- |
| `log`  | `[webhooks] dispatched {delivered, failed, retrying}` | `durable-object.ts` |
| `warn` | `[index] webhooks kick failed`                        | `outbox.ts`         |

## Testing

| Test                                                             | Pins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/webhooks/routes.test.ts`           | who may manage a document's (owner, team member, whole-document Editor link sent or held; never a guest, delegate, Drive, Viewer, Participant or one-tab Editor, and a stranger sees 404), events by the item's app, Who Did It, sealing, the checks, the limit per document, pause and resume, delete, test (and a pause racing it), deliveries, the audit rows                                                                                                                                                                                                                                                                                                                                                              |
| `liveworkspace/apps/index/src/webhooks/outbox.test.ts`           | what queues (only the item's own webhooks, not another item's, collab events once, not paused, not stale, the pending cap, Only Me by actor), card moves with and without a mover, form responses, waking after the answer and from the cron, a permanent delete's cascade                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `liveworkspace/apps/index/src/webhooks/dispatch.test.ts`         | the signed POST, Slack, retries and give-ups, each status, timeouts, 410, failing, private and unresolved hosts, unreadable seals, a creator who can no longer edit (left the team, lost the link), accounts down, the batch, the trim, a paused webhook's stray row and the next run's floor, the Durable Object, closing an account                                                                                                                                                                                                                                                                                                                                                                                         |
| `liveworkspace/apps/index/src/webhooks/address.test.ts`          | the URL rules (each blocked range and resolving: `packages/api-kit/src/public-address.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `liveworkspace/apps/index/src/webhooks/automation-sends.test.ts` | an automation send: queued on the named webhook alone (whatever its events and Who Did It; no other webhook, even one hearing every event), its row and detail, nothing in History; the same key again (later or in one push, even once paused) queued with nothing new; the cuts, the card link kept only on the app's origin and `\|` encoded, `at` at most now; every refusal in order (another plan's webhook, an unknown one, paused with each reason's words, the cap counting the push's own); the insert's own pause and cap checks; each `invalid_sends` shape and the 5 cap; `wrong_app` (another app, or a non-plan); never a pickable event; the JSON and escaped Slack deliveries; the CPU budget of a full push |
| `liveworkspace/apps/index/src/webhooks/messages.test.ts`         | each sentence, each body, the cap, the signature; an automation send's Slack (escaped, its card line and link), Teams and JSON bodies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/index-client/src/webhooks.test.ts`                     | the contract (`automation` never an event) and the client's calls, `pushAutomationSends` among them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packages/api-kit/src/sealed.test.ts`                            | sealing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/index-app/src/outbox.test.ts`                          | the `card_moved` kind, its `actorId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `liveplanner/apps/api/src/db/item-history.test.ts`               | a card's status change queues a move, with its mover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/settings-ui/src/webhooks/document-webhooks.test.tsx`   | the dialog's body: the list, adding (none chosen at first, the app's own words, Who Did It), editing events, pause, delete, test, deliveries, the refusals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `packages/explorer/src/explorer/menus.test.tsx`                  | the Webhooks row: an editor signed in only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Constants and configuration

`WEBHOOK_FRESH_MS` 1 h, `DELIVERY_TIMEOUT_MS` 10 s, `RETRY_DELAYS_MS` 1 min, 5 min, 30 min, 2 h, 6 h, 12 h,
`DISPATCH_BATCH` 50, `DISPATCH_CONCURRENCY` 6, `FAILING_PAUSE_AFTER` 20, `ACCESS_RETRY_MS` 1 min, `DISPATCHER_NAME`
`deliveries` (`config.ts`); `KICK_SLACK_MS` 500 ms (`durable-object.ts`); `DELIVERIES_LISTED` 40 (`routes.ts`);
`DETAIL_TEXT_MAX` 500, `CHAT_TEXT_MAX` 300 (`messages.ts`); `WEBHOOKS_PER_DOCUMENT_MAX` 10, `WEBHOOK_NAME_MAX` 80,
`WEBHOOK_URL_MAX` 2,048, `WEBHOOK_PAYLOAD_MAX_BYTES` 16,384, `WEBHOOK_DELIVERIES_KEPT` 20, `WEBHOOK_PENDING_MAX` 500,
`CARD_MOVES_MAX` 100, `AUTOMATION_SENDS_MAX` 5, `AUTOMATION_TEXT_MAX` 2,000, `AUTOMATION_RULE_MAX` 60
(`packages/index-client`). Secret `WEBHOOK_KEY`; binding `WEBHOOKS` (`WebhookDispatcher`,
migration tag `v1`, `new_sqlite_classes`).

## Defaults ledger

- `IDX15`: an address given as an IP literal is refused, public or not.
- `IDX16`: only port 443 is taken.
- `IDX17`: a redirect gives the delivery up without retrying; other 4xx but 408, 410 and 429 give up too.
- `IDX18`: accounts unreachable holds a team document's webhook deliveries a minute, counting no try.
- `IDX19`: a card move dated more than 5 minutes ahead is dated now + 5 minutes; its texts are cut to 200.
- `IDX20`: a webhook's deliveries list answers at most 40, newest first.
- `IDX21`: retired with the Mentioned event (0014).
- `IDX36`: an event the document's app never sends (a canvas's card moves) is refused.
- `IDX37`: a test delivery's app is `liveworkspace`; the dialog names it Test.
- `IDX40`: an Editor link limited to one tab can't manage the document's webhooks (they would carry the other tabs'
  comments and actions).
- `IDX41`: a card move or form response with no account behind it never reaches an Only Me webhook.
- `IDX48`: an automation send's card link off the app's origin is dropped; the chat links the plan.
- `IDX49`: an automation send's blank message refuses the push; a blank rule name or card title is `Untitled`.
- `IDX50`: an automation send dated ahead is dated now; its key is remembered only while its delivery is kept.
