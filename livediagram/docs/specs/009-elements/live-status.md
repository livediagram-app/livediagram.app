# Live service status

Status: **in progress** (Work Tracker 932). Built so far: the binding's data (part 1 of 4): `statusUrl` on a shape,
its validation and role rule, the shared address check, and the pure answer reader; and the room's polling (part 2),
which checks bound URLs and sends `service-status` on a deployment with `LIVE_STATUS_ENABLED`. Not built yet: the
badge (part 3) and the Live Status dialog (part 4). Until part 4 nothing in the editor offers a binding, and until
part 3 nothing shows the states the room sends.

## What

A shape on an architecture diagram can be **bound to a public https status URL**: a service's status page API
(`https://www.githubstatus.com/api/v2/status.json`), a health endpoint (`https://api.example.com/healthz`), or any
https page that answers when the service is up. While the document is open, its room checks each bound URL about once
a minute, and the shape shows a small **live badge**: **Up**, **Degraded**, **Down** or **Unknown**.

The binding is a field on the shape, `statusUrl`. The status itself is never stored in the document: it is live state
the room holds and sends to whoever has the document open, like presence.

## Why

An architecture diagram is a static picture. It can't say whether the service a box stands for is healthy, so
teams keep the diagram in one tab and their dashboards in another, and the diagram drifts from what is running.
Cloudcraft, Hava and Lucidscale draw live infrastructure from cloud accounts; Backstage and Port tie catalogue
entries to their health. A status URL is the smallest binding that works for any service, needs no account
connection and no stored secret, and keeps the diagram the source of the picture.

## Scope

- **Public https URLs only.** No tokens, no signed-in sources: GitHub deploys and pull requests, Cloudflare and
  cloud-account sources need credentials livediagram doesn't hold, and are out of scope until there is a decision to
  hold them. A URL is part of the document, so anyone who can read the document can read it: never put a secret in
  one (the dialog says so).
- **Shapes only**, of any kind but the self-drawing ones that have no room for a badge (`isSelfDrawingShape`: charts,
  progress, rating and the rest keep their own faces). An icon node, a card, a boundary and a plain box all take one.
- **Off by default on forks.** The checks run only on a deployment whose api has `LIVE_STATUS_ENABLED` set to
  `true`, which only livediagram.app's [hosted profile](../016-platform/deployment.md#hosted-profile) sets. Anywhere
  else a bound shape is an ordinary shape: the binding is kept, nothing is fetched, no badge shows and the dialog is
  not offered.

## The binding

- **`statusUrl`** on `ShapeElement`: a string, at most 2,048 characters, that passes the shared public https address
  check (`parsePublicHttpsUrl`, `@liveworkspace/model-core/public-https-url`), the same rules a webhook's URL is held
  to ([Webhooks](../../../../liveworkspace/docs/specs/004-index/webhooks.md#security)):
  - `https:` on port 443 (or none), with no user name or password;
  - a host **name**, never an IPv4 or IPv6 address;
  - never `localhost`, a single-label name, or a name under `.local`, `.localhost`, `.internal`, `.lan`,
    `.home.arpa` or `.intranet`.
- A shape whose `statusUrl` breaks these is an invalid element: the tab save, the room and the API refuse it like
  any other malformed field, naming `statusUrl`. The dialog checks the same rules as you type, so its refusal and the
  server's agree.
- Absent means unbound. Clearing the binding deletes the field; an empty string is never stored.
- Copying the shape, the tab or the document copies the binding. Undo and redo take it like any field.

## Who may bind

| Role            | What it may do                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Bind, change and clear a shape's status URL; sees the badge.                                                                                                                        |
| **Participant** | Sees the badge. Never binds: the participant content rule keeps `statusUrl` as stored on every element, its own mind nodes included, and drops it from anything a Participant adds. |
| **Viewer**      | Sees the badge, read-only, through the editor, a share link or a Present session.                                                                                                   |

The badge is never a control for anyone: it reads, and its tooltip says when the URL was last checked. Only an
Editor's Live Status dialog (element menu) changes the binding.

## Polling: one room, one check per URL per minute

The checks are the document's Durable Object's ([API app](../015-api/api.md) "Live service status"), never a
viewer's browser, so ten people looking at one diagram cost one check, and a URL no browser could read (no CORS
headers) still works.

- **Only while someone has the document open.** The room checks while at least one socket is connected and the
  document holds at least one binding. With nobody connected it fetches nothing and sets no alarm for it: an idle
  document costs nothing, however many bindings it holds.
- **Once per URL per round.** A round collects the distinct `statusUrl`s across every tab of the document, so five
  shapes bound to one URL are one check. A tab linked into two documents is checked by each document's room while
  each is open.
- **About once a minute** (`STATUS_POLL_MS`, 60 s), driven by the room's alarm. A URL is checked only when its last
  check is at least a minute old (or it has none), so extra rounds never check a URL twice in a minute. A round also
  runs within a few seconds (`STATUS_BIND_DELAY_MS`, 3 s) of a save while someone is connected, which checks only a
  URL the room hasn't checked yet, and on the first join after an idle spell, so a badge never waits a whole minute
  to appear.
- **At most 25 URLs a round** (`STATUS_SOURCES_MAX`), in the order the tabs and their elements hold them; any beyond
  show Unknown ("Too many status links in this document"). A round's checks run three at a time
  (`STATUS_CHECKS_AT_ONCE`): a Worker holds six connections open at once and a check holds two while it resolves its
  host, so no check's 5 s deadline runs while it waits in the platform's queue. A round of answering URLs takes well
  under a second; one where every URL hangs takes at most nine timeouts, about 45 s.
- **Each check** is a `GET` through the shared SSRF-safe fetch (`fetchPublicBytes`,
  `@liveworkspace/api-kit/public-fetch`): the host resolved (DNS over HTTPS, A and AAAA) right before the request and
  refused when any answer is private, loopback, link-local, carrier NAT, multicast, documentation or reserved;
  **no redirects followed** (a redirect is Unknown, "This address redirects: use the address it moves to"); a 5 s
  deadline over the whole exchange; at most 64 KiB of body read (`STATUS_BODY_MAX`); a descriptive `User-Agent`
  naming livediagram and no cookies or credentials.
- **What leaves the room is the state, never the body.** The answer is reduced to one of four states and a short
  reason (below); its bytes are dropped. So a check that DNS rebinding turns inward can tell a viewer at most which
  of four states an internal address answered with. That residual is accepted, as webhooks accept theirs: the api
  Worker has no private network binding, Cloudflare refuses a Worker's subrequest to its own addresses, and every
  check re-resolves first. Revisit if the api ever gains a private network (a Workers VPC or Tunnel binding).

- **What the room sends.** The `service-status` system op, `{ statuses: Record<url, ServiceStatus> }`, to a
  session as it says hello and to every session after each round that checked a URL, since each check moves
  `checkedAt` and the badge's stale rule reads it. A URL past the cap is sent as Unknown, reason
  `too_many_sources`. A session that may see no bound URL is sent nothing.
- **What it keeps.** The latest `ServiceStatus` per checked URL under the storage key `service-status`, at most 25
  entries; a URL no shape is bound to any more is dropped at the next round, and the whole key when the last binding
  goes. The states survive a hibernation wake, so a viewer joining a sleeping room sees the last check at once.

## Reading an answer

`classifyStatusAnswer` (`@livediagram/api-schema`, `service-status.ts`) turns one check into a state:

| Answer                                                                                                                               | State        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 2xx, a JSON body with Atlassian Statuspage's `status.indicator`: `none`                                                              | **Up**       |
| ... `minor` or `maintenance`                                                                                                         | **Degraded** |
| ... `major` or `critical`                                                                                                            | **Down**     |
| 2xx, a JSON body whose `status` (or `state`, or `health`) is a word: `ok`, `up`, `pass`, `healthy`, `operational`, `green`, `online` | **Up**       |
| ... `warn`, `warning`, `degraded`, `partial`, `minor`, `maintenance`, `yellow`                                                       | **Degraded** |
| ... `fail`, `down`, `unhealthy`, `major`, `critical`, `outage`, `error`, `red`, `offline`                                            | **Down**     |
| Any other 2xx (another word, another shape, not JSON, or a body past 64 KiB)                                                         | **Up**       |
| Not 2xx, a timeout, a host that doesn't resolve, a refused connection                                                                | **Down**     |
| A redirect, or an address the check refuses (private, internal, not https)                                                           | **Unknown**  |

Words are matched case-insensitively after trimming. The IETF health check draft's `pass` / `warn` / `fail` and
Spring Boot's `UP` / `DOWN` read correctly; so do Statuspage's `/api/v2/status.json` and `/api/v2/summary.json`.

A state carries `checkedAt` (ms) and, for anything but Up, a `reason`: `http_status` (with the status code),
`timeout`, `unreachable`, `unresolved`, `redirect`, `refused`, `too_many_sources`, or `reported` (the body said so).

## The badge

- A small pill at the shape's **top-right corner**, half outside it like an attached badge: a coloured dot and the
  state's word. Up is the status green, Degraded amber, Down red, Unknown a neutral grey, each meeting contrast in
  light and dark themes.
- **Stale is Unknown.** A state older than three rounds (3 minutes) reads Unknown ("Not checked recently"), so a
  room that stopped checking never leaves a green dot behind.
- **Tooltip:** the state, the reason in words ("Answered 503", "No answer in 5 seconds"), when it was checked
  ("Checked 40 seconds ago") and the URL's host.
- Shown to every role, in the editor, on a share link and in Present, **read-only**. It never takes a click: a click
  on it selects the shape as before.
- **Not in exports.** A PNG, SVG or PDF is a still picture of the drawing; a live state frozen into it would mislead.
- Nothing shows while the room hasn't checked a URL yet (first seconds), on a deployment with polling off, in a
  document opened without its room (offline), or to a Community post's readers, who never join the author's room.

## Errors and edge cases

- **A URL that stops resolving or answering** reads Down with its reason, never an error toast; the editor never
  shows the room's checks failing as anything but the badge.
- **A binding on a tab outside a tab-scoped link's scope** is never sent to that link's sessions: each session gets
  the states of URLs bound on the tabs it may see.
- **Polling off** (`LIVE_STATUS_ENABLED` unset): the room runs no rounds and sends no `service-status`; the editor
  hides the dialog; bound shapes open, save, copy and export exactly as unbound ones.
- **An old client** that doesn't know `statusUrl` keeps it, since an element update carries the whole element.

## Cost

- **Idle documents: nothing.** No socket, no round, no alarm.
- **An open document with bindings:** one alarm a minute and three subrequests per distinct URL (the A and AAAA
  lookups, then the check; at most 25 URLs, so 75), each check at most 5 s and 64 KiB. Duration is billed while the
  round waits on its checks, so a room whose 25 URLs all hang costs about 45 s of Durable Object time a minute while
  open, and one whose URLs answer well under a second.
- **An open document without bindings:** a scan of its tabs for `statusUrl` when a socket joins and when an element
  changes, linear in elements, no fetch and no alarm.

## Testing

- The address check: every refusal the webhooks guard makes, shared tests in `model-core`.
- The answer reader: every row of the table above, malformed JSON, huge and empty bodies, and a CPU-time budget on a
  64 KiB body.
- The participant rule's leak test holds `statusUrl` to Editors.
- The room (part 2): one fetch per distinct URL per round across viewers and tabs, no round with no sockets, none
  with polling off, the per-round cap, scope filtering, and a stale state turning Unknown.
