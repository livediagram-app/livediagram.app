# Connections

**This was Webhooks.** A webhook used to hear its document's events by itself; that is gone
([No event subscriptions](#no-event-subscriptions)), and what is left is a **connection**: an address one item's
[Automations](../018-automations/automations.md#connections) send messages through. A signed JSON POST to any HTTPS
endpoint, or a message formatted for a Slack or Microsoft Teams channel, with a link back to the item. A connection
belongs to a single item and only ever sends what that item's rules tell it to. Built once in the index; every app's
rules send through it. The engineering detail is [blueprints/webhooks.md](blueprints/webhooks.md).

In copy it is a **connection**, never a webhook (Send to Webhook, the step that posts to your own service, and
Incoming Webhook, a trigger, are Automations' own words). The index's routes, tables, error codes and identifiers
keep the word `webhook`: nothing stored was renamed.

## Who adds one

A connection belongs to **one item** (its app and id), never to an account, a folder or a team. Anyone
signed in to an account who can **edit the whole item** adds, renames, pauses, resumes, tests, deletes and lists
its connections, whoever added them: its owner, any of its team's people (a team's item), and anyone holding a live
**Editor** link to every tab (one they opened while signed in, which the index keeps under Shared, or one sent with
the request). The index decides on every request, with the access rule every other item route uses
([one-explorer-contracts.md "Sharing and access"](one-explorer-contracts.md)): the owner and the team edit
everything, a link edits at its level, and the item's share password applies.

Nobody else can: a guest; a Viewer or Participant (403 `webhooks_need_editor`); an Editor whose link reaches one tab
only (403 `webhooks_need_editor`, since a rule's message can be about any tab); someone the item is not shared with
(404, as any item they can't reach); an app's server acting for a person (an API token through an app's API or MCP
server), the Google Drive mirror and accounts' workbench service (403 `webhooks_need_account`).

A team item's connections also go in the team's audit log ([team-audit-log.md](team-audit-log.md)), as
`webhook_added` and `webhook_removed` (the stored types keep their names).

## What it sends

Two things, and nothing else:

| Type         | When                                                                        | Apps      |
| ------------ | --------------------------------------------------------------------------- | --------- |
| `automation` | an automation rule's step posts a message through this connection           | every app |
| `ping`       | Send Test, from the Connections list: proves the endpoint and the signature | any       |

### No event subscriptions

A connection hears nothing by itself. "What Should It Send?" and "Who Did It" (Anyone, Only Me) are gone, with every
event a webhook could pick (`renamed`, `moved`, `trashed`, `shared`, `commented`, `action_assigned`, `action_done`,
`card_moved`, `form_response`): a rule says all of it, with conditions and its own words. Production held no webhook
when they went (2026-11-20), so nothing was migrated.

- The index queues no delivery when it records an event, takes a collab push or a form's responses.
- `POST /items/:id/webhooks` and `PATCH /webhooks/:id` ignore `events` and `who` in a body (a client from before);
  they are never refused and never answered back.
- The `webhooks.events` and `webhooks.who` columns stay (no migration): written `[]` and `anyone`, never read.
- `PUT /app/items/:id/card-moves` (a plan's card moves, once sent to its webhooks) answers `204` and does nothing,
  for the item's own app, until liveplanner stops pushing them.

## Automation sends

An [automation rule](../018-automations/automations.md#steps-every-app-has), in any app, posts a message through one
of its item's connections (Send to Webhook, Post to Slack, Post to Microsoft Teams). The rule only names the
connection; the address, secret, retries, pausing and Recent Deliveries are the connection's.

- **Addressed.** An `automation` delivery goes to the one connection the rule names, and no other connection of the
  item hears it.
- **From the item, as it runs.** The item's room sends it while a rule runs (on its alarm, never in a person's
  request): `POST /app/items/:id/automation-sends`, from the item's own app (403 `wrong_app` from any other), with
  the connection's id, the rule's name, the **subject** and the message (up to 2,000 characters, the rule's values
  filled in). The index queues one delivery per send in one batch, and answers each send **queued** or **refused**
  with the reason, so the rule's Audit Trail can say which: the connection is not this item's, it is gone, or it is
  paused (its reason given, "the address said it’s gone"). The words name the item as its app does ("This connection
  isn’t on this plan any more", "… this document", "… this design", "… this Space").
- **The subject** is what the run is about: a card in a plan, a tab elsewhere, or nothing (the item alone). It is
  `{ref?, title, url}`: how the item numbers it (`WI-48`, `#48`; a tab has none), its title and a link that opens it.
  The link is kept only on the app's own origin.
- **`card`, for one release.** Before subjects only liveplanner sent, naming a card as
  `card: {key, ref?, title, url}`. A send with no `subject` field is read from `card` (its reference the card's
  `ref`, else `#<key>`); `subject` wins when both are sent; neither is no subject.
- **Asked first, with Pro on.** The same request with `check: true` only answers: what each send would get now,
  with nothing queued. The item's room asks it before it spends the owner's Automation Runs, so none is spent on
  a send the index would refuse.
- **Never twice.** Each send carries a key made from the run and the step; the same key again (a retried run) queues
  nothing new and answers **queued**.
- **What it says.** A Slack or Teams post is the message as the rule wrote it, then the subject
  (`WI-48 Publish pricing page`; a tab's title alone) as an **Open in <app>** link (the item's app: "Open in
  liveplanner", "Open in livediagram") and "Automation · <rule>" beneath; with no subject, or one whose link was
  dropped, the link opens the item. A plain endpoint's `detail` is `{rule, subject: {ref?, title, url} | null, text}`,
  its `actor` `{id: null, name: 'Automation'}`. A plan's send about a card also carries
  `card: {key, ref?, title, url}` in the detail (the card's number read from the end of the subject's reference), so
  a receiver written before subjects still reads it.
  Slack's markup is escaped in the message as in every other text, so a rule can't ping `<!channel>`, and Teams
  reads it as plain text, never Markdown, so a title can't make a link.
- The connection's 500-pending cap holds: past it a send is refused ("Too many messages waiting for this
  connection").

### Messages count as Automation Runs (Pro)

A connection sends only what a rule tells it to: nothing in an item sends through one by itself. With Pro on
([subscription.md](../019-subscription/subscription.md) "Tiers and limits"), every message a rule sends through a
connection costs one of the **Automation Runs** of the item's owner (the person, or the team for a team's item), in
every app, beside the run's own (owner, 2026-11-22). There is no Webhook Deliveries limit: Free's 500 runs a month
cover the messages too. A guest's item counts nothing (its per-item bounds hold). With Pro off nothing is counted,
asked or shown.

- **Spent by the item's room**, before the push and after `check: true` says the index would take it
  (@liveworkspace/automations/room `sendMessages`). The index spends nothing: a send reaches it already paid for.
- **The month used:** the message is not sent and its step's line says why ("This month's automation runs are
  used"). The run is Skipped, never Failed: it adds nothing to the failures that pause a rule.
- **Send Test** is not counted: it is a person checking an address, bounded by the route's own rate, and the index
  holds no subscription client to spend with.
- **Adding is never refused.** A connection can be added, tested, paused and deleted on any tier.

## Destinations

- **Your Own Service** (`json`): any HTTPS endpoint. Each delivery is a JSON POST (`Content-Type: application/json`) of
  `{id, type, occurredAt, app, item: {id, title, url} | null, actor: {id, name}, detail}`, signed: a per-webhook
  secret (`whsec_…`, shown once when the connection is added, never again) keys an HMAC-SHA256 over
  `<timestamp>.<body>`, sent as `X-Liveworkspace-Signature: v1=<hex>`, with the Unix time in
  `X-Liveworkspace-Timestamp`, the type (`automation` or `ping`) in `X-Liveworkspace-Event` and the delivery's id in
  `X-Liveworkspace-Delivery`. A receiver recomputes the HMAC, compares it in constant time and refuses a timestamp
  more than five minutes old, so a captured delivery can't be replayed. The id is the same on every retry of one
  delivery, for de-duplicating.
- **Slack**: an incoming-webhook URL (`https://hooks.slack.com/services/…`), whose channel Slack fixed when it was
  made. A rule's message arrives as the rule wrote it, with its subject, an **Open in <app>** link and
  "Automation · <rule>" beneath ([Automation sends](#automation-sends)); a test as one sentence ("Test from
  liveworkspace: “Team chat” is set up and working.") with "liveworkspace · Test" beneath. Every text Slack reads as markup, the notification
  text included, has its `&`, `<` and `>` escaped, so a name like `<!channel>` pings no one and can't hide a link.
  Slack refuses a section over 3,000 characters, so the message is cut (at a whole character, never inside an
  escape) to fit with its subject line, and a message full of `&` still posts.
- **Microsoft Teams**: a Workflows webhook URL (the "Post to a channel when a webhook request is received" flow,
  on `*.logic.azure.com` or `*.powerplatform.com`), taking an Adaptive Card: the same message, what sent it,
  and an **Open in …** button. Each text is a plain `TextRun` in a `RichTextBlock`, which Teams never reads as
  Markdown, so a title like `[Reset your password](https://…)` shows as those characters and can't hide a link.
  Office 365 connector webhooks are retired, so they are not offered.

## Delivery

- **Never in the request.** A rule's send, or Send Test, writes a pending delivery for its connection (the
  outbox), so none waits on a network call. After the response, the index wakes one Durable Object (`WebhookDispatcher`), whose alarm sends what is due and
  sleeps until the next retry. No Cloudflare Queues; the 15-minute cron wakes it too, in case a wake was lost.
  Each run reads only the pending deliveries, never the kept history: with 2,000 connections and their 20 recent
  deliveries each, a run used to walk all 40,000 rows to find the few due.
- **Retries with backoff.** A delivery succeeds on any 2xx within 10 seconds. A network error, a timeout, 408,
  429 or 5xx is tried again after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 12 hours (seven tries in
  about 21 hours), then given up. A redirect is never followed and counts as a failure, as does any other 4xx,
  which is not retried; 410 Gone also pauses the connection. One connection's deliveries go in order: while one waits for
  a retry, the later ones wait behind it, those queued during the wait (a test's ping among them) too.
- **Paused** (nothing is sent, and what was waiting is given up): by anyone who can edit the document; when its creator can no
  longer edit it ("Paused: whoever added it can no longer edit this document", see Security); after 20 deliveries in a row
  were given up ("Paused: 20 deliveries in a row failed"); or on 410 ("Paused: the address said it’s gone").
  Resuming clears the failures, and whoever resumes it becomes its creator. A paused connection's deliveries
  never wake the dispatcher: Send Test queues its `ping` only while the connection is not paused, in the same statement
  (a pause landing between the check and the write gets `409 webhook_paused`), and the next run is scheduled only
  from deliveries of connections that are not paused, never sooner than a second away.
- **Recent deliveries**: each connection keeps its last 20 finished deliveries (app, type, time, tries, the last
  response code or the reason none came), listed under it.
- A connection holds at most 500 pending deliveries; a send past that is refused ("Too many messages waiting for
  this connection"), and a push of several stops at the cap, never past it.

### Scale

- **The ceiling, from the code.** One dispatcher sends at most 50 deliveries a run, 6 connections at once (also Workers'
  limit of six requests waiting on headers), each connection's in order; while a run takes a full batch the next runs
  straight after, never sooner than a second. A run's wall time is about ceil(connections in it / 6) times one connection's
  time (its access check, a resolve and a send per delivery, one batch): with endpoints answering in an assumed 300 ms
  (not yet measured here), 50 deliveries to 50 connections take about 9 waves of 0.4 s plus the
  second's floor, about 4.6 s, so **about 10 deliveries a second (about 900,000 a day)**. When every endpoint is slow
  to the 10-second timeout it falls to about 0.5 a second (about 45,000 a day). Subrequests are never the limit: a run
  makes at most about 350 (the due read, per connection an access check, an accounts call, a write batch and a pause, per
  delivery two DNS lookups and the send) against the paid plan's 10,000 an invocation.
- **What to watch after launch.** The dispatcher logs `[connections] dispatched` with its counts every run that did
  something. A run whose counts add up to 50 means more was due than one run sends. **Shard when full runs follow
  each other for more than 5 minutes at peak**, or the daily deliveries pass 100,000 (a tenth of the fast ceiling,
  leaving room for slow endpoints).
- **The shard plan.** Name the dispatcher by connection, `deliveries-<n>` for n = a hash of the connection id mod N (N = 4
  to start), so each connection's deliveries stay in order on one object. `kickWebhooks` wakes each shard with
  something due (the due read grouped by shard), the due read gains `AND shard = ?` (a stored column, indexed with
  `next_at`), and the 15-minute cron wakes every shard. Not built now: no volume is measured yet, the ceiling is about
  ten times the shard trigger, and one object keeps ordering, pausing and retries simple.

## Security

- **HTTPS only**, on port 443, with no user name or password in the URL, and a host name, never an IP address. This shape check (with the internal names below) is shared, `parsePublicHttpsUrl` in
  `@liveworkspace/model-core/public-https-url`, so every product that fetches a URL a person typed holds it to the same
  rules (livediagram's [live service status](../../../../livediagram/docs/specs/009-elements/live-status.md)).
- **No private or internal addresses (SSRF).** `localhost` and names under `.local`, `.localhost`, `.internal`,
  `.lan`, `.home.arpa` and `.intranet`, and single-label names, are refused (the platform's one rule for every fetch of a
  URL someone gave, [architecture.md](../002-architecture/architecture.md#fetching-a-url-someone-gave)), and the host is resolved (DNS over HTTPS, A and AAAA)
  when the connection is added and again right before every delivery is sent: an answer in a private, loopback,
  link-local, carrier NAT, multicast, documentation or reserved range refuses it (400 `webhook_url_private` when
  adding; a failed delivery after, and the rest of that run's deliveries for it too). A host that resolves to nothing
  (a mistyped domain) is 400 `webhook_url_unresolved` when adding ("We couldn't find that address. Check the domain."),
  never the shape refusal `webhook_url_invalid`. Redirects are never followed, so
  an endpoint can't bounce a delivery inward.
- **DNS rebinding: narrowed, and the rest accepted.** A host can answer public to the check and private to the send
  that follows it. Pinning the checked address for the send isn't possible on Workers: `fetch()` takes only URLs,
  never an IP address with the name kept for `Host` and TLS, and `resolveOverride` works only inside our own zone
  ([Workers known issues "Fetch to IP
  addresses"](https://developers.cloudflare.com/workers/platform/known-issues/#fetch-to-ip-addresses), [Request
  `cf.resolveOverride`](https://developers.cloudflare.com/workers/runtime-apis/request/)). TCP sockets (`connect()`)
  could take an address, but would mean speaking HTTP and TLS ourselves. So the gap is narrowed instead: the host is
  resolved again right before each send, never once a run, so the window is the milliseconds between that answer and
  the send's own lookup (both Cloudflare's resolver), not a whole run of up to 50 sends. What is left is accepted,
  because a rebound send can do little harm: the index Worker runs with `global_fetch_strictly_public` and has no
  private network to reach (no Workers VPC or Tunnel binding; its one service binding, the Drive mirror's, answers
  only calls made on the binding itself, never a URL the global `fetch()` is given), Cloudflare refuses a Worker's
  subrequest to its own addresses (error 1024), and the send is blind: a `POST` of our own body, its answer's body
  never read, only its status kept in Recent deliveries. Revisit if the index ever gains a private network binding:
  then sends move behind an egress that refuses private ranges.
- **Payloads are capped** at 16 KiB: the detail's text is shortened first, and dropped if that is not enough.
- **A payload never carries more than an Editor of the item could already read**: the item's id, app, name and
  link, and what the rule wrote. An Editor through a share link can add a connection without asking the owner, and
  write a rule that sends through it; the owner sees every connection in the item's Connections list and can delete
  it, and taking the link back stops it (below).
- **Secrets and URLs are encrypted at rest** (AES-GCM under the index's `WEBHOOK_KEY`, a 32-byte key set as a
  secret, the connection's id bound in as additional data, so a value copied to another row doesn't open). The list
  shows only the URL's host. Without the key the connections routes answer 503 `webhooks_unavailable` and nothing is
  sent.
- **Stops when the creator loses access**: before sending, the dispatcher checks that the connection's creator can
  still edit the whole document: they own it, they are one of its team's people (asked of accounts, once a run per
  person), or a live Editor link to every tab, which they opened, reaches it. When not (a link revoked, lowered,
  expired or narrowed to a tab; removed from the team), the connection pauses; when accounts can't say, the delivery
  waits a minute, counting no try. A closed account's connections pause the same way, their creator anonymised
  ([one-explorer-contracts.md "Closing an account"](one-explorer-contracts.md#closing-an-account)); anyone who can
  edit the document may delete one, or resume it and become its creator.
- Limits: 10 connections per item, names of at most 80 characters, URLs of at most 2,048.
- A name is kept as the account names are ([accounts.md "Names and other typed text"](../003-accounts/accounts.md#names-and-other-typed-text)):
  without bidi controls, and without spaces or invisible characters at its ends, so it can neither turn the words
  around it backwards nor look blank; one that leaves nothing is refused (400).

## Managing them

Inside **Automations**, on its **Connections** tab beside Rules, Templates and Audit Trail
([automations.md "Connections"](../018-automations/automations.md#connections)); a message step's panel picks one by
name and offers **Add a Connection…**. There is no Webhooks row in Tools, no Webhooks item in the Explorer's ⋯ menu
and no Webhooks dialog of its own. (Until Connections is a tab of that screen, liveplanner's Automations
opens the same list in a dialog, "Connections for “<name>”"; nothing else opens it.)

The list is one shared part (`Connections`, `@liveworkspace/settings-ui/connections`): the item's connections, each
with Send Test, Pause or Resume, Delete and its Recent Deliveries, and **Add Connection** pinned at the foot under the
list (owner, 2026-11-17: a tool's main button never scrolls away; when the item has the most connections it may, the
foot says so instead), which opens beside it as a popover (`ResponsivePopover` `placement="side"`, 440px; a drawer
from the bottom on a phone), so the list stays in view. Its form is headed **Add a Connection** alone (no line under
it): where it posts (Slack, Microsoft Teams, Your Own Service), each a full-width row with its mark at the left, the
address with how to get it, and a name. Your own service's signing secret shows once. With none yet, the list says
"No connections yet". A refusal of the address (`webhook_url_invalid`, `webhook_url_private`,
`webhook_url_unresolved`) shows under the address field, marks it invalid and moves the keyboard there; any other
refusal shows above Cancel and Add Connection, which stay in reach at the foot of the form's scroll. Settings has no
Webhooks category ([../010-site/site.md "Settings"](../010-site/site.md#settings)).

The routes, under `/api/index`, for a signed-in account who can edit the whole item (checked as above on every
request):

- `GET /items/:id/webhooks`: `{webhooks}`, the item's, oldest first.
- `POST /items/:id/webhooks {name, kind, url}`: 201 `{webhook, secret}` (`secret` for `kind: 'json'`
  only, shown once). `kind` is `json`, `slack` or `teams`; at most 10 an item (409 `webhook_limit`).
- `PATCH /webhooks/:id {name?, paused?}`: `{webhook}`.
- `DELETE /webhooks/:id`: 204.
- `POST /webhooks/:id/test`: 202: queues a `ping` and wakes the dispatcher.
- `GET /webhooks/:id/deliveries`: `{deliveries}`, newest first, at most 40: the 20 finished it keeps and the 20
  newest still pending, so a backlog of retries never hides the finished ones.

A connection whose item the caller can't reach answers 404 `webhook_not_found`, so its id tells them nothing; one
whose item they can read but not edit answers 403 `webhooks_need_editor`. An item's connections go with it when
it is deleted for good (they and their deliveries cascade from the item), and stay, sending nothing new, while it is
in the Trash (its rules run nothing there).

## Earlier webhooks

Webhooks were once an account's or a team's, reporting on every document in it. Those are retired: migration
`0014_document_webhooks.sql` deleted them and their deliveries when webhooks became per document. Per-document
webhooks then picked events to hear; that went when Automations reached every app
([No event subscriptions](#no-event-subscriptions)), leaving connections.
