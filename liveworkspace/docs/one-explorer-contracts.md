# One Explorer: contracts

Status: agreed shape, October 2026. The plan is [one-explorer.md](one-explorer.md); this is what the
code builds against. Types live in `@liveworkspace/index-client` (`packages/index-client`), which every
side imports, so a change here is a change there.

## Names

| Term   | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| item   | One Canvas, Plan, Document or Design. Its id is a UUID the index gives it when it is made.   |
| app    | `livediagram`, `liveplanner`, `livedocuments` or `livedesign`.                               |
| kind   | `canvas`, `plan`, `document` or `design`: one per app, the word people see.                  |
| person | Who is asking: an account (`user_…`) or a guest (`guest_…`). The same id in every app.       |
| index  | The service at `liveworkspace.app/api/index` and its database. The only record of everything |
|        | about an item except its content.                                                            |
| grant  | A short-lived token, signed by the index, saying a person (or a link visitor) may open an    |
|        | item at a level.                                                                             |
| level  | `view` < `participate` < `edit`, as the apps use today.                                      |

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
  its lists are filtered to the app, `POST /items` makes only the app's kind, any other app's item answers 404,
  and `DELETE /trash` is refused (403 `wrong_app`). A guest id, a link or a malformed person is refused (401).
  `createIndexDelegateClient` in `@liveworkspace/index-client` makes these calls.

Errors are `{ "error": "<code>" }` with a 4xx status. Lists are paged with `limit` (≤ 200) and an opaque
`cursor`; a response carries `nextCursor` when there is more.

## Guests

A guest's id lives on liveworkspace.app, so it is the same in every app.

1. The first time an app needs an identity, it sends the browser to
   `liveworkspace.app/api/auth/guest?client_id=<app's accounts client>&redirect_uri=<registered>&state=<random>`.
2. accounts reads (or sets) its long-lived `lw_guest` cookie, and redirects to
   `<redirect_uri>#guest_token=<jwt>&state=<state>`. The fragment keeps the token out of logs.
3. The app keeps the token (local storage) and sends it as the Bearer token.

Guest token: a JWT signed with accounts' keys, `iss` the accounts issuer, `aud` the client's API
resource, `sub: guest_<uuid>`, `kind: "guest"`, valid for a year. A newer one replaces it silently.

**Becoming an account.** When someone signs in or signs up on liveworkspace.app with an `lw_guest`
cookie, accounts tells the index (`POST /internal/merge`, accounts' own key), which moves the guest's
items, folders, tags, favourites, opens and placement defaults to the account in one batch, and clears the
cookie. A link visitor with no identity needs no redirect: a share code is enough for a grant.

A guest's things stay until the guest deletes them, or becomes an account; nothing expires on its own.

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
  summary: ItemSummary; // pushed by the item, see below
  // For the person asking:
  access: Level; // what they may do
  favourite: boolean;
  tagIds: string[];
  lastOpenedAt: number | null;
  sharedVia: string | null; // the share code, when they reach it only through a link
};
type ItemSummary = {
  elements?: number;
  comments?: number;
  bytes?: number;
  mode?: string;
  empty?: boolean;
  thumbnail?: string /* media key or null */;
  [k: string]: unknown;
}; // ≤ 2 KB
```

| Call                           | Who                 | Does                                                                         |
| ------------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `GET /items`                   | person              | Lists. Filters: `app`, `view` (`all`, `recent`, `favourites`,                |
|                                |                     | `shared`, `trash`, `unsorted`), `folder`, `team`, `tag`, `q`                 |
|                                |                     | (title, tag and folder search). Sorted by `updatedAt`, or by                 |
|                                |                     | `lastOpenedAt` for `recent`. `used=N` (1 to 8, `recent` only, first          |
|                                |                     | page) adds `mostUsed`: up to N items ranked by the days used in the last     |
|                                |                     | 90, each with `useDays`, in the same response (Jump Back In).                |
| `POST /items`                  | person              | `{app, id?, title?, folderId?, teamId?, intent?, source?}` → 201             |
|                                |                     | `{item, grant}`. The index makes the id unless the client names the one it   |
|                                |                     | minted (409 `item_exists` when taken); the item's Durable Object             |
|                                |                     | starts empty the first time it is opened with a grant.                       |
| `GET /items/:id`               | person or link      | `{item}`                                                                     |
| `PATCH /items/:id`             | editor              | `{title?, folderId?, teamId?}` → `{item}`. Moving into or out of a           |
|                                |                     | team needs joined membership.                                                |
| `DELETE /items/:id`            | owner / team        | To the Trash; `?permanent=true` purges (below).                              |
| `POST /items/:id/restore`      | owner / team        | `{item}`                                                                     |
| `POST /items/:id/copy`         | anyone who can view | `{title?}` → 201 `{item}`. The index makes the row, then asks the            |
|                                |                     | app to copy the content (`POST <app>/api/internal/items/:from/copy-to/:to`). |
| `POST /items/:id/open`         | person or link      | Records an open for Recent, and the day as a use day for Most Used           |
|                                |                     | (`use_days`, kept 90 days). Debounced: at most one write a minute            |
|                                |                     | per person and item.                                                         |
| `POST /items/:id/grant`        | person or link      | `→ {grant, level, tabId, expiresAt}`. A link visitor sends                   |
|                                |                     | `X-Share-Code` (and `X-Share-Password` when set).                            |
| `GET /trash` / `DELETE /trash` | person              | List, empty (`?team=`).                                                      |

**Purging.** A permanent delete, the daily sweep of items in the Trash for 30 days, or closing an account
(below) removes the index rows and asks the app to drop the content (`DELETE <app>/api/internal/items/:id`,
app key). Each purged item leaves a tombstone until its app confirms: the index tells the app at once for
the first few, and a cron every 15 minutes works through the rest, up to 300 a run, trying a failed one
again at most once an hour.

## Closing an account

When a liveworkspace account closes, accounts tells the index (`POST /internal/purge-person`
`{personId, teamIds}`, accounts' own key, the one the merge uses), and the index removes everything it
holds for that person:

- **Purged**, as a permanent delete is, with the content dropped by each app: every item they own in
  every app, the Trash included, and with each one its tags, favourites, opens, share links, password,
  Shared with me rows and comment and action rows.
- **Deleted**: their folders, tags (and their tags on anyone's items), favourites, opens (Recent), use
  days (Most Used), Shared with me rows, placement defaults, and the Timeline only they saw (their own
  space's events and their favourites) with when they last looked at it and what they removed from it.
- **Kept by the team**: an item or folder they made in a team stays with that team, its owner anonymised.
  `teamIds` names the teams that closed with the account (one it ran alone); their items and folders in
  those go too, while anyone else's stay theirs.
- **Anonymised**: on other people's items, a comment thread they are in or are mentioned in, an action
  assigned to or by them, and a Timeline event they did (in a team, or an edit of someone else's item),
  keeps its row, naming `deleted` (no account or guest) in their place, with no name.

Grants are not stored (they lapse within 10 minutes), and the link codes of their own items go with the
items. The request is recorded first and done in chunks of 500 rows, so it holds for any number of items:
what one call leaves, the 15-minute cron finishes. It answers `{done, items}`; running it again changes
nothing. The record is kept, and the purge run again, for two hours, so anything written with an access
token issued before the account closed goes too. A guest's things have no account to close; the same
purge serves a guest id when one is asked for.

## Folders, tags, favourites, defaults

Folders are not per app: one tree per person, and one per team, holding items from any app.

- `GET/POST /folders`, `PATCH/DELETE /folders/:id` — `{id, name, parentId, teamId, ownerId, createdAt,
updatedAt}`; 409 `folder_exists`, `cycle`. Deleting moves children (folders and items) up a level.
- `GET /folders/previews?ids=a,b,…&app=` — what folder cards show of their insides: for each of up to 60 folders
  the person reaches, `{folderId, itemCount, items}` with its 4 newest live items (of `app`, when given) and a count
  that stops at 1000. One batch however many folders; folders out of reach are left out.
- `GET/POST /tags`, `PATCH/DELETE /tags/:id`, `PUT/DELETE /tags/:id/items/:itemId` — personal; `{id, name,
colour}`; 409 `tag_name_taken`, `tag_limit`.
- `GET /favourites`, `PUT/DELETE /favourites/:itemId`.
- `GET /placement-defaults`, `PUT/DELETE /placement-defaults/:key` — where New files an item, per key.

## Sharing and access

- `GET/POST/DELETE /items/:id/share`, `PATCH/DELETE /share/:code`, `POST /share/:code/extend`,
  `PUT /items/:id/share-password` — the share links of today, now on the index. `ShareLink = {code, itemId,
level, tabId, expiry, expiresAt, createdAt}`. Managing them needs the owner or a joined team member.
- `GET /share/:code` — public: `{item, level, tabId}`; records the item under Shared for a person who
  opens it; 401 `password_required`, 403 `password_invalid`.
- `GET /shared`, `DELETE /shared/:itemId`.

Who gets what, the rule the grant applies: the owner, and every joined member of the item's team, edit
everything; anyone else needs a live share link (its level, and its tab when it is scoped to one). Team
membership comes from the `teams` claim of the person's access token, so the index keeps no copy of teams.

## Grants

A grant is a JWT, ES256, signed by the index's own key; its public keys are at `GET /jwks`.

```json
{
  "iss": "https://liveworkspace.app/api/index",
  "aud": "liveplanner",
  "sub": "user_… | guest_… | link:<code>",
  "item": "<id>",
  "level": "edit",
  "tab": null,
  "team": null,
  "iat": 0,
  "exp": 0,
  "jti": "…"
}
```

It lasts 10 minutes. The editor fetches it while the item's code loads and asks for a fresh one a minute
before it runs out; the item's Durable Object checks each against the cached keys and drops a socket
whose grant has lapsed without a renewal. Changing a link, a password or a team takes effect within
those 10 minutes; revoking a link also tells the item at once (`POST <app>/api/internal/items/:id/revoke`
`{codes}`), and so does rescoping one to another level or tab (the same call with `reason: "rescoped"`, so the app
reloads the link's visitors into what it now opens rather than send them away).

### Carrying a grant to the app

How an app takes the grant is its own business; liveplanner's is the first, and the others follow it:

- **REST**: the editor sends it as `X-Index-Grant: <grant>` beside its `Authorization` (the person's token,
  which still says who is asking). The api checks it offline with `createGrantVerifier` (`aud` the app),
  that `item` is the plan in the path, and the level the route needs (`view` < `participate` < `edit`, a
  `tab` confining it to one tab). A caller without one, such as an API token from the CLI or an AI tool,
  gets one from the index as a delegated caller (above), cached until a minute before it lapses.
- **WebSocket**: a socket cannot send headers, so the grant rides the upgrade as `?t=<grant>`. A session
  the app opens for a paired tool seals its own limits into the ticket:
  `<grant>~<pairing>~<cap>~<HMAC(INDEX_KEY)>`, so neither can be raised.
- **Renewal**: the room sends `{kind: "grant-renew", expiresAt}` 30 seconds before a socket's grant runs out; the
  editor answers `{kind: "grant", grant}` with a fresh one. A fresh grant saying the same moves the lapse
  on; one with another level or tab closes the socket (4005) so it reconnects as what it now is; none in
  time closes it (4007). Revoking a link closes the sockets that link admitted.

## What an item pushes

Items push only what is derived from their content, from their Durable Object, on idle, at most once a
minute, with retries:

- `PUT /app/items/:id/summary` — `{summary, updatedAt}`.
- `PUT /app/items/:id/collab/:tabId` — the tab's comment threads and actions, replacing that tab's rows:
  `{threads: [{elementId, elementLabel, resolved, commentCount, participantIds, mentionedIds, latestText,
latestAuthorName, firstAt, latestAt}], actions: [{elementId, actionId, elementLabel, name, status,
assigneeId, assignerId, teamId, createdAt, updatedAt}]}`. The comment text itself stays in the
  content, beside what it is about; the index keeps what the Inbox needs.

- `PUT /app/items/:id/events` — `{events: [{type: 'edited', actorId, actorName?, at}]}`, up to 100: who
  wrote to the item and when, for the Timeline and Most Used. Each person's `edited` lands on one event per
  item and UTC day (a later report moves its time on), and counts that day as one of their use days, as an
  open does. liveplanner sends one per person who wrote since its last push, with the time of their latest
  write.

## Timeline

What happened to the items a person reaches as owner or team member, newest first: in their own space,
and in each team they are in (a newcomer sees what happened before they joined). Items shared with them
by link are not on it.

- The index records `created` (with `source` when an AI or import made it, `copiedFrom` for a copy),
  `renamed` (`from`), `moved` (`folderName`, `teamId`), `trashed`, `restored`, `shared` (`level`),
  `unshared` and `favourited` in the same batch as the change. A favourite is on its person's Timeline
  only. An empty item its app tidies away is not news.
- Apps report `edited` (above).
- Each event is stored once, with a row per scope that sees it (`p:<person>` or `t:<team>`, as items
  are scoped), carrying its app and time. An item that changes scope takes its events with it.
- `GET /timeline?app=&limit=&cursor=` — `{events, nextCursor, seenAt}`. `app` unset: every app. `limit`
  30 by default, at most 100. Each event: `{id, app, type, actorId, actorName, itemId, title, detail,
occurredAt, item}`, `title` being the item's name then and `item` the item as it is now. One statement
  a page: an index range of at most `limit + 1` rows per scope (by scope, then app, then time), the
  newest of those joined to their events and items.
- `POST /timeline/seen` — `{seenAt}`: what came before is no longer new.
- `POST /timeline/dismiss {ids}` — 204: Remove from Timeline, for this person only. 1 to
  `TIMELINE_DISMISS_MAX` (100) event ids; an id from nowhere adds nothing. A removed event leaves their
  pages and their count, and goes when the event does. A guest's removals follow them into their account.

The index keeps no names of people. An event shows its person as "You" to them; to anyone else, by the
name an app reported, or as a teammate.

## Inbox

`GET /inbox?app=` — `{threads, actions, timelineNew}` across every app: open actions assigned to or by
me, and unresolved threads on my items, where I commented, or where I am mentioned, limited to items I
can reach. Each row carries `app`, `itemId`, `tabId` and `elementId`, so opening it goes to that app.
`timelineNew` is the sidebar's Timeline count, read in the same batch: events by someone else since my
last look, up to now (never one still to come), not removed, counted to at most `TIMELINE_NEW_CAP + 1`
(100, shown as "99+"); 0 before my first look.

## What goes away in each app, as it moves

Its tables for folders, tags, favourites, opens, Trash state, share links, shared-with, placement
defaults, the collab index, its own Timeline (the index's replaces it), the teams mirror and guest ids,
and the routes over them. Its
content tables move into the item's Durable Object.
