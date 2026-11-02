# Webhooks

What happens to a person's or a team's items, sent to another tool as it happens: a signed JSON POST to any
HTTPS endpoint, or a message formatted for a Slack or Microsoft Teams channel, with a link back to the item.
Built once in the index, beside the Timeline it hangs off; the apps only emit their events. The engineering detail
is [blueprints/webhooks.md](blueprints/webhooks.md).

## Who adds one

A webhook belongs to a **scope**, the space whose items it reports on, never to an item:

- **A person's own items** (`p:<person>`): any signed-in account adds webhooks for the items it owns.
- **A team's items** (`t:<team>`): only that team's **admins** add, change, pause, resume and delete them, checked
  against the accounts Worker at the time of the request (a token's `teams` claim can be an hour old). Any admin of
  the team manages every one of its webhooks, whoever added it.

Nobody else can: a guest, a share link's visitor (an Editor's link included), an app's server acting for a person
(an API token through an app's API or MCP server), the Google Drive mirror and accounts' workbench service are all
refused (403 `webhooks_need_account`). Since a webhook is tied to a scope and never to an item, a link holder can't
pipe someone else's document out: a link reaches an item, never a scope. The Editor, Participant and Viewer roles of
a shared item are about that item's content and give no say over webhooks.

## What it sends

The events, each a Timeline event the index records in the same batch as the change
([one-explorer-contracts.md "Timeline"](one-explorer-contracts.md#timeline)), plus liveplanner's card moves:

| Event             | When                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `created`         | an item is made (or copied)                                              |
| `renamed`         | an item is renamed                                                       |
| `moved`           | an item moves folder or space                                            |
| `trashed`         | an item goes to the Trash                                                |
| `shared`          | a share link is made                                                     |
| `commented`       | a comment is added to a thread (an element's or a card's)                |
| `action_assigned` | an action or an open card gets a new assignee                            |
| `action_done`     | an action or card is turned done                                         |
| `card_moved`      | a liveplanner card moves from one status (board column) to another       |
| `ping`            | Send Test, from Settings: proves the endpoint and the signature, no item |

A webhook picks any of the first nine (at least one). It hears an event only when the event's item is in its scope
at the time: a person's webhook hears about the items that person owns, a team's about the team's items. That is
what the Timeline shows the scope's people, so a payload never carries more than someone in the scope could already
read there: the item's id, app, name and link, who did it (the name an app reported, or none), when, and the event's
Timeline detail (a comment's opening words, an action's name and assignee's name, a card's title and statuses). An
event about no item (a team's, a token's) is never sent, nor an event older than an hour when it is recorded (a
merge, a migration or a resent push replaying history).

A **card move** is liveplanner's: a card's status changing between two statuses, neither the Trash, recorded by
the plan beside the card's history and pushed to the index with the plan's other pushes
(`PUT /app/items/:id/card-moves`, [one-explorer-contracts.md "What an item pushes"](one-explorer-contracts.md#what-an-item-pushes)).
It is not a Timeline event; the index only hands it to the plan's scope's webhooks.

## Destinations

- **Webhook**: any HTTPS endpoint. Each delivery is a JSON POST (`Content-Type: application/json`) of
  `{id, type, occurredAt, app, item: {id, title, url} | null, actor: {id, name}, detail}`, signed: a per-webhook
  secret (`whsec_…`, shown once when the webhook is added, never again) keys an HMAC-SHA256 over
  `<timestamp>.<body>`, sent as `X-Liveworkspace-Signature: v1=<hex>`, with the Unix time in
  `X-Liveworkspace-Timestamp`, the event in `X-Liveworkspace-Event` and the delivery's id in
  `X-Liveworkspace-Delivery`. A receiver recomputes the HMAC, compares it in constant time and refuses a timestamp
  more than five minutes old, so a captured delivery can't be replayed. The id is the same on every retry of one
  delivery, for de-duplicating.
- **Slack**: an incoming-webhook URL (`https://hooks.slack.com/services/…`), whose channel Slack fixed when it was
  made. Messages arrive as one sentence ("Ada moved “Fix sign-in” from Doing to Done on “Sprint 4”") with an
  **Open in liveplanner** link and the app and event beneath.
- **Microsoft Teams**: a Workflows webhook URL (the "Post to a channel when a webhook request is received" flow,
  on `*.logic.azure.com` or `*.powerplatform.com`), taking an Adaptive Card: the same sentence, the app and event,
  and an **Open in …** button. Office 365 connector webhooks are retired, so they are not offered.

## Delivery

- **Never in the request.** The write that records an event also writes a pending delivery per webhook that
  hears it (the outbox), in the same D1 batch, so no write path can forget one and none waits on a network call.
  After the response, the index wakes one Durable Object (`WebhookDispatcher`), whose alarm sends what is due and
  sleeps until the next retry. No Cloudflare Queues; the 15-minute cron wakes it too, in case a wake was lost.
- **Retries with backoff.** A delivery succeeds on any 2xx within 10 seconds. A network error, a timeout, 408,
  429 or 5xx is tried again after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 12 hours (seven tries in
  about 21 hours), then given up. A redirect is never followed and counts as a failure, as does any other 4xx,
  which is not retried; 410 Gone also pauses the webhook. One webhook's deliveries go in order: while one waits for
  a retry, the later ones wait behind it.
- **Paused** (nothing is sent, and what was waiting is given up): by an admin or the owner; when its creator is no
  longer an admin of its team ("Paused: whoever added it no longer runs the team"); after 20 deliveries in a row
  were given up ("Paused: 20 deliveries in a row failed"); or on 410 ("Paused: the address said it’s gone").
  Resuming clears the failures, and a team admin resuming one becomes its creator.
- **Recent deliveries**: each webhook keeps its last 20 finished deliveries (event, time, tries, the last
  response code or the reason none came), listed in Settings.
- A webhook holds at most 500 pending deliveries; an event past that is not queued for it.

## Security

- **HTTPS only**, on port 443, with no user name or password in the URL, and a host name, never an IP address.
- **No private or internal addresses (SSRF).** `localhost` and names under `.local`, `.localhost`, `.internal`,
  `.lan`, `.home.arpa` and single-label names are refused, and the host is resolved (DNS over HTTPS, A and AAAA)
  when the webhook is added and again before it is sent to: an answer in a private, loopback, link-local, carrier
  NAT, multicast, documentation or reserved range refuses it (400 `webhook_url_private` when adding; a failed
  delivery after). Redirects are never followed, so an endpoint can't bounce a delivery inward.
- **Payloads are capped** at 16 KiB: the detail's text is shortened first, and dropped if that is not enough.
- **Secrets and URLs are encrypted at rest** (AES-GCM under the index's `WEBHOOK_KEY`, a 32-byte key set as a
  secret, the webhook's id bound in as additional data, so a value copied to another row doesn't open). The list
  shows only the URL's host. Without the key the webhooks routes answer 503 `webhooks_unavailable` and nothing is
  sent.
- **Stops when the creator loses access**: before sending, the dispatcher checks that a team webhook's creator is
  still an admin of the team (asking accounts, as a team filter does), and pauses it if not. A closed account's
  own webhooks are deleted with its other things, and its team webhooks paused, their creator anonymised
  ([one-explorer-contracts.md "Closing an account"](one-explorer-contracts.md#closing-an-account)).
- Limits: 10 webhooks per scope, names of at most 80 characters, URLs of at most 2,048.
- A name is kept as the account names are ([accounts.md "Names and other typed text"](../003-accounts/accounts.md#names-and-other-typed-text)):
  without bidi controls, and without spaces or invisible characters at its ends, so it can neither turn the words
  around it backwards nor look blank; one that leaves nothing is refused (400).

## Managing them

In the Settings panel's Account section, **Webhooks**, next to API Tokens
([../010-site/site.md "Settings"](../010-site/site.md#settings)), on liveworkspace.app and on each app's Explorer
(both reach the index with the person's token); each editor's Settings links there. Like API tokens, they are an
account's: a guest is never shown the category, an address naming it asks them to sign in first, and a guest's
editor shows a Webhooks stand-in that says to sign in, as its API Tokens row does
([../010-site/site.md "Settings", Webhooks](../010-site/site.md#settings)). The routes, under
`/api/index`, for a signed-in account:

- `GET /webhooks`: `{webhooks}`, the person's own and those of each team they are an admin of now.
- `POST /webhooks {name, kind, url, events, teamId?}`: 201 `{webhook, secret}` (`secret` for `kind: 'json'` only,
  shown once). `kind` is `json`, `slack` or `teams`; `teamId` absent is the person's own items.
- `PATCH /webhooks/:id {name?, events?, paused?}`: `{webhook}`.
- `DELETE /webhooks/:id`: 204.
- `POST /webhooks/:id/test`: 202: queues a `ping` and wakes the dispatcher.
- `GET /webhooks/:id/deliveries`: `{deliveries}`, newest first, at most 40: the 20 finished it keeps and the newest
  still pending.

A webhook another person can't manage answers 404 `webhook_not_found`, never 403, so its id tells them nothing.
