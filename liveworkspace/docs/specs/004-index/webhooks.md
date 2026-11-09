# Webhooks

What happens to one document, sent to another tool as it happens: a signed JSON POST to any HTTPS endpoint, or a
message formatted for a Slack or Microsoft Teams channel, with a link back to the document. A webhook belongs to a
single document and only ever reports on that document: never on an account's other documents, a folder or a team.
Built once in the index, beside the Timeline it hangs off; the apps only emit their events. The engineering detail
is [blueprints/webhooks.md](blueprints/webhooks.md).

## Who adds one

A webhook belongs to **one document** (an item: its app and id), never to an account, a folder or a team. Anyone
signed in to an account who can **edit the whole document** adds, changes, pauses, resumes, tests, deletes and lists
its webhooks, whoever added them: its owner, any of its team's people (a team's document), and anyone holding a live
**Editor** link to every tab (one they opened while signed in, which the index keeps under Shared, or one sent with
the request). The index decides on every request, with the access rule every other item route uses
([one-explorer-contracts.md "Sharing and access"](one-explorer-contracts.md)): the owner and the team edit
everything, a link edits at its level, and the item's share password applies.

Nobody else can: a guest; a Viewer or Participant (403 `webhooks_need_editor`); an Editor whose link reaches one tab
only (403 `webhooks_need_editor`, since a webhook hears the whole document); someone the document is not shared with
(404, as any item they can't reach); an app's server acting for a person (an API token through an app's API or MCP
server), the Google Drive mirror and accounts' workbench service (403 `webhooks_need_account`).

**What this allows.** An Editor through a share link can send the document's events (its name, who did what, a
comment's opening words, a card's title) to an address of their choosing, without asking the owner. That is the
accepted trade-off of a per-document feature: an Editor can already read and copy everything in the document, so a
webhook shows them nothing new. The owner sees every webhook in the document's Webhooks dialog and can delete it,
and taking the link back stops it (the webhook pauses itself, see Security). A team document's webhooks also go in
the team's audit log ([team-audit-log.md](team-audit-log.md)).

## What it sends

The events are what can happen to an existing document: the Timeline's item events, each recorded by the index in
the same batch as the change ([one-explorer-contracts.md "Timeline"](one-explorer-contracts.md#timeline)), plus
liveplanner's card moves and form responses, which are not on the Timeline:

| Event             | When                                                              | Apps        |
| ----------------- | ----------------------------------------------------------------- | ----------- |
| `renamed`         | the document is renamed                                           | every app   |
| `moved`           | it moves folder or space                                          | every app   |
| `trashed`         | it goes to the Trash                                              | every app   |
| `shared`          | a share link is made                                              | every app   |
| `commented`       | a comment is added to a thread (an element's or a card's)         | every app   |
| `action_assigned` | an action or an open card gets a new assignee                     | every app   |
| `action_done`     | an action or card is turned done                                  | every app   |
| `card_moved`      | a card moves from one status (board column) to another            | liveplanner |
| `form_response`   | a form takes one or more responses                                | liveplanner |
| `ping`            | Send Test, from the dialog: proves the endpoint and the signature | any         |

Every app has documents and pushes its tabs' comment threads and actions; card moves and forms are liveplanner's
alone. A webhook picks any of its document's app's events (at least one); an event that app never sends
(`card_moved` on a livediagram canvas) is refused (400 `invalid_webhook`). Nothing is sent for a document being made
(it has no webhooks yet), and an @-mention is not a webhook event: it is about a person, not the document, and the
Inbox and phone notifications carry it.

**Who Did It.** Each webhook also says whose actions it reports: **Anyone** (the default) or **Only Me**, which sends
only what its creator did (the event's actor is the creator's account). An event with no account behind it never
goes to an Only Me webhook: a form response (from whoever filled the form in), or a card move by a guest. Whoever
resumes a paused webhook, or sets one to Only Me, becomes its creator, so Only Me then means them.

A payload never carries more than an Editor of the document could already read: the document's id, app, name and
link, who did it (the name an app reported, or none), when, and the event's Timeline detail (a comment's opening
words, an action's name and assignee's name, a card's title and statuses). An event older than an hour when it is
recorded (a merge, a migration or a resent push replaying history) is never sent.

A **card move** is a liveplanner card's status changing between two statuses, neither the Trash, recorded by the
plan beside the card's history and pushed to the index with the plan's other pushes, with the mover's id
(`PUT /app/items/:id/card-moves`,
[one-explorer-contracts.md "What an item pushes"](one-explorer-contracts.md#what-an-item-pushes)).

A **form response** is a live form's response count going up, which the plan pushes to the index as each response
lands (`PUT /app/items/:id/forms/:tabId`, the Inbox's form push). The index compares the count with the one it held,
in the batch that stores the new one, and hands the plan's webhooks one event for the rise: the form's heading, how
many new responses and the total, never what anyone answered. A push that doesn't raise the count sends nothing.

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
  made. Messages arrive as one sentence ("Ada moved “Fix sign-in” from Doing to Done on “Sprint 4”", "3 new responses to “Bug Report” on “Triage”") with an
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
  a retry, the later ones wait behind it, those queued during the wait (a test's ping among them) too.
- **Paused** (nothing is sent, and what was waiting is given up): by anyone who can edit the document; when its creator can no
  longer edit it ("Paused: whoever added it can no longer edit this document", see Security); after 20 deliveries in a row
  were given up ("Paused: 20 deliveries in a row failed"); or on 410 ("Paused: the address said it’s gone").
  Resuming clears the failures, and whoever resumes it becomes its creator. A paused webhook's deliveries
  never wake the dispatcher: Send Test queues its `ping` only while the webhook is not paused, in the same statement
  (a pause landing between the check and the write gets `409 webhook_paused`), and the next run is scheduled only
  from deliveries of webhooks that are not paused, never sooner than a second away.
- **Recent deliveries**: each webhook keeps its last 20 finished deliveries (app, event, time, tries, the last
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
- **Stops when the creator loses access**: before sending, the dispatcher checks that the webhook's creator can
  still edit the whole document: they own it, they are one of its team's people (asked of accounts, once a run per
  person), or a live Editor link to every tab, which they opened, reaches it. When not (a link revoked, lowered,
  expired or narrowed to a tab; removed from the team), the webhook pauses; when accounts can't say, the delivery
  waits a minute, counting no try. A closed account's webhooks pause the same way, their creator anonymised
  ([one-explorer-contracts.md "Closing an account"](one-explorer-contracts.md#closing-an-account)); anyone who can
  edit the document may delete one, or resume it and become its creator.
- Limits: 10 webhooks per document, names of at most 80 characters, URLs of at most 2,048.
- A name is kept as the account names are ([accounts.md "Names and other typed text"](../003-accounts/accounts.md#names-and-other-typed-text)):
  without bidi controls, and without spaces or invisible characters at its ends, so it can neither turn the words
  around it backwards nor look blank; one that leaves nothing is refused (400).

## Managing them

From the document's own ⋯ menu wherever it is listed (the Explorer in every app and on liveworkspace.app, and the
Explorer panel inside each editor), and from the open document's own menu in each editor (the Explorer header's ⋯,
beside Share and Export): **Webhooks**, offered to anyone signed in who can edit the whole document (an editor also
leaves it off for a Viewer, a Participant or a one-tab link, which it knows). It opens a
dialog titled "Webhooks for “<document>”" whose first line says that what is set here applies to this document
only. In it: the document's webhooks, each with Send Test, Pause or Resume, Delete, Edit Events and its Recent
Deliveries, and **Add Webhook**: where it posts (Slack, Microsoft Teams, Your Own Service), the address with how to
get it, a name, **What Should It Send?** (the document's app's events in groups, none chosen at first, with Select
All and Clear) and **Who Did It** (Anyone or Only Me). A plain webhook's signing secret shows once. Settings has no
Webhooks category ([../010-site/site.md "Settings"](../010-site/site.md#settings)).

The routes, under `/api/index`, for a signed-in account who can edit the whole document (checked as above on every
request):

- `GET /items/:id/webhooks`: `{webhooks}`, the document's, oldest first.
- `POST /items/:id/webhooks {name, kind, url, events, who?}`: 201 `{webhook, secret}` (`secret` for `kind: 'json'`
  only, shown once). `kind` is `json`, `slack` or `teams`; `who` is `anyone` (the default) or `me`; at most 10 a
  document (409 `webhook_limit`).
- `PATCH /webhooks/:id {name?, events?, who?, paused?}`: `{webhook}`.
- `DELETE /webhooks/:id`: 204.
- `POST /webhooks/:id/test`: 202: queues a `ping` and wakes the dispatcher.
- `GET /webhooks/:id/deliveries`: `{deliveries}`, newest first, at most 40: the 20 finished it keeps and the 20
  newest still pending, so a backlog of retries never hides the finished ones.

A webhook whose document the caller can't reach answers 404 `webhook_not_found`, so its id tells them nothing; one
whose document they can read but not edit answers 403 `webhooks_need_editor`. A document's webhooks go with it when
it is deleted for good (they and their deliveries cascade from the item), and stay, sending nothing new, while it is
in the Trash.

## Earlier webhooks

Webhooks were once an account's or a team's, reporting on every document in it. Those are retired: migration
`0014_document_webhooks.sql` deleted them and their deliveries when webhooks became per document.
