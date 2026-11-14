# One Explorer: contracts

Status: agreed shape, October 2026. The plan is [one-explorer.md](one-explorer.md); this is what the
code builds against. Types live in `@liveworkspace/index-client` (`packages/index-client`), which every
side imports, so a change here is a change there.

## Names

| Term   | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| item   | One Canvas, Plan, Document or Design. Its id is a UUID the index gives it when it is made.   |
| app    | `livediagram`, `liveplanner`, `livedocuments`, `livedesign`, or `livehuddle` (below).        |
| kind   | `canvas`, `plan`, `document`, `design` or `space`: one per app, the word people see.         |
| person | Who is asking: an account (`user_…`) or a guest (`guest_…`). The same id in every app.       |
| index  | The service at `liveworkspace.app/api/index` and its database. The only record of everything |
|        | about an item except its content.                                                            |
| grant  | A short-lived token, signed by the index, saying a person (or a link visitor) may open an    |
|        | item at a level.                                                                             |
| level  | `view` < `participate` < `edit`, as every app uses.                                          |

livehuddle (its kind `space`, a person's "Space") was registered before its launch
([Registered before launch](../002-architecture/integrating-an-app.md#registered-before-launch)) and is listed since
it (Work Tracker #189): the contracts and the service take it as an app, and every Explorer lists it (`APP_NAMES` in
`@liveworkspace/sites` holds the listed apps). The `items` table takes `livehuddle` and `space` since its rebuild (`0009_items_livehuddle.sql`, rehearsed on
a copy of the data before it deploys: [blueprints/items.md](blueprints/items.md#rebuilding-items)). Until livehuddle's
launch it has no `INDEX_KEY_LIVEHUDDLE`, so nothing can push one.

## Reaching the index

Each app's router forwards `/api/index/*` on its own origin to `liveworkspace.app/api/index/*`, so the
Explorer calls its own origin: no CORS, and the browser never needs a liveworkspace.app cookie. Locally
the routers forward to `http://localhost:8793`.

Two kinds of caller:

- **A browser**, as a person: `Authorization: Bearer <token>`, where the token is either an account
  access token from liveworkspace accounts (its `aud` any of our apps' API resources) or a guest token
  (below). The index checks either against accounts' published keys, offline.
- **An app's server** (its api Worker or an item's Durable Object): `Authorization: Bearer <app key>` and
  `X-Index-App: <app>`, the same scheme the media and community services use. Its secrets are
  `INDEX_KEY_<APP>` on the index and `INDEX_KEY` on the app.
- **An app's server acting for an account** it has checked itself, when that account's access token is not in
  hand (an API token `lwt_…` from the CLI or an AI tool, which the app resolves with accounts): the app's key
  and `X-Index-App` as above, plus `X-Index-Person: <account id>` and `X-Index-Teams: <team ids,
comma-separated, ≤ 50>`. Every person route then answers as that account, but only for the app's own items:
  its lists are filtered to the app (the Trash among them, so `DELETE /trash` empties the app's items only),
  `POST /items` makes only the app's kind, and any other app's item answers 404. A guest id, a link or a
  malformed person is refused (401). The routes no agent may use answer `403` before the item is read, so the
  refusal says nothing about it: managing webhooks ([webhooks.md](webhooks.md), `webhooks_need_account`) and making
  a connection ([connected-tabs.md](connected-tabs.md)); opening a connection answers `404`.
  `createIndexDelegateClient` in `@liveworkspace/index-client` makes these calls.
- **The Google Drive mirror's service acting for an account** ([drive.md](../005-drive/drive.md) "Contracts > The index"):
  `Authorization: Bearer <INDEX_KEY_DRIVE>`, `X-Index-App: drive` and `X-Index-Person: <account id>`. It answers
  as that account on `/items`, `/trash` and `/folders` only (every other person route, `/shared` and an item's
  `share` routes among them, is 404), for the account's **personal** items in every app: its lists are not
  filtered to one app (an `app` or `apps` filter it sends still applies) but every view is narrowed to the
  personal scope, so nothing shared with them or in a team is listed (`view=shared` is empty, a `team` filter is
  403, `any` is 400); a team's item, or anyone else's, answers 404 to read and write; it cannot move an item into
  a team or make one there (403). Folders are the account's own tree. `X-Index-Teams` and `X-Share-Code` are
  ignored. A guest id is refused 403; a wrong key, a link or a malformed person 401.

Errors are `{ "error": "<code>" }` with a 4xx status, save a request that threw: `503 storage_unavailable` (with
`Retry-After: 5`) when the index's database is down, `500 internal_error` otherwise
([When a request fails](../002-architecture/architecture.md#when-a-request-fails)). Lists are paged with `limit` (≤ 200) and an opaque
`cursor`; a response carries `nextCursor` when there is more.

## Guests

A guest's id lives on liveworkspace.app, so it is the same in every app.

1. The first time an app needs an identity, it sends the browser to
   `liveworkspace.app/api/auth/guest?client_id=<app's accounts client>&redirect_uri=<registered>&state=<random>`,
   in place of the page that asked (`location.replace`): the round trip leaves no history entry, so Back
   from where it comes back to never lands on the page that asked, which would only hand off again or, on `/new`,
   make another document.
2. accounts reads (or sets) its long-lived `lw_guest` cookie, and redirects to
   `<redirect_uri>#guest_token=<jwt>&state=<state>`. The fragment keeps the token out of logs.
   If it fails after checking the client and `redirect_uri`, it still goes back there, with
   `#error=server_error&state=<state>`, so the app carries on without a guest rather than the browser
   stopping on an error page.
3. The app keeps the token (local storage) and sends it as the Bearer token.

A page inside a frame (an embed, a Community post's preview) never hands off: the round trip would take the frame to
the app's `/auth/guest`, which refuses to be framed (`X-Frame-Options: DENY`), and the visitor would see the browser's
"refused to connect" page instead of the item. Without a token it carries on as a link visitor, its share code enough
for a grant (`@liveworkspace/index-client/browser` `createGuestTokens`; owner, 2026-11-10).

Guest token: a JWT signed with accounts' keys, `iss` the accounts issuer, `aud` the client's API
resource, `sub: guest_<uuid>`, `kind: "guest"`, valid for 45 days (a year before 2026-11). A newer one replaces it
silently. The app hands off again on the first page load that needs it once it has fewer than 15 days left
(`GUEST_TOKEN_REFRESH_BEFORE_MS`), and accounts' `lw_guest` cookie names the same guest again.

**Becoming an account.** When someone signs in or signs up on liveworkspace.app with an `lw_guest`
cookie, accounts tells the index (`POST /internal/merge`, accounts' own key), which moves the guest's
items, folders, favourites, opens and placement defaults to the account in one batch, and clears the
cookie. The index then tells each app, `POST /api/internal/people/:guest/merge {into}` (at once, and from its
frequent cron until the app confirms, for up to a week), so the app moves what it keeps for the guest beside
their items, such as their images or its own per-person store (`personMerged` in `@liveworkspace/index-app`). A link visitor with no identity needs no redirect: a share code is enough for a grant.

**A returning guest of the old livediagram.app** ([docs/migration.md](../../../../docs/migration.md) step 6). Their
copied work is under `guest_<old uuid>`, which accounts merges into whoever claims it
([accounts.md](../003-accounts/accounts.md#returning-guests-of-the-old-livediagramapp)), a guest as well as an account. So the
merge has a second form, `{guestId, userId, legacy: true}`: `userId` may then be a guest (`guest_…`) too, and
everything else is the same (items, folders, favourites, opens, use days, the event log, Shared with me, placement
defaults, the Inbox's rows, one batch); an item or folder outside a team lands in `p:<userId>`, the target's own
space, guest or account. Without `legacy: true` a guest target is still refused (400). The apps hear it as
`POST /api/internal/people/:guest/merge {into, legacy: true}`, so an app can tell a legacy merge (whose `into` may
be a guest) from an ordinary one, which keeps its `{into}` shape. The index keeps the flag on each
`person_app_merges` row until the app confirms. An app's door that takes only an account refuses a guest `into`
until it is taught the legacy form; the index retries it like any other refusal, for up to a week.

A guest's things stay until the guest deletes them, becomes an account, or goes 400 days unseen. By then its token
and cookie have lapsed, so no app can be handed the id again, and accounts asks for its purge
([accounts.md](../003-accounts/accounts.md#guests-who-never-come-back) "Guests who never come back"): every item it
owns goes, as a closed account's do ([Closing an account](#closing-an-account)).

## Items

```ts
type Item = {
  id: string;
  app: App;
  kind: Kind;
  title: string;
  ownerId: string; // the person who owns it
  teamId: string | null; // owned by a team when set: every joined member edits
  folderId: string | null;
  source: 'person' | 'ai' | 'import' | 'template' | null;
  intent: string | null; // app-defined creation intent (e.g. "plan:board"), for filters and defaults
  createdAt: number;
  updatedAt: number; // last content or title change
  trashedAt: number | null;
  trashReason: 'deleted' | 'empty' | null;
  archivedAt: number | null; // in its owner's Archived since (below)
  summary: ItemSummary; // pushed by the item, see below
  // For the person asking:
  access: Level; // what they may do
  favourite: boolean;
  lastOpenedAt: number | null;
  hiddenFromRecent: boolean; // the person hid it from Recent
  sharedVia: string | null; // the share code, when they reach it only through a link
};
type ItemSummary = {
  elements?: number;
  comments?: number;
  bytes?: number;
  mode?: string;
  empty?: boolean; // nothing to draw: no tab, or an empty first tab
  hasContent?: boolean; // anything on any tab; false (or never pushed) feeds the empty clean-up
  [k: string]: unknown;
}; // ≤ 2 KB
```

Ids the index keys by (an item's, a folder's, a team's, a person's) are 1 to 128 letters, digits, `-` and `_`:
every one is minted as a UUID, a `user_` or `guest_` id, a Clerk id or a hex hash, and anything else is refused
as malformed. The parts of an item an app names (a tab, the cards' `~cards`, an element, an action) are any 1 to
128 characters, because the apps' documents take any non-empty id there.

| Call                           | Who                 | Does                                                                                   |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------- |
| `GET /items`                   | person              | Lists. Filters: `app`, `view` (`all`, `recent`, `favourites`,                          |
|                                |                     | `shared`, `trash`, `archived`, `unsorted` (no folder: My Work's and a team's           |
|                                |                     | roots; the Explorer has no Unsorted view), `search`: every live item the               |
|                                |                     | person can open, links and their own Archived included), `folder`                      |
|                                |                     | (`deep=1`: its subfolders too), `team` and the lens's (below). Sorted by               |
|                                |                     | `updatedAt`, or by `lastOpenedAt` for `recent`. `used=N` (1 to 8, `recent`             |
|                                |                     | only, first page) adds `mostUsed`: up to N items opened in the last 14 days, ranked by |
|                                |                     | how many times (ties: opened last first), each with `useOpens` (and                    |
|                                |                     | `useDays`), in the same response (Most Used on Home). On any first page,               |
|                                |                     | `mine=N` (1 to 200) adds `mine: {count, more}`, the live items in `app` in             |
|                                |                     | every space the person is in (their own and each team's; each item once)               |
|                                |                     | counted up to N (Home's pill), and `any=1` adds `any`, whether                         |
|                                |                     | they can open anything in `app` (Home's first run): Home's reads in one.               |
|                                |                     | `newest=N` (1 to 8, any first page) adds `newest`: up to N live items in               |
|                                |                     | `app` from the person's own space and each team's (never a link's, the                 |
|                                |                     | Trash or Archived), the most recently made first (`createdAt`, then id),               |
|                                |                     | Home's New. Each scope walks `items_new_app` (`items_new` without `app`)               |
|                                |                     | and stops at N, the scopes going in as one `json_each` parameter.                      |
| `POST /items`                  | person              | `{app, id?, title?, folderId?, teamId?, intent?, source?}` → 201                       |
|                                |                     | `{item, grant}`. The index makes the id unless the client names the one it             |
|                                |                     | minted (409 `item_exists` when taken); the item's Durable Object                       |
|                                |                     | starts empty the first time it is opened with a grant.                                 |
| `GET /items/:id`               | person or link      | `{item, tabId, publicCode}`: the tab a link confines the caller to, and the            |
|                                |                     | public link's code when that is their only way in (previews.md)                        |
| `POST /items/lookup`           | person              | `{ids}` (up to 200) → `{items}`: each item `GET /items/:id` would answer               |
|                                |                     | the person without a share password, in the order asked; the rest left out.            |
|                                |                     | One request for a page of names (the apps' Image Gallery usage).                       |
| `PATCH /items/:id`             | editor              | `{title?, folderId?, teamId?}` → `{item}`. Moving into or out of a                     |
|                                |                     | team needs joined membership.                                                          |
| `DELETE /items/:id`            | owner / team        | To the Trash; `?permanent=true` purges (below).                                        |
| `POST /items/:id/restore`      | owner / team        | `{item}`                                                                               |
| `POST /items/:id/copy`         | anyone who can view | `{title?}` → 201 `{item}`. The index makes the row, then asks the                      |
|                                |                     | app to copy the content (`POST <app>/api/internal/items/:from/copy-to/:to`),           |
|                                |                     | naming the row's title, which the copy opens with.                                     |
| `POST /items/:id/open`         | person or link      | Records an open for Recent, and counts it on the day's row for Most Used               |
|                                |                     | (`use_days.opens`, kept 14 days). Debounced: at most one write a minute                |
|                                |                     | per person and item.                                                                   |
| `POST /items/:id/grant`        | person or link      | `→ {grant, level, tabId, expiresAt}`. A link visitor sends                             |
|                                |                     | `X-Share-Code` (and `X-Share-Password` when set).                                      |
| `POST /items/:id/archive`      | owner               | To its owner's Archived (below) → `{item}`.                                            |
| `GET /trash` / `DELETE /trash` | person              | List, empty (`?team=`; `?app=` empties that app's items only).                         |

**The lens's filters**, on `GET /items` and `GET /shared` (the Explorer's filter field and chips): `q`, words
(at most 16), each in the title or the item's folder's name, taken literally; `apps`, the apps the items open in
(with `app` as well, both must hold); `source` (`ai`: made by an AI tool
through MCP); `since`, changed at or after (epoch ms); `owner`, `me` or `others`; `intent`, the creation intent's
last word (`plan:board:kanban` is `kanban`); `modes`, the mode the item's app last reported in its summary
(`summary.mode`, livediagram's `diagram`, `draw` or `workshop`; an item that never pushed a summary has none and
matches no mode), each value matching `INTENT_WORD`; and `space`, `mine`, `shared` (reached through a link) or
`team:<id>` of a joined team (403 otherwise). A filter's values are a comma list of at most 8, combined with or;
filters combine with and. Anything else is 400 `invalid_query`.

**A create that resumes.** An editor makes a new item in two steps under ids it minted: `POST /items` here, then
the content in its own api with the grant that answered. When the second step fails, the editor's Retry sends the
same ids again, so the index answers 409 `item_exists` for an item that is the caller's own. Every editor makes the
item through `createOrResumeItem` (`@liveworkspace/index-client`): on that one answer it asks for the item's grant
(`POST /items/:id/grant`, through the app's held grants) and, when it is an `edit` grant, hands it back with the
title the create asked for, so the content's create carries on. Any other refusal, a grant below `edit` or no grant
at all, throws the index's error as before. The index itself changes nothing: an id taken by someone else still
never gives its taker a way in.

**Purging.** A permanent delete, the daily sweep of items in the Trash for 30 days, or closing an account
(below) removes the index rows and asks the app to drop the content (`DELETE <app>/api/internal/items/:id`,
app key). Each purged item leaves a tombstone until its app confirms: the index tells the app at once for
the first few, and a cron every 15 minutes works through the rest, up to 300 a run, trying a failed one
again at most once an hour.

**The empty clean-up.** The same daily run first moves to the Trash every live item with nothing in it (its
summary's `hasContent` is false, or it never pushed a summary) that has not changed for 30 days, with
`trashReason: 'empty'` and the run's moment as `trashedAt`, so it waits the full 30 days there. It covers every
app, and a team's item goes to its team's Trash. The check and the move are one statement; an item restored
unchanged is not moved again until it changes. At most 1,000 a run, oldest change first. No event is recorded.

**Archived.** A document its owner has put away: out of every list but its owner's Archived view and Search, and
closed to opening and editing until it is moved out ([blueprints/archive.md](blueprints/archive.md)).

- `POST /items/:id/archive` is the owner's alone: a personal item's owner, or a team item's maker while they are in
  the team (another teammate is `403 not_owner`, a link `403 forbidden`). An item in the Trash is `409 trashed`; one
  already archived answers `{item}` unchanged. Folders are never archived, and Archived holds no folders.
- In one batch the item takes `archivedAt`, leaves its folder and its team (`teamId` null), and moves to its owner's
  archive scope (`a:<owner>`). Its share links and share password are deleted for good, with every Shared with me
  row they made; its favourites, opens (Hide from Recent's too) and use days are deleted for everyone; its Inbox rows
  (threads, the people in them, actions, forms and form reads) are deleted. Its History stays its owner's, its
  `favourited` events are deleted (they were other people's, or the owner's own, and Archived holds no favourites),
  and a `moved` event with `{archived: true}` is recorded (in its team's audit log when it left one). The app is told to end the
  sessions its links admitted (`POST <app>/api/internal/items/:id/revoke`); an owner's or teammate's open session
  ends when its grant is next renewed.
- `view=archived` lists the person's archived items that are not in the Trash, newest change first, with `app` and
  the lens. `view=search` includes them whenever it searches the person's own space (no `team`, `team=personal`, or
  `space` naming `mine`). Every other list leaves them out: their scope is in nobody's, and their favourite, open,
  use-day, link and Inbox rows are gone.
- `POST /items/:id/grant`, `POST /items/:id/open`, `POST /items/:id/copy`, `PUT /favourites/:id`,
  `PUT /recent-hidden/:id`, `POST /items/:id/share` and `PUT /items/:id/share-password` answer `409 archived` to the
  owner (the only person who still reaches it); everyone else gets `404`. `GET /items/:id` answers as before, so the
  owner's preview (`006-media/previews.md`) still draws.
- `PATCH /items/:id` with only `title` renames it in place. Naming `folderId` or `teamId` moves it out: `archivedAt`
  is cleared and it lands in My Work (its root or a folder) or in a team the owner has joined, its scope following.
  It starts fresh there: no favourite, no Recent, no links.
- `DELETE /items/:id` sends it to the Trash as any item, keeping `archivedAt`; the Trash lists and empties the
  person's archive scope with their own, and a restore puts it back in Archived. The empty clean-up passes archived
  items by. A collab push for one is accepted and dropped (`204`), so its Inbox stays empty; a summary push is kept,
  so its preview stays current.

**Where an item stands.** The index tells an item's app each time the item is put away or comes back, so work the
app does on its own clock for the item (liveplanner's time rules, Waits and repeating cards) stops while it is
archived or in the Trash. The index pushes; the app never asks (no call per wake, so a plan with a time rule costs the
index nothing while it runs).

- After the batch that archives the item, moves it out of Archived, sends it to the Trash or restores it, the index
  calls `POST <app>/api/internal/items/:id/standing` with the app's key, off its request's path (`waitUntil`):
  `{archived, trashed, at}`, both flags as the item stands after the change and `at` the moment it was written
  (epoch ms). An item already where the call would put it (archived again, trashed again) is not told twice. The
  empty clean-up tells nobody: an item with nothing in it has nothing to run.
- The app keeps the newest standing it has heard (a call with an older `at` than its stored one changes nothing, so
  two calls that cross land in order). It treats the item as **put away** while either flag is true.
- **Retried once, then fails open.** A call that can't be delivered (the app down, a timeout, a refusal) is tried
  once more about a second later, inside the same `waitUntil` (so a call that is lost twice takes at most about 20 s
  with the 10 s timeout). One retry only, never a loop, so an app that refuses every call is asked twice and no more.
  A call still undelivered is logged (`[index] standing not delivered`) and dropped: an app that has heard nothing
  runs the item as before. A grant says again where the item stands when it is signed (an archived item is never
  granted; a trashed one carries `trashed`), so the app takes a grant signed after its stored `at` as the item's
  standing too: a restore lost twice mends itself the next time anyone opens the item or renews a grant on it.
- Every app's door is `@liveworkspace/index-app` `handleInternalItems` (the `standing` handler); the body's type and
  parser are `@liveworkspace/index-client` `standing.ts`. An app without the handler answers `200 {ok: true}` and does
  nothing: livediagram, livedocuments, livedesign and livehuddle keep no clock of their own for an item today, so only
  liveplanner acts on it ([automations.md](../../../../liveplanner/docs/specs/026-plan/automations.md) "Put away").
  A malformed body is `400`; a handler that throws is `503`, which the index logs as not delivered.

## Closing an account

When a liveworkspace account closes, accounts tells the index (`POST /internal/purge-person`
`{personId, teamIds}`, accounts' own key, the one the merge uses), and the index removes everything it
holds for that person:

- **Purged**, as a permanent delete is, with the content dropped by each app: every item they own in
  every app, the Trash included, and with each one its favourites, opens, share links, password,
  Shared with me rows and comment and action rows.
- **Deleted**: their folders, favourites, opens (Recent), use
  days (Most Used), Shared with me rows, placement defaults, and their own `favourited` events (the
  events of their own items went with the items).
- **Kept by the team**: an item or folder they made in a team stays with that team, its owner anonymised.
  `teamIds` names the teams that closed with the account (one it ran alone); their items and folders in
  those go too, while anyone else's stay theirs.
- **Anonymised**: on other people's items, a comment thread they are in or are mentioned in, an action
  assigned to or by them, an event they did (in a team, an edit of someone else's item, a visit through a link), a
  team's event about them (its detail's `personId`), an action given to them in the event log (its detail's
  `assigneeId`), and a webhook delivery of an event they did or of an action given to them, keeps its row, naming
  `deleted` (no account or guest) in their place, with no name (an action's `assignee_name` or `assigner_name` too).
  An event's own id is left as it is: the id has already gone out to webhook receivers, as each delivery's `eventId` and its delivery header, the key they tell repeats apart by.
  So an id made per person never holds the person's id: an edit's (`ed:<item>:<key>:<day>`) and an action given to
  someone's (`aa:…:<key>`) carry a one-way key of them (the first 32 hex characters of SHA-256 of
  `liveworkspace:timeline:v1:<person>`), the same every time, so a person's edits of a day still make one event. Ids
  made before the key came in (`ed:<item>:<person>:<day>`, `aa:…:<person>`) stay as they are; on the day it came in,
  a person editing an item on both sides of the deploy has two `edited` events that day, the old and the new.

- **Told to each app**: their name is also in the content of items that outlive them (their comments,
  cards, assignments and edits), which only the item's app holds, and an app may keep something of theirs
  beside their items (images, a workbench). Before it rewrites its own rows, the index records one notice
  per app, and one per item of someone else's (or of a team that outlives them) that may name them: one they
  commented on, were given or gave an action on, or did something to in the event log, and, since that log keeps
  only 30 days, any they opened or reached by a link (a superset; an item that turns out not to name them changes
  nothing). It then
  sends each app `POST /api/internal/people/:id/purge {items}` with the app's key, at most 100 items a
  call. The app drops what it keeps for the person and takes their name off each item: their id becomes
  `deleted` and the name kept beside it becomes "Deleted account" (`@liveworkspace/index-app`,
  `anonymiseJson`). The notices go when the app confirms. An app that answers anything else is asked
  again an hour later, and given up on after a week.

Their rows in the team audit log ([team-audit-log.md](team-audit-log.md)) are anonymised the same way: where they
acted, the actor is `deleted` with no name; where a team event is about them, its person is `deleted` and their name
leaves its detail. A team that closed with the account loses its log.

The webhooks they added ([webhooks.md](webhooks.md)) are paused, their creator `deleted`, for anyone who can edit
the document to delete or resume; those on their own documents go with the documents when those are deleted.

Their Google Drive mirror's flag (`drive_mirrored`, below) goes too; accounts tells the mirror's service itself.

Grants are not stored (they lapse within 10 minutes), and the link codes of their own items go with the
items. The request is recorded first and done in chunks of 500 rows, so it holds for any number of items:
what one call leaves, the 15-minute cron finishes. It answers `{done, items}`; running it again changes
nothing. The record is kept, and the purge run again, for two hours, so anything written with an access
token issued before the account closed goes too. A guest's things have no account to close; the same
purge serves a guest id when one is asked for.

## Folders, favourites, defaults

Folders are not per app: one tree per person, and one per team, holding items from any app.

- `GET/POST /folders`, `PATCH/DELETE /folders/:id`: `{id, name, parentId, teamId, ownerId, createdAt,
updatedAt}`; 409 `folder_exists`, `cycle`. Deleting moves children (folders and items) up a level.
- `GET /folders/previews?ids=a,b,…&app=`: what folder cards show of their insides: for each of up to 60 folders
  the person reaches, `{folderId, itemCount, items}` with its 4 newest live items (of `app`, when given) and a count
  that stops at 1000. One batch however many folders; folders out of reach are left out.
- `GET /spaces/previews?app=`: what Home's Spaces tiles show of each space the person is in
  ([one-explorer.md "Spaces, on Home"](one-explorer.md#spaces-on-home)): `{spaces: [{teamId, itemCount, items}]}`,
  their own (`teamId: null`) first, then each team their token names (at most 50) in its order, each with its 4
  newest live items (of `app`, when given) and a count that stops at 1000. One batch of two statements whatever the
  number of teams: the scopes go in as one `json_each` parameter (no `UNION`, two bound parameters at most), and each
  space is one walk of `items_live` (`items_live_app` with `app`), its count stopping at the cap. A team made since
  the token was minted is left out until the token is renewed; the Explorer shows it as holding nothing yet. An app
  acting for a person sees its own items only; the Drive mirror and the data export cannot reach it (404).
- `GET /favourites`, `PUT/DELETE /favourites/:itemId`. A `PUT` here or on `/recent-hidden/:itemId` for an item the
  person doesn't reach (not theirs, not their team's, no live link they opened) is 404, the same answer as a missing
  one, and writes nothing.
- `PUT/DELETE /recent-hidden/:itemId`: Hide from Recent and Show in Recent: the person's own; a hidden item
  leaves their `view=recent` and Most Used, and says `hiddenFromRecent: true` everywhere else.
- `GET /placement-defaults`, `PUT/DELETE /placement-defaults/:key`: default folders: where a person's new items
  land when made without a place, per app. The key is the app (`liveplanner`) for every new item of its kind,
  `<app>:kind:<kind>` for one whose first tab is that kind, `<app>:template:<family>` for one made from a template
  family, or `<app>:mode:<mode>` for one that opens in that mode. An intent is `<mode>:<kind>[:<family>]`
  (`draw:diagram`, `plan:board:kanban`), or one word naming a family. `POST /items` with no `folderId` key, no team
  and an `intent` files the item in the first working default of its kind's key, its template's, its mode's, then
  the app's (`placementDefaultKeysFor`); a default in a gone folder or a left team is skipped. The Explorer's
  Default Folders lists the app's entry, the app's modes and kinds (`defaultFolderOptions`), then its template
  families. An explicit
  `folderId: null` is the root chosen on purpose and wins over any default.
- **Mode-only apps** (`MODE_ONLY_PLACEMENT_APPS`, today livediagram): an app that files every new item by the mode
  it opens in alone. Its create tries its mode's key and nothing else (no kind, template or app key, no retired
  keys), and the Explorer lists only the app's mode options (`defaultFolderOptions`), with no app entry and no
  template families, whatever template families the host gives its filters. The intent is still recorded whole.
  livediagram's older app, kind and template keys were carried over and deleted by migration
  `0013_livediagram_mode_defaults.sql`; one written since by an older client is never read.
- **Retired default keys** (`RETIRED_PLACEMENT_KEYS`): a key an app no longer offers an entry for (livehuddle's
  `livehuddle:mode:workshop`, which repeated its app entry, and `livehuddle:template:retrospective`, whose templates
  left) is never dropped. It reads as the app's own key: a create tries it after the app's key, in the list's order,
  and the Explorer shows it as the app's entry while that holds none. Clearing the app's entry clears its retired
  keys too, so the entry says what a create does; setting it leaves them, since the app's key wins.

## Sharing and access

- `GET/POST/DELETE /items/:id/share`, `PATCH/DELETE /share/:code`, `POST /share/:code/extend`,
  `PUT /items/:id/share-password`: the share links, on the index. `ShareLink = {code, itemId,
level, tabId, expiry, expiresAt, createdAt, public}`. Managing them needs the owner or a joined team member.
  A new link's `expiry` is one of `SHARE_LINK_EXPIRIES` (`never`, `week`, `month`, `sixMonths`), `never` when left
  out; any other value is 400 `invalid_expiry`, as a bad `level` is `invalid_level`, never a link that lasts for ever.
  `POST /items/:id/share {public: true}` makes a public link (a Community post's): it never asks for the
  item's share password, and while one is set it opens nothing (404), as if closed.
- The levels a new link may grant are each app's (`APP_LINK_LEVELS`, most capable first) and so is the level a link
  made without one grants (`APP_DEFAULT_LINK_LEVEL`), both in `packages/index-client`: every app offers Editor,
  Participant and Viewer and starts at Editor, except livehuddle, which offers Editor and Participant and starts at
  Participant ([livehuddle Share roles](../../../../livehuddle/docs/specs/013-workspace/share-roles.md#what-a-new-share-offers)).
  `POST /items/:id/share` with a level the item's app does not offer is 400 `level_not_offered`, and so is a
  `PATCH /share/:code` that changes a link to one; a link already holding such a level (made before the app stopped
  offering it) keeps working, opens at its level and can be rescoped to another tab. A public link is always `view`,
  outside the table. The shared Share dialog reads the same table for the item's app: its role picker lists the
  offered levels with the default chosen, and a pass whose level is no longer offered reads "Viewer (Legacy)".
  Each level's card carries a one-line blurb, the same for every app (`LEVEL_PASS` in
  `packages/explorer/src/dialogs/share/parts.tsx`) unless the app words it its own way (`APP_LEVEL_BLURBS`, keyed
  by app and level, read for the item's app): livehuddle's Participant reads "Walks, talks and uses the pieces; adds
  nothing." ([livehuddle Share roles](../../../../livehuddle/docs/specs/013-workspace/share-roles.md#a-participant-walks)).
- `GET /share/:code`: public: `{item, level, tabId, public}` (`public`: a Community post's link); records the item under Shared for a person who
  opens it, except through a public link (no Shared entry, no "joined" notice, no visit in its History); 401
  `password_required`, 403 `password_invalid` (a public link: 404). A password not already found right
  is a guess, limited per visitor's network (10 a minute, before it is checked) and, for a wrong one, per item (30 a
  minute) on every door that takes one (this, `POST /items/:id/grant` and any read with `X-Share-Password`): over
  either, 429 `rate_limited` with `Retry-After` in seconds. Over the visitor's limit that is so even for the right
  one; the item's never turns the right one away, except for a request that names no visitor (an app's server).
- `PUT /items/:id/share-password {password}`: a new password is 6 to 256 characters after trimming
  (`SHARE_PASSWORD_MIN`, `SHARE_PASSWORD_MAX`): shorter is 400 `password_too_short`, longer `invalid_password`; one
  set before the minimum keeps working. Spaces alone, or null, clear it. Setting a new password or changing it holds for
  everyone who came in through a link before: their Shared with me rows go (the item leaves their Shared, Inbox and
  lists), and the app is told to reload every link's sessions (`revoke`, `reason: "rescoped"`, below), so they meet
  the password; entering it records them again. Saving the same password, or removing it, sends no one away.
- `GET /shared` (with the lens's filters), `DELETE /shared/:itemId`.
- A connected tab's pass is a share link like these, made by `POST /items/:id/connections` and handed out only by
  `GET /connections/:id` ([connected-tabs.md](connected-tabs.md)).

Who gets what, the rule the grant applies: the owner of a personal item, and every joined member of a team item's
team, edit everything; anyone else needs a live share link (its level, and its tab when it is scoped to one). A
request that comes in through a public link (a Community post's, its code sent) opens at the link's level for everyone,
the owner and the team's members included: the post's viewer and embed are a viewing surface, so its author never
edits there, and the grant, `GET /share/:code` and every door read `view` (owner, 2026-11-10). Without the code their
own access stands, and an ordinary link of theirs opens as their own. A team
item is the team's: the person who made it (its `ownerId`) reaches it as a member like anyone else, so when they leave
or are removed from the team it stops answering to them as owner, in reads, grants, lists and the Inbox alike, and
the team's remaining members (its admins among them) run it. Team membership comes from the `teams` claim of the
person's access token, and from accounts for a team the claim does not hold yet, so the index keeps no copy of teams.

## Grants

A grant is a JWT, ES256, signed by the index's own key; its public keys are at `GET /jwks`.

```json
{
  "iss": "https://www.liveworkspace.app/api/index",
  "aud": "liveplanner",
  "sub": "user_… | guest_… | link:<code>",
  "item": "<id>",
  "level": "edit",
  "tab": null,
  "team": null,
  "owner": "user_…",
  "trashed": true,
  "link": "<code>",
  "iat": 0,
  "exp": 0,
  "jti": "…"
}
```

`team` and `owner` are the item's team and owner as the index has them when it signs. `trashed` is there only for an
item in the Trash (granted to its owner and team alone; a link reaches nothing), so the app answers it as trashed
rather than missing (livediagram: 410 `document_trashed`); `POST /items/:id/grant` says `trashed: true` beside it.
An app never keeps such a grant in its cache, so a restore is seen on the next request. `link` is the share code the
access came through, on every grant a link gave, a signed-in person's included (one who opened the link before reaches
the item again through Shared with no code sent). An app reads link access from it, never from whether the request
carried `X-Share-Code`: the caller can leave a header off, so a link's limits (a Community post's content-only pass,
the owner-only "Add to <Item>") would fall away with it. The header only adds to a grant signed without the claim. The item's Durable Object
keeps its own copy of both (for its emails, its pushes and its alarm), and takes it from every grant it is handed
(`@liveworkspace/index-app` `createItemHeadSync`), so a guest's merge into an account or a move to another team
reaches the item the next time anyone opens it.

An archived item is never granted: `POST /items/:id/grant` answers its owner `409 archived` (everyone else `404`,
as for any item they don't reach), and the held grants remember it as the refusal (`refusal(id) === 'archived'`).
Every editor reads that refusal where it would show its not-found card and shows the archived card instead: the
item is archived and can't be opened or edited, with **Change Folder** (to
`/explorer/archived?move=<id>`, which opens the Explorer's Change Folder on it) and **Open Explorer**. An app's
API, MCP and CLI that ask a grant for a person or token (`requestGrant`) answer `409 archived` with a sentence
saying it is archived and how to move it out.

It lasts 10 minutes. The editor fetches it while the item's code loads and asks for a fresh one a minute
before it runs out; the item's Durable Object checks each against the cached keys and drops a socket
whose grant has lapsed without a renewal. Changing a link, a password or a team takes effect within
those 10 minutes; revoking a link also tells the item at once (`POST <app>/api/internal/items/:id/revoke`
`{codes}`), and so does rescoping one to another level or tab (the same call with `reason: "rescoped"`, so the app
reloads the link's visitors into what it now opens rather than send them away), and so does setting or changing the
item's password (every link's codes, `reason: "rescoped"`).

### Carrying a grant to the app

How an app takes the grant is its own business; liveplanner's is the first, and the others follow it:

- **REST**: the editor sends it as `X-Index-Grant: <grant>` beside its `Authorization` (the person's token,
  which still says who is asking). The api checks it offline with `createGrantVerifier` (`aud` the app),
  that `item` is the plan in the path, and the level the route needs (`view` < `participate` < `edit`, a
  `tab` confining it to one tab). A caller without one, such as an API token from the CLI or an AI tool,
  gets one from the index as a delegated caller (above), cached until a minute before it lapses.
- **WebSocket**: a socket cannot send headers, so the grant rides the upgrade as `?t=<grant>`. A session
  the app opens for a paired tool gets no grant it could read: its ticket is `rt2~<sealed>`, the grant, the pairing
  and the cap encrypted together (AES-GCM, key derived from INDEX_KEY), so the session can neither raise its limits
  nor take the owner's full-level grant out of the ticket and use it bare (`?t=` or `X-Index-Grant`). A room opens
  the seal with the same key. When the pairing ends (unpaired, its token
  revoked, its account closed), accounts asks the index to close its sockets and the index tells each item
  (`POST <app>/api/internal/items/:id/workbench-close` `{pairingId}`, [workbench.md](../011-workbench/workbench.md)).
- **Renewal**: the room sends `{kind: "grant-renew", expiresAt}` 30 seconds before a socket's grant runs out; the
  editor answers `{kind: "grant", grant}` with a fresh one (a paired tool's session answers with a fresh sealed
  ticket). A fresh grant saying the same moves the lapse on; one with another level, tab or pairing (a paired
  session's renewal must be sealed to its own pairing, and is held to its cap) closes the socket (4005) so it reconnects as what it now is; none in
  time closes it (4007). Revoking a link closes the sockets that link admitted. Only open sockets count: one the
  room has closed can stay listed until its peer answers the close (a laptop asleep never does), and it has nothing
  left to ask or lapse, so it never sets the room's alarm.

### An item's tabs

`GET /api/<items>/:id/tabs` on the app (`@liveworkspace/index-app` `tabs.ts`) answers `{tabs: [{id, name, kind}]}`
in the item's order, gated like a read of the item (a miss is 404, a grant confined to one tab sees that tab
alone), private and never cached. The Share dialog on liveworkspace.app reads it once per open for its tab picker,
from the address the sites registry gives (`itemTabsPath`), rather than the whole item. The app answers it from its
tab rows alone, never a tab's content: liveplanner keeps each tab's kind beside its stats at every write
(`tab_stats.kind`); every livedocuments tab holds pages, so its kind is null. An app that does not serve it yet
is read whole, as before.

## What an item pushes

Items push only what is derived from their content, from their Durable Object, on idle, at most once a
minute, with retries ([When a push fails](#when-a-push-fails)):

- `PUT /app/items/:id/summary`: `{summary, updatedAt}`. An `updatedAt` more than five minutes ahead is taken as
  now, as an event's `at` is: a clock running fast can't pin the item to the top of every list, where a later push
  could never bring it down.
- `PUT /app/items/:id/collab/:tabId`: the tab's comment threads and actions, replacing that tab's rows:
  `{tabName?, threads: [{elementId, elementLabel, resolved, commentCount, participantIds, mentionedIds,
latestText, latestAuthorName, latestAuthorColor?, latestAuthorId?, resolvedById?, agentIds?, card?, firstAt,
latestAt}],
actions: [{elementId, actionId, elementLabel, name, description?, status, assigneeId, assigneeName?, assignerId,
assignerName?, teamId, doneById?, card?, createdAt, updatedAt}]}`. The same push makes the event log's
  collaboration events (below); the optional ids say who wrote, resolved or closed. The comment text itself stays in the content, beside what it is about; the index
  keeps what the Inbox needs: the latest comment's opening, the action's note, and the names on it. Shown text
  is cut to length rather than refused. `participantIds` are the people who wrote in the thread themselves;
  `agentIds` the people whose agent (an API token: the MCP, the CLI, a script) wrote in it while they never did. Both
  reach the thread, but only a comment of one's own is "you commented": a question an agent asked with my token
  still waits on me.
- Cards and their threads go under the tab id `~cards` (`COLLAB_CARDS_TAB`): each card assigned to someone is an
  action whose `elementId` is the card's id, and each of a card's comment threads a thread whose `elementId` is the
  thread's own id (unique across every item) and `elementLabel` its title, both with `card: {id?, key, type,
typeLabel, title, board: {tabId, elementId, title, tabName} | null, column?: {name, color?, done} | null}` (`board`
  is where the row opens it; null when no board shows it; `column` the column on that board holding the card's
  status as of the push: its name, its colour (`#rrggbb`) when it has one, and whether it is a done column; null or
  absent when no column holds it, as on an All Cards board, or when the column is gone; `id` the card's id, given
  when the row's `elementId` is not the card's: a thread's). The item pushes again whenever a card moves, a
  board's columns change or the card goes, so the column is the card's current one, never the one it had when the
  comment was written. A
  thread on several of an item's cards is pushed once, on the first; a thread shared between items (a card thread on
  cards in two plans) is pushed by each, and the Inbox lists it once (below). An app whose cards name people by a hash matches it to a person id before pushing
  (`@liveworkspace/index-app` `cardsCollabPush`); a card whose assignee it cannot name is left out. A card may
  name several people to tell (liveplanner's notifying Person fields): one action a person, under the card's id as
  `actionId` for its Assignee and `{card id}~{field id}` for another field (a person two fields name is told once,
  by the first), so a card that names one person reads as before.
- A part of an element with a thread of its own (a liveplanner Sheet cell, docs/specs/029-sheets/sheet.md "Cell
  comments") is pushed as a thread whose `elementId` is `<elementId>:<part>`, at most 128 characters as any id
  (`INDEX_ID_MAX`, `@liveworkspace/index-client/constants`). The
  row's link carries that key as `el`, for the app to open the part; the reading pane matches it to the listed
  thread whose `elementId` and `cell` make it, and replies with that `cell`.
- `PUT /app/items/:id/forms/:tabId`: `{form: {heading, boardTabId, responses, latestAt, code?} | null}`: a form's
  heading, the tab its responses land on, how many it has taken and when the last came; `null` takes it off the
  Inbox (deleted, or the tab gone). Pushed by the app's server when a response lands, the form is published,
  deleted or renamed. `PUT /app/items/:id/forms/:tabId/seen`: `{personId, seen}`: that person has seen the
  first `seen` responses (a count only grows). Opening the form marks every response so far seen; publishing
  marks them seen for the publisher. `code` is the live link's public code, sent when the link is published
  (before anyone is given it); a push without one keeps the code held, and `null` drops it with the row. A push
  that raises the held count queues a webhook `form_response` for the item's own webhooks ([webhooks.md](webhooks.md)).
- `GET /app/forms/:code`: `{itemId, tabId}`: the item and tab a live form's code names, for the app that pushed
  it (404 otherwise), so the app's Worker routes a public form request to its item without a table of its own
  (`@liveworkspace/index-app` `createFormPlaces` caches the answer a minute). `GET
/app/items/:id/forms/:tabId/seen/:personId`: `{seen}`: how many of the form's responses that person has seen
  (0 when none), for the app's own unseen count.

- `PUT /app/items/:id/events`: `{events: [{type: 'edited', actorId, actorName?, at}]}`, up to 100: who
  wrote to the item and when, for its History, its webhooks and Most Used. Each person's `edited` lands on one event per
  item and UTC day (a later report moves its time on), and counts that day as one of their use days (one open
  when the day has none yet, so an item only edited still reaches Most Used; it never adds to a day's opens). liveplanner sends one per person who wrote since its last push, with the time of their latest
  write.
- `PUT /app/items/:id/card-moves`: `{moves: [{cardId, cardKey, card, from, to, actorId?, actorName?, at}]}`, up to
  100: a plan's cards that changed status (liveplanner), for the plan's own webhooks only (`card_moved`,
  [webhooks.md](webhooks.md)); nothing goes in the event log. Each is one delivery per webhook however often it is
  sent (its id is made from the item, card and time). 204; 400 `invalid_moves`.
- `POST /app/items/:id/automation-sends`:
  `{sends: [{key, webhookId, rule, card: {key, title, url} | null, text, at}]}`, up to 5, from a liveplanner plan's
  room as an automation rule runs: each queues one `automation` delivery on the named webhook of this item
  ([webhooks.md "Automation sends"](webhooks.md#automation-sends)). 200
  `{results: [{key, queued: true} | {key, queued: false, reason, code}]}` in the order sent, `code` one of
  `webhook_not_found`, `webhook_paused`, `webhook_full`; 400 `invalid_sends`; 403 `wrong_app`.
- `DELETE /app/items/:id/connections/:connectionId?tab=<tabId>`: a connected tab has left its host
  ([connected-tabs.md "Removing"](connected-tabs.md#removing)). The host's tab delete writes an outbox key for it
  (`connection_left`, keyed by the connection id and the tab id together) in the delete's own transaction, so a
  removal the index does not take is tried again as any push is. 204 whether or not it matched.

### When a push fails

The item keeps a key per thing it owes in its outbox (`@liveworkspace/index-app` `outbox.ts`), and each key counts
its failed pushes (`attempts`) and when it may go again (`retry_at`). A row stored before they existed reads as 0,
never tried.

- **Done.** A push that succeeds, and a 404 (the index does not hold the item, never made there or purged), deletes
  its keys.
- **Final.** 400, 403, 413 and 422 say the push itself is wrong (malformed, not this app's to write, too large,
  unprocessable): sending it again changes nothing, so its keys are parked at once.
- **Tried again.** Anything else (401, 408, 429, 5xx, a network failure, and a media push that fails) keeps its keys
  and counts the attempt. A key waits a minute after its first failure, doubling each time, at most an hour
  (`retryDelayMs`). An answer with `Retry-After` (seconds, or an HTTP date; the index's client keeps it on the
  `IndexError` as `retryAfterMs`) waits the longer of the two, and never more than an hour (`RETRY_MAX_MS`), so a
  huge header cannot stall a key; one that does not parse is ignored (`failureDelayMs`).
- **Parked.** A key that failed 12 times (`OUTBOX_MAX_ATTEMPTS`, about six hours of trying) is parked too. A parked
  key stays stored and is left out of every drain, with a log line (`[outbox] parked`, its reason, kinds and count).
  The next write to the same thing (a save for the summary, an edit for its tab, a person's next write, an image
  placed, a Community post listed, hidden or taken down) deletes it and writes a fresh key, which starts again at 0.
  Every trigger that keys a change does so by delete-then-insert, never `INSERT OR IGNORE`, so a parked key never
  swallows a change.
- **Retried after a healthy drain.** A drain in which every push succeeded (none failed, at least one key done) says
  the index is healthy again, so the parked keys whose wait is over go back in: each gets one more try (its
  `attempts` set to one short of the limit, its wait cleared) in the next drain, at the usual pace. One that succeeds
  is done; one that fails is parked again at once. A key may go back in at most once every 24 hours
  (`PARKED_RETRY_MS`: parking sets its `retry_at` that far ahead), so a key the index keeps refusing never loops.
  Keys an outage parked (card moves for webhooks, a summary, a tab's Inbox rows) are delivered once the index answers
  again, with no route to call and no write needed. There is no internal route for it.
- **Parked rows are bounded.** A parked row older than 30 days (`PARKED_KEEP_MS`, counted from when it was first
  parked, `parked_at`) is dropped, and an item keeps at most its newest 500 parked rows (`PARKED_KEEP_MAX`), so a
  lasting refusal (a card moving every few minutes under a 4xx) cannot grow the table without end. Both run with the
  drain's settle, in the same batch as the healthy drain's retry.
- **The next-due read** (`outboxDueAt`, run after every write) reads the earliest wait of the keys not parked through
  an index on `(attempts, retry_at)`, so its cost follows the keys owed, never the parked rows beside them.
- **The schema step** (`outboxParkingStep`, each app's room schema): adds `parked_at` (and `attempts` and `retry_at`
  where a room lacks them, as a room whose version ran ahead of its columns can), the `(attempts, retry_at)` index,
  and stamps the rows parked already with the time it runs, so they are dropped 30 days on. It asks SQLite which
  columns exist before each ALTER, so it is safe on a room made before the retry columns, and runs once by the
  room's version row. An app opts its drain in to the retry and the bounds (`tendParkedOutbox`) in the same change as
  the step.
- **The room's alarm** drains on idle and at most once a minute, and never before the earliest key's wait is over;
  a drain sends only the keys whose wait is over, so a key in backoff never holds back a fresh one. With nothing
  owed but parked keys, the alarm is not set for the outbox at all; the next write's drain, if healthy, is what lets
  them back in.
- **The room's one alarm** is the earliest of everything the room has due (the outbox, its shared tabs, grants to ask
  for or lapse, the Community check, upkeep), and never sooner than a second from now, whatever is due
  ([architecture.md](../002-architecture/architecture.md#a-durable-objects-alarm)).

A tab shared between items (each app's `tab-<item>-many-to-many.md`) keeps the same count on `share_outbox`: a
send the other holder fails waits a minute, doubling, at most an hour, and is parked after 12 failures
(`[tab-shares] parked`); the next write to the tab replaces it. The other holder is called only when a key is due,
never every minute.

## The migration's handoff

For a browser's Local only documents from the old livediagram.app ([docs/migration.md](../../../../docs/migration.md)
step 6): livediagram's api splits one and hands each part that belongs to another app to the index, which makes
the item for the person and has that app write it.

- `POST /app/migration/handoff`, with **livediagram's** key (`X-Index-App: livediagram`; any other app's key is
  403 `wrong_app`) and `X-Index-Person: <the caller>`. On this route alone the person may be a guest
  (`guest_<uuid>`) as well as an account, since a Local only document's owner usually is one; `X-Index-Teams` is
  ignored. A missing or malformed person is 401.
- The body is `HandoffRequest` (`@liveworkspace/migration`): `{app, title, payload}`, where `app` is
  `liveplanner`, `livedocuments` or `livedesign`, `title` an item title, and `payload` a `MigrationRoomPayload` for
  that app (`v: 1`, `payload.app === app`, `payload.id` an id). Up to 32 MiB (413 `payload_too_large`); anything
  else is 400. Limited to 60 a minute per person (`MIGRATION_LIMITER`; absent, not limited): 429 `rate_limited`.
- The index makes the item as `POST /items` would: `id` the payload's, the given app's kind, owned by the person,
  no team, no folder (the top of their space, `p:<person>`), `source: 'import'`, created and updated now, with
  its `created` event in the same batch. An id already taken is 409 `item_exists`.
- Then it calls the app's migration door, `PUT ${APP_ORIGIN_<APP>}/api/internal/items/:id/migration`, with that
  app's key, the payload as the body (`ownerId` set to the person and `teamId` to null, whatever was sent), and
  30 seconds to answer. If the app fails, the item row is deleted again (its events go with it) and the
  answer is 502 `migration_failed`. Otherwise `{id, app}` (201).

## The Google Drive mirror

The index's half of [drive.md](../005-drive/drive.md) "Contracts > The index" (`apps/index/src/drive.ts`):

- `PUT /app/people/:id/drive` and `DELETE /app/people/:id/drive` (`204`) set and clear the person's
  `drive_mirrored` flag; `GET` answers `{ mirrored }`. With `INDEX_KEY_DRIVE` only (an app's key is 401, and the
  Drive key opens no other `/app` route); a guest id is 403.
- **The change signal.** After any request that changed a flagged person's personal item or folder, the index
  calls its `DRIVE` service binding after the response (`waitUntil`): `POST https://drive/app/changes`
  `{ personId, at }` with `Authorization: Bearer <DRIVE_KEY_INDEX>`, once per person per request. What counts: an
  item made, renamed, moved (between folders, or into or out of a team, which signals its personal owner),
  trashed, restored, copied or purged (one by one, the Trash emptied, or the daily sweep, which also signals for
  the empty items it trashes), a folder made, renamed, moved or deleted, a guest's work merged into the account,
  and a summary push that raised the item's `updatedAt`. A team's item or folder never signals. The request
  collects the people it touched; one primary-key read of `drive_people` picks out the flagged ones. A failed
  call is logged (`index: drive-signal failed`, with the status) and dropped. Without the binding nothing is
  read or sent.

## Notices

What the index tells an item's app, and answers it, for the app's notification emails
([accounts.md](../003-accounts/accounts.md) "Notification emails"). The index sends no email: it says what happened, once,
after the change is written and off its own request's path (`waitUntil`). A notice that can't be delivered is
logged and dropped; an email is best-effort. Types and helpers are in `@liveworkspace/index-client`
(`notices.ts`); the index side is `apps/index/src/notices.ts`.

- `POST <app>/api/internal/items/:id/notices`, with the app's key, `{type: 'shared', actorId}`: someone made a
  share link on the item (the app's first-share milestone).
- The same, `{type: 'joined', personId, level}`: a person (an account or a guest) came into the item through a
  share link for the first time, whether by resolving the link's code or by opening the item with it. Read in
  the same batch as the `shared_with` write, so a person's first time is told once however the two doors race;
  the owner and someone with no identity are no one joining. The app decides who that emails (liveplanner: the
  owner, for an account visitor only).
- `GET /app/people/:id/count?limit=`, with the app's key: how many items that person has made in the calling
  app, the Trash's included, counted up to `limit` (1 to 1000, default 1000) → `{count}`. One walk of the
  owner index that stops at the limit, so an app asking whether the tenth was just made (`limit=10`) pays the
  same however many the person has. `countOwnedItems` makes the call.
- `POST /app/community/states`, with the app's key, `{posts: [{id, code, owner}]}` (1 to `COMMUNITY_STATES_MAX`,
  100): where each Community post's item stands, for the Community's sweep
  ([community.md](../007-community/community.md#the-sweep)) → `{states: [{id, state}]}`, one per post asked, in
  order. `gone`: no such item, another app's, archived, owned by a closed account (`deleted`), or its link `code` is
  no longer the item's; `away`: in the Trash, or its owner is not `owner` (unless `owner` is a guest: only the
  migration made guests' posts, and the index re-owns a guest's items to the account it becomes); `closed`: in a team or behind a share
  password; else `public`. Two reads (`items` and `share_links` by primary key, each one `json_each` parameter),
  whatever the number asked; nothing is written. The app's `communityStates` makes the call.
- `POST <app>/api/internal/items/community-states`, with the app's `COMMUNITY_KEY` (and no other key): the same
  question, from the Community service, which holds that key but no index key. The app's door
  (`@liveworkspace/index-app` `handleInternalItems`, `communityKey` and the `communityStates` handler) checks the body
  and passes it to the call above; an app without the key or the handler answers `404`.

## The event log

A short-lived record of what happened to items, kept 30 days (`EVENT_RETENTION_MS`). It is not a view of its own: it
feeds each item's History, the item's webhooks ([webhooks.md](webhooks.md)) and its team's audit log
([team-audit-log.md](team-audit-log.md)), and an `edited` report counts towards Most Used. The audit log keeps its own
copy for a year, so the sweep never cuts it short.

- The index records `created` (with `source` when an AI or import made it, `copiedFrom` for a copy),
  `renamed` (`from`), `moved` (`folderName`, `teamId`, and `fromTeamId` when it changed team), `trashed`, `restored`,
  `shared` (`level`), `unshared` and `favourited` in the same batch as the change. An empty item its app tidies away
  is not news. An item created with `synced: true` (kept offline in one browser, put back under its own id) records
  `synced` instead of `created`. An item taken offline for good (`DELETE /items/:id?permanent=true&reason=offline`)
  leaves no event: it is gone, and so is its History. A joined teammate taking a team item offline sends the team's
  copy to the team Trash (`trashed`) instead, since from the team's side it is a deletion.
- From each collab push, in the batch that replaces the tab's rows, the index compares the tab with what it
  held: a thread with more comments is `commented` (`text`, `count`, `reply`, `on`), one turned resolved
  `comment_resolved`, an action or open card with a new assignee `action_assigned` (`action`, `assigneeId`,
  `assigneeName`), one turned done `action_done`. Each id is made from what it says, so a push sent again records
  nothing new, and nothing dated before the item was made (a copy's threads) is news. At most `COLLAB_EVENTS_MAX`
  (100) a push, the newest. A deleted comment's words leave the log with it: a thread with fewer comments than it
  held drops its `commented` events past its count, and a thread that is gone drops its `comment_resolved` too (never
  read from a push at the thread cap).
- `opened_by_visitor` and `copied_by_visitor`: someone who came in through a share link, in the item owner's History
  alone. An open (a grant through a link) is one event per visitor, item and UTC day, its time moving on; a copy
  through a link is one per visitor and item. The actor is the visitor's account or guest id, or null for one with
  no identity (known by the link they came in through). Written off the response path, an open at most once a day
  per isolate.
- Apps report `edited` (above).
- Each event the index records about an item (`renamed`, `moved`, `trashed`, `shared`, `commented`,
  `action_assigned`, `action_done`) is also handed, in the same batch, to that item's own webhooks that listen for
  it ([webhooks.md](webhooks.md)).
- liveworkspace accounts reports its teams' events, `POST /internal/events {events}` with its key (up to 100, each
  `{id, type, actorId, actorName?, title, detail?, at}`): `team_invite_sent`, `team_joined`, `team_declined`,
  `team_role_changed`, `team_member_removed` (`left` when they left) and `team_renamed` (`from`), each naming its team
  in `detail.teamId`. Their app is `liveworkspace` (`PLATFORM_APP`). Accounts writes each to an outbox in the batch
  that makes the change and sends them after the response, resending until the index takes them; the ids make a
  resend change nothing. The index quietly drops the kinds it no longer keeps (`team_deleted`, `token_created`,
  `token_revoked`, `token_expiring`) and ignores `scopes`, so events an older accounts Worker left waiting in its
  outbox are taken, never refused.
- The team-level events among these (a team's own; and on a team's items `shared`, `unshared`, `moved` into, out of
  or between teams with `fromTeamId`, `trashed` and `restored`) are also copied, in the same batch, into the team
  audit log its admins read, kept a year ([team-audit-log.md](team-audit-log.md)). A share link's `shared` carries
  `public` for a Community post's.
- The daily run deletes events older than `EVENT_RETENTION_MS`, oldest first, through the events' time index, in
  bounded chunks (`EVENT_SWEEP_CHUNK`, 500, a statement and at most `EVENT_SWEEP_ROUNDS`, 40, a run: 20,000 events); a backlog past
  that waits for the next day. Deleting an event deletes nothing else: its webhook deliveries and audit rows keep
  their own copy.
- `GET /items/:id/history?limit=&cursor=`: `{events, nextCursor}`, one item's events of the last 30 days, newest
  first. `limit` `HISTORY_PAGE` (30) by default, at most `HISTORY_LIMIT_MAX` (100) (400 `invalid_query`; a bad
  cursor is 400 `invalid_cursor`). Only someone who reaches the item directly (its owner, or a member of its team)
  reads it, the Trash and Archived included; anyone else, a link visitor among them, gets 404 as for an item they
  can't reach. A `favourited` event shows only to the person who starred it, and `opened_by_visitor` and
  `copied_by_visitor` only to the item's owner. Each event: `{id, app, type, actorId, actorName, itemId, title,
detail, occurredAt, item}`, `title` being the item's name then and `item` the item as it is now. One statement: a
  range of the events' item index (`item_id`, then time), at most `limit + 1` rows plus the few the person may not
  see.

The index keeps no names of people. An event shows its person as "You" to them; to anyone else, by the
name an app reported, or as a teammate.

## Inbox

`GET /inbox?app=`: `{threads, actions, forms}` across every app: open actions and cards assigned
to or by me; unresolved threads (an element's or a card's) on my items, where I commented, or where I am
mentioned; and forms with responses I haven't seen on items I own or reach through a team (not through a
link); all limited to items I can reach (through a link scoped to one tab, that tab's threads and actions and the
cards on its boards alone). Each row carries `app`, `itemId`, `itemTitle`, `itemTeamId`, `tabId`
and `tabName`, so opening it goes to that app; a thread says why it is there (`mentionsYou`, `youCommented`,
`onYourItem`). One read is three indexed queries in one batch: about 18 ms with 2,000 of my items among 22,000,
each with a form, a thread and an action (measured when a fourth, the old Timeline count, rode along).

The Explorer shows it as a list and a reading pane (`packages/explorer/src/explorer/InboxPane.tsx`), the same
component on the page and in every editor's panel:

- **Apps without an Inbox.** An app can have none: `APPS_WITHOUT_INBOX` (`packages/explorer/src/inbox-apps.ts`, read
  through `appHasInbox(app)`, like `APPS_WITHOUT_MCP`) holds livehuddle, which removed comments and actions (Work
  Tracker #714). Its Explorer, on its own address and in its editor's panel, shows no Inbox row in the sidebar, no
  section or count on the rail, no Inbox pill on Home, and never fetches `/inbox` (`useInbox` with `enabled` false). A
  remembered Inbox section, or an `/explorer/inbox` address, opens Home instead. The other apps keep the Inbox as
  below. The Inbox rows livehuddle pushed before it stopped (its comment threads, with the people in and mentioned in
  them, and its actions) are cleared once, by a cleanup only a person runs (`liveworkspace/apps/index/scripts/
livehuddle-inbox-cleanup.sql`, Work Tracker 736): it deletes the `collab_threads`, `collab_thread_people` and
  `collab_actions` rows whose `app` is livehuddle and nothing else, emits no event, and changes nothing a second
  time.

- **The list.** Every row newest first, under **Today**, **Earlier This Week** (the six days before) and **Older**.
  A card thread read through two items (shared between plans) is one row: its newest copy.
  Each row is three lines: who is behind it (who assigned it, who it waits on, who wrote last; semibold when it asks
  something of me: mine to do, a mention, a thread on my item, new responses), with its age ("12m", "3h", "2d", then
  the date); what it is (the action, the card's number and title, a card thread's title, the element a thread is
  on, the form's heading), and for a Plan card's row (a card, or one of its threads) the card's status chip after
  the title: its column's name on its colour's dot (a done column's without a colour is green, any other's grey),
  the tooltip naming it ("Status: In Progress"), no chip when the card's column is unknown;
  and why it is here as an icon and words (**To do**, **Waiting on Bo**, **Mentioned you**, **On your plan**,
  **Replied to you** or **You replied**, **Your agent wrote** for a thread only their agent wrote in,
  **6 new responses**), then the app's Living Prism (in the All filter) and
  the item's name, and the teal **This Browser** pill for an item only this browser holds. The chosen row has a
  brand edge on its left. Rows are an ARIA listbox: focus stays on the list while j/k or the arrows move the choice.
- **The filter dropdown**: **All**, **My Actions** (assigned to me, a self-assignment included),
  **Assigned by Me** (waiting on others), **Comments** (mentions, threads on my items, threads I replied in) and
  **Form Responses**, each with its count. The choice is kept per viewer on this device
  (`liveworkspace:explorer-inbox-filter:<viewer id>`), as the Explorer keeps its other view choices, and sits beside
  the header's app filter (this app or All), which still decides which rows are read. It is one compact dropdown
  (`Select`, `@liveworkspace/ui`, a native select named **Inbox filter**) in the pane's header row, on the right
  beside the app filter, in the editor's panel and on the page alike (one style, no chips), each option reading its
  name and count ("My Actions (3)"), so the pane keeps one quiet row of controls; it shows only while the list does.
  Each change is `Activity·Changed` (`All`, `MyActions`, `AssignedByMe`, `Comments`, `FormResponses`).
- **The reading pane**, labelled by its title: where it is (the Living Prism, the team glyph, the item › the tab ›
  the element or board), the title, who and why in a sentence ("Priya mentioned you · 25 mins ago · Task"), the verbs
  with their keys, the item's thumbnail where the host draws one (the host's `renderThumbnail`, the item read from
  the index once the choice has rested 200 ms and kept, at most 64), then the thread, the action's note or the
  form's responses, and a reply field where Reply is offered.
- **The verbs.** Open in the app (↵) is always there, through the host's `itemHref` with an `ItemPlace`: the tab and
  element, `open: 'action' | 'comments'` for the popover, `cardId` for a card, and `threadId` for a card's thread
  (`Activity·Selected`, by row kind).
  The rest come from the host's `InboxHost.actions` (`@liveworkspace/explorer/inbox-actions`), asked per row, so no
  page shows a verb it can't carry out:
  - **Reply** (r) and **Resolve** (e) on a thread, through the owning app's comment routes: an element's thread by
    `POST /api/<items>/:id/tabs/:tabId/comments` and `…/comments/:firstCommentId/resolve` (the thread named by its
    first comment, read from `GET /api/<items>/:id/comments?status=all`, which also gives the pane the whole thread),
    a card thread's by `POST /api/projects/:id/threads/:threadId/comments` and `…/threads/:threadId/resolve`. On liveworkspace.app every
    app's threads (the workspace token's audience is every app's api); on an app's own address and in its editor's
    panel that app's threads only (their token is their own api's). `Activity·Added` (`Reply`) and
    `Activity·Resolved` (`Thread`).
  - **Mark Done** (e) on an action, only in an editor's panel and only for an action on the tab it has open: the
    canvas's own Mark Done (an action's status has no route; it is the people's to change, in the editor).
    `Activity·Resolved` (`Action`).
  - Nothing on a This Browser row (no page here reaches the offline store but the editor, which has no verbs for it
    yet), on another app's row where the token can't write, or on a Plan card (done is its board's column).
    A row whose work is done here leaves the list at once, though the index may list it until the app's next push.
    The pane moves on to the next row (the one below it, or the one above when it was the last), never back to the
    first, so a run of resolves works down the list; with nothing left the list shows its empty state. On a phone
    and in the panel the pane stays open on that next row (Back still returns to the list), and closes only when
    no row is left.
    The Inbox keeps no read state: no Seen, Later or Done of its own (one-explorer.md "Open questions").
- **Keys.** j/k or ↑/↓ move, Home and End jump, ↵ opens the row in its app (where the pane stands beside the list) or
  opens the pane (where it stands in for the list), r replies, e resolves or marks done, Esc returns from the pane.
  The keys show on the buttons, except on a touch screen.
- **Narrow.** Under 768 px, and always in the editor's panel, the list stands alone; choosing a row opens the pane in
  its place (on a phone, full screen) under the shared back bar to **Inbox** (`BackBar`, `@liveworkspace/ui`). The browser's Back (Android's, an iPhone's swipe) and
  Esc return to the list: opening the pane adds one history entry, keeping the page's history state as it was. If the
  open row disappears (done elsewhere, gone from a re-read), the pane closes and steps back off that entry, so the
  next Back leaves the list; opening a row while the pane's entry is still on top replaces it rather than adding
  another. The
  filter stays the header's dropdown (36 px tall; a phone's native picker opens from it); rows and Back are at least 44 px tall; the page keeps its 16 px gutter.

The sidebar's badge counts what waits on me: My Actions, and the threads that ask something of me (a mention, or a
thread on my item I have not written in myself, an agent's question with my token included), 0 included once read.
Work I handed out, threads I replied in and form responses are listed but not counted. Coming back to the browser tab reads it again (at most
every 30 seconds), keeping the list if that read fails. An app may add rows the index never sees (an app's items in
This Browser) through the Explorer's `inbox` prop; they carry the This Browser pill.

## This Browser's list (in the browser, never the index)

Not an index contract: the shape every app's offline store and the Explorer on its address share in localStorage
([one-explorer.md "This Browser, a Space"](one-explorer.md#this-browser-a-space)), `@liveworkspace/explorer/this-browser`.

- **`liveworkspace:this-browser:<app>`**: `{ v: 2, items: ThisBrowserItem[], folders: ThisBrowserFolder[] }`.
  `ThisBrowserItem` is `{ id, title, createdAt, updatedAt, lastOpenedAt, trashedAt, favourite, archivedAt?,
folderId? }`; `ThisBrowserFolder` is `{ id, name, parentId, createdAt, updatedAt }` (`parentId` null at the root).
  Items newest change first, at most 500; folders at most 200. Never content.
- **Version 1** (`{ v: 1, items }`, before folders) reads as version 2 with `folders: []` and every item at the root;
  the next write stores version 2. Any other version, or a garbled value, reads as empty.
- **Writes keep what the app doesn't know.** A write of the items (the app's `publish` and `note`) keeps the folders
  and each item's `folderId` and `archivedAt` the list already held. The key is removed only when there are no items
  and no folders.
- **`liveworkspace:this-browser-sync-place:<app>`**: `{ [itemId]: { folderId, at } }`, where a page's handed-over
  Sync should land in the account (an account folder id), kept at most a day and dropped once used.

## What goes away in each app, as it moves

Its tables for folders, favourites, opens, Trash state, share links, shared-with, placement
defaults, the collab index, its own Timeline (gone: the index's event log feeds History instead), the teams mirror and guest ids,
and the routes over them. Its
content tables move into the item's Durable Object.
