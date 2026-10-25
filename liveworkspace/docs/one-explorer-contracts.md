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
  its lists are filtered to the app (the Trash among them, so `DELETE /trash` empties the app's items only),
  `POST /items` makes only the app's kind, and any other app's item answers 404. A guest id, a link or a
  malformed person is refused (401).
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
items, folders, favourites, opens and placement defaults to the account in one batch, and clears the
cookie. The index then tells each app, `POST /api/internal/people/:guest/merge {into}` (at once, and from its
frequent cron until the app confirms, for up to a week), so the app moves what it keeps for the guest beside
their items, such as their images or its own per-person store (`personMerged` in `@liveworkspace/index-app`). A link visitor with no identity needs no redirect: a share code is enough for a grant.

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

| Call                           | Who                 | Does                                                                          |
| ------------------------------ | ------------------- | ----------------------------------------------------------------------------- |
| `GET /items`                   | person              | Lists. Filters: `app`, `view` (`all`, `recent`, `favourites`,                 |
|                                |                     | `shared`, `trash`, `unsorted` (no folder: My Work's and a team's roots; the   |
|                                |                     | Explorer has no Unsorted view), `search`: every live item the person can      |
|                                |                     | open, links included), `folder` (`deep=1`: its subfolders too), `team`        |
|                                |                     | and the lens's (below). Sorted by `updatedAt`, or by                          |
|                                |                     | `lastOpenedAt` for `recent`. `used=N` (1 to 8, `recent` only, first           |
|                                |                     | page) adds `mostUsed`: up to N items ranked by the days used in the last      |
|                                |                     | 90, each with `useDays`, in the same response (Jump Back In). On any first    |
|                                |                     | page, `mine=N` (1 to 200) adds `mine: {count, more}`, the person's own live   |
|                                |                     | items in `app` counted up to N (Home's pill), and `any=1` adds `any`, whether |
|                                |                     | they can open anything in `app` (Home's first run): Home's reads in one.      |
| `POST /items`                  | person              | `{app, id?, title?, folderId?, teamId?, intent?, source?}` → 201              |
|                                |                     | `{item, grant}`. The index makes the id unless the client names the one it    |
|                                |                     | minted (409 `item_exists` when taken); the item's Durable Object              |
|                                |                     | starts empty the first time it is opened with a grant.                        |
| `GET /items/:id`               | person or link      | `{item, tabId, publicCode}`: the tab a link confines the caller to, and the   |
|                                |                     | public link's code when that is their only way in (previews.md)               |
| `PATCH /items/:id`             | editor              | `{title?, folderId?, teamId?}` → `{item}`. Moving into or out of a            |
|                                |                     | team needs joined membership.                                                 |
| `DELETE /items/:id`            | owner / team        | To the Trash; `?permanent=true` purges (below).                               |
| `POST /items/:id/restore`      | owner / team        | `{item}`                                                                      |
| `POST /items/:id/copy`         | anyone who can view | `{title?}` → 201 `{item}`. The index makes the row, then asks the             |
|                                |                     | app to copy the content (`POST <app>/api/internal/items/:from/copy-to/:to`).  |
| `POST /items/:id/open`         | person or link      | Records an open for Recent, and the day as a use day for Most Used            |
|                                |                     | (`use_days`, kept 90 days). Debounced: at most one write a minute             |
|                                |                     | per person and item.                                                          |
| `POST /items/:id/grant`        | person or link      | `→ {grant, level, tabId, expiresAt}`. A link visitor sends                    |
|                                |                     | `X-Share-Code` (and `X-Share-Password` when set).                             |
| `GET /trash` / `DELETE /trash` | person              | List, empty (`?team=`; `?app=` empties that app's items only).                |

**The lens's filters**, on `GET /items` and `GET /shared` (the Explorer's filter field and chips): `q`, words
(at most 16), each in the title or the item's folder's name, taken literally; `apps`, the apps the items open in
(with `app` as well, both must hold); `source` (`ai`: made by an AI tool
through MCP); `since`, changed at or after (epoch ms); `owner`, `me` or `others`; `intent`, the creation intent's
last word (`plan:board:kanban` is `kanban`); and `space`, `mine`, `shared` (reached through a link) or
`team:<id>` of a joined team (403 otherwise). A filter's values are a comma list of at most 8, combined with or;
filters combine with and. Anything else is 400 `invalid_query`.

**Purging.** A permanent delete, the daily sweep of items in the Trash for 30 days, or closing an account
(below) removes the index rows and asks the app to drop the content (`DELETE <app>/api/internal/items/:id`,
app key). Each purged item leaves a tombstone until its app confirms: the index tells the app at once for
the first few, and a cron every 15 minutes works through the rest, up to 300 a run, trying a failed one
again at most once an hour.

**The empty clean-up.** The same daily run first moves to the Trash every live item with nothing in it (its
summary's `hasContent` is false, or it never pushed a summary) that has not changed for 30 days, with
`trashReason: 'empty'` and the run's moment as `trashedAt`, so it waits the full 30 days there. It covers every
app, and a team's item goes to its team's Trash. The check and the move are one statement; an item restored
unchanged is not moved again until it changes. At most 1,000 a run, oldest change first. No Timeline entry.

## Closing an account

When a liveworkspace account closes, accounts tells the index (`POST /internal/purge-person`
`{personId, teamIds}`, accounts' own key, the one the merge uses), and the index removes everything it
holds for that person:

- **Purged**, as a permanent delete is, with the content dropped by each app: every item they own in
  every app, the Trash included, and with each one its favourites, opens, share links, password,
  Shared with me rows and comment and action rows.
- **Deleted**: their folders, favourites, opens (Recent), use
  days (Most Used), Shared with me rows, placement defaults, and the Timeline only they saw (their own
  space's events and their favourites) with when they last looked at it and what they removed from it.
- **Kept by the team**: an item or folder they made in a team stays with that team, its owner anonymised.
  `teamIds` names the teams that closed with the account (one it ran alone); their items and folders in
  those go too, while anyone else's stay theirs.
- **Anonymised**: on other people's items, a comment thread they are in or are mentioned in, an action
  assigned to or by them, and a Timeline event they did (in a team, or an edit of someone else's item),
  keeps its row, naming `deleted` (no account or guest) in their place, with no name.

- **Told to each app**: their name is also in the content of items that outlive them (their comments,
  cards, assignments and edits), which only the item's app holds, and an app may keep something of theirs
  beside their items (images, a workbench). Before it rewrites its own rows, the index records one notice
  per app, and one per item of someone else's (or of a team that outlives them) that names them. It then
  sends each app `POST /api/internal/people/:id/purge {items}` with the app's key, at most 100 items a
  call. The app drops what it keeps for the person and takes their name off each item: their id becomes
  `deleted` and the name kept beside it becomes "Deleted account" (`@liveworkspace/index-app`,
  `anonymiseJson`). The notices go when the app confirms. An app that answers anything else is asked
  again an hour later, and given up on after a week.

Grants are not stored (they lapse within 10 minutes), and the link codes of their own items go with the
items. The request is recorded first and done in chunks of 500 rows, so it holds for any number of items:
what one call leaves, the 15-minute cron finishes. It answers `{done, items}`; running it again changes
nothing. The record is kept, and the purge run again, for two hours, so anything written with an access
token issued before the account closed goes too. A guest's things have no account to close; the same
purge serves a guest id when one is asked for.

## Folders, favourites, defaults

Folders are not per app: one tree per person, and one per team, holding items from any app.

- `GET/POST /folders`, `PATCH/DELETE /folders/:id` — `{id, name, parentId, teamId, ownerId, createdAt,
updatedAt}`; 409 `folder_exists`, `cycle`. Deleting moves children (folders and items) up a level.
- `GET /folders/previews?ids=a,b,…&app=` — what folder cards show of their insides: for each of up to 60 folders
  the person reaches, `{folderId, itemCount, items}` with its 4 newest live items (of `app`, when given) and a count
  that stops at 1000. One batch however many folders; folders out of reach are left out.
- `GET /favourites`, `PUT/DELETE /favourites/:itemId`.
- `PUT/DELETE /recent-hidden/:itemId` — Hide from Recent and Show in Recent: the person's own; a hidden item
  leaves their `view=recent` and Most Used, and says `hiddenFromRecent: true` everywhere else.
- `GET /placement-defaults`, `PUT/DELETE /placement-defaults/:key` — default folders: where a person's new items
  land when made without a place, per app. The key is the app (`liveplanner`) for every new item of its kind,
  `<app>:kind:<kind>` for one whose first tab is that kind, `<app>:template:<family>` for one made from a template
  family, or `<app>:mode:<mode>` for one that opens in that mode. An intent is `<mode>:<kind>[:<family>]`
  (`draw:diagram`, `plan:board:kanban`), or one word naming a family. `POST /items` with no `folderId` key, no team
  and an `intent` files the item in the first working default of its kind's key, its template's, its mode's, then
  the app's (`placementDefaultKeysFor`); a default in a gone folder or a left team is skipped. The Explorer's
  Default Folders lists the app's entry, the app's modes and kinds (`defaultFolderOptions`), then its template
  families. An explicit
  `folderId: null` is the root chosen on purpose and wins over any default.

## Sharing and access

- `GET/POST/DELETE /items/:id/share`, `PATCH/DELETE /share/:code`, `POST /share/:code/extend`,
  `PUT /items/:id/share-password` — the share links of today, now on the index. `ShareLink = {code, itemId,
level, tabId, expiry, expiresAt, createdAt, public}`. Managing them needs the owner or a joined team member.
  `POST /items/:id/share {public: true}` makes a public link (a Community post's): it never asks for the
  item's share password, and while one is set it opens nothing (404), as if closed.
- `GET /share/:code` — public: `{item, level, tabId, public}` (`public`: a Community post's link); records the item under Shared for a person who
  opens it; 401 `password_required`, 403 `password_invalid` (a public link: 404).
- `GET /shared` (with the lens's filters), `DELETE /shared/:itemId`.

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
  "owner": "user_…",
  "trashed": true,
  "iat": 0,
  "exp": 0,
  "jti": "…"
}
```

`team` and `owner` are the item's team and owner as the index has them when it signs. `trashed` is there only for an
item in the Trash (granted to its owner and team alone; a link reaches nothing), so the app answers it as trashed
rather than missing (livediagram: 410 `document_trashed`); `POST /items/:id/grant` says `trashed: true` beside it.
An app never keeps such a grant in its cache, so a restore is seen on the next request. The item's Durable Object
keeps its own copy of both (for its emails, its pushes and its alarm), and takes it from every grant it is handed
(`@liveworkspace/index-app` `createItemHeadSync`), so a guest's merge into an account or a move to another team
reaches the item the next time anyone opens it.

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
  `<grant>~<pairing>~<cap>~<HMAC(INDEX_KEY)>`, so neither can be raised. When the pairing ends (unpaired, its token
  revoked, its account closed), accounts asks the index to close its sockets and the index tells each item
  (`POST <app>/api/internal/items/:id/workbench-close` `{pairingId}`, [workbench.md](workbench.md)).
- **Renewal**: the room sends `{kind: "grant-renew", expiresAt}` 30 seconds before a socket's grant runs out; the
  editor answers `{kind: "grant", grant}` with a fresh one. A fresh grant saying the same moves the lapse
  on; one with another level or tab closes the socket (4005) so it reconnects as what it now is; none in
  time closes it (4007). Revoking a link closes the sockets that link admitted.

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
minute, with retries:

- `PUT /app/items/:id/summary` — `{summary, updatedAt}`.
- `PUT /app/items/:id/collab/:tabId` — the tab's comment threads and actions, replacing that tab's rows:
  `{tabName?, threads: [{elementId, elementLabel, resolved, commentCount, participantIds, mentionedIds,
latestText, latestAuthorName, latestAuthorColor?, latestAuthorId?, resolvedById?, card?, firstAt, latestAt}],
actions: [{elementId, actionId, elementLabel, name, description?, status, assigneeId, assigneeName?, assignerId,
assignerName?, teamId, doneById?, card?, createdAt, updatedAt}]}`. The same push makes the Timeline's
  collaboration events (below); the optional ids say who wrote, resolved or closed. The comment text itself stays in the content, beside what it is about; the index
  keeps what the Inbox needs: the latest comment's opening, the action's note, and the names on it. Shown text
  is cut to length rather than refused.
- Cards and their threads go under the tab id `~cards` (`COLLAB_CARDS_TAB`): each card assigned to someone is an
  action whose `elementId` is the card's id, and each card's thread a thread, both with `card: {key, type,
typeLabel, title, board: {tabId, elementId, title, tabName} | null}` (`board` is where the row opens it; null
  when no board shows it). An app whose cards name people by a hash matches it to a person id before pushing
  (`@liveworkspace/index-app` `cardsCollabPush`); a card whose assignee it cannot name is left out.
- `PUT /app/items/:id/forms/:tabId` — `{form: {heading, boardTabId, responses, latestAt, code?} | null}`: a form's
  heading, the tab its responses land on, how many it has taken and when the last came; `null` takes it off the
  Inbox (deleted, or the tab gone). Pushed by the app's server when a response lands, the form is published,
  deleted or renamed. `PUT /app/items/:id/forms/:tabId/seen` — `{personId, seen}`: that person has seen the
  first `seen` responses (a count only grows). Opening the form marks every response so far seen; publishing
  marks them seen for the publisher. `code` is the live link's public code, sent when the link is published
  (before anyone is given it); a push without one keeps the code held, and `null` drops it with the row.
- `GET /app/forms/:code` — `{itemId, tabId}`: the item and tab a live form's code names, for the app that pushed
  it (404 otherwise), so the app's Worker routes a public form request to its item without a table of its own
  (`@liveworkspace/index-app` `createFormPlaces` caches the answer a minute). `GET
/app/items/:id/forms/:tabId/seen/:personId` — `{seen}`: how many of the form's responses that person has seen
  (0 when none), for the app's own unseen count.

- `PUT /app/items/:id/events` — `{events: [{type: 'edited', actorId, actorName?, at}]}`, up to 100: who
  wrote to the item and when, for the Timeline and Most Used. Each person's `edited` lands on one event per
  item and UTC day (a later report moves its time on), and counts that day as one of their use days, as an
  open does. liveplanner sends one per person who wrote since its last push, with the time of their latest
  write.
- `PUT /app/people/events` — `{events: [{type: 'image_uploaded', actorId, at, count?}]}`, up to 100, from the
  app's server when a person uploads images (not a deduped re-upload): each adds `count` (default 1) to that
  person's one `image_uploaded` event for the app and UTC day, seen by them alone.

## Notices

What the index tells an item's app, and answers it, for the app's notification emails
([accounts.md](accounts.md) "Notification emails"). The index sends no email: it says what happened, once,
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

## Timeline

What happened to the items a person reaches as owner or team member, newest first: in their own space,
and in each team they are in (a newcomer sees what happened before they joined). Items shared with them
by link are not on it.

- The index records `created` (with `source` when an AI or import made it, `copiedFrom` for a copy),
  `renamed` (`from`), `moved` (`folderName`, `teamId`), `trashed`, `restored`, `shared` (`level`),
  `unshared` and `favourited` in the same batch as the change. A favourite is on its person's Timeline
  only. An empty item its app tidies away is not news. An item created with `synced: true` (kept offline in
  one browser, put back under its own id) records `synced` instead of `created`; `DELETE
/items/:id?permanent=true&reason=offline` (taken offline into one browser) records `taken_offline` on its
  person's Timeline, keeping the item's name after it has gone. Only its owner's goes for good: a joined
  teammate taking a team item offline sends the team's copy to the team Trash (`trashed`) instead, since from
  the team's side it is a deletion.
- From each collab push, in the batch that replaces the tab's rows, the index compares the tab with what it
  held: a thread with more comments is `commented` (`text`, `count`, `reply`, `on`), one turned resolved
  `comment_resolved`, an action or open card with a new assignee `action_assigned` (`action`, `assigneeId`,
  `assigneeName`; the assignee sees it too, wherever the item is), one turned done `action_done`. Each id is
  made from what it says, so a push sent again records nothing new, and nothing dated before the item was made
  (a copy's threads) is news. At most `COLLAB_EVENTS_MAX` (100) a push, the newest. A deleted comment's words
  leave the Timeline with it: a thread with fewer comments than it held drops its `commented` events past its
  count, and a thread that is gone drops its `comment_resolved` too (never read from a push at the thread cap).
- `opened_by_visitor` and `copied_by_visitor`: someone who came in through a share link, on the item owner's
  Timeline alone. An open (a grant through a link) is one event per visitor, item and UTC day, its time moving on;
  a copy through a link is one per visitor and item. The actor is the visitor's account or guest id, or null for
  one with no identity (known by the link they came in through). Written off the response path, an open at most
  once a day per isolate.
- `share_link_expiring` warns an item's owner (them alone) before its share links stop working: one per item,
  dated at the soonest expiry among its live links that lapse within `SHARE_EXPIRY_WARNING_MS` (a week), so it
  waits in Upcoming (`expiresAt`, `links`: how many lapse in the week). Making, extending or deleting a link works
  it out again at once; a daily pass (at most 2,000 items, the soonest first) catches links the week has since
  reached, and leaves one the owner removed from their Timeline removed.
- Apps report `edited` and `image_uploaded` (above).
- liveworkspace accounts reports its teams' and API tokens' events, `POST /internal/timeline {events}` with
  its key (up to 100, each `{id, type, actorId, actorName?, title, detail?, at, scopes}`): `team_invite_sent`,
  `team_joined`, `team_declined`, `team_role_changed`, `team_member_removed` (`left` when they left),
  `team_renamed` (`from`), `team_deleted`, `token_created`, `token_revoked` and `token_expiring` (dated at the
  expiry, so it waits in Upcoming). Their app is `liveworkspace` (`TIMELINE_PLATFORM`); `scopes` (at most 250)
  say who sees each: a team's events its team (`t:<team>`) and the people they are about, a token's its owner.
  Accounts writes each to an outbox in the batch that makes the change and sends them after the response,
  resending until the index takes them; the ids make a resend change nothing.
- An event about no item (a team's, a token's, images, an item taken offline) has `itemId` and `item` null and
  keeps its own `app` and `title`. Filtered to one app, a Timeline shows that app's events and the account's
  own (`liveworkspace`); All shows everything. One no scope sees any more is swept daily.
- `GET /timeline?app=&limit=&cursor=` — `{events, nextCursor, seenAt}`. `app` unset: every app. `limit`
  30 by default, at most 100. Each event: `{id, app, type, actorId, actorName, itemId, title, detail,
occurredAt, item}`, `title` being the item's name then and `item` the item as it is now (null for an event
  about no item). One statement a page: an index range of at most `limit + 1` rows per scope (by scope, then
  app, then time; filtered, a second for `liveworkspace`), the newest of those joined to their events and
  items.
- `GET /timeline?item=<id>&limit=&cursor=` — one item's history (an item menu's History), the same shape:
  only that item's events, read through the events' item index, each kept when one of the person's scopes
  sees it and they haven't removed it.
- `POST /timeline/seen` — `{seenAt}`: what came before is no longer new.
- `POST /timeline/dismiss {ids}` — 204: Remove from Timeline, for this person only. 1 to
  `TIMELINE_DISMISS_MAX` (100) event ids; an id from nowhere adds nothing. A removed event leaves their
  pages and their count, and goes when the event does. A guest's removals follow them into their account.

The index keeps no names of people. An event shows its person as "You" to them; to anyone else, by the
name an app reported, or as a teammate.

## Inbox

`GET /inbox?app=` — `{threads, actions, forms, timelineNew}` across every app: open actions and cards assigned
to or by me; unresolved threads (an element's or a card's) on my items, where I commented, or where I am
mentioned; and forms with responses I haven't seen on items I own or reach through a team (not through a
link); all limited to items I can reach. Each row carries `app`, `itemId`, `itemTitle`, `itemTeamId`, `tabId`
and `tabName`, so opening it goes to that app; a thread says why it is there (`mentionsYou`, `youCommented`,
`onYourItem`). `timelineNew` is the sidebar's Timeline count, read in the same batch: events by someone else
since my last look, up to now (never one still to come), not removed, counted to at most
`TIMELINE_NEW_CAP + 1` (100, shown as "99+"); 0 before my first look. One read is three indexed queries and the
count: about 18 ms with 2,000 of my items among 22,000, each with a form, a thread and an action.

The Explorer shows it in four sections, each hidden when empty: **Assigned to You** (actions and cards, a
self-assignment only here), **Assigned by You**, **Form Responses** ("3 new responses to Bug Report", opening the
board they land on) and **Open Comment Threads** (with **Mentioned You**, or **Your plan** when the item is mine
and I haven't commented). It follows the header's filter: this app's rows, or every app's with each row's app
mark. The sidebar's badge counts Assigned to You, 0 included once read. Coming back to the browser tab reads it
again (at most every 30 seconds), keeping the list if that read fails. An app may add rows the index never sees
(liveplanner's plans in This Browser) through the Explorer's `inbox` prop; they carry the This Browser pill. A
row opens through the host's `itemHref` with an `ItemPlace`: the tab and element, `open: 'action' | 'comments'`
for the popover, and `cardId` for a card.

## What goes away in each app, as it moves

Its tables for folders, favourites, opens, Trash state, share links, shared-with, placement
defaults, the collab index, its own Timeline (the index's replaces it), the teams mirror and guest ids,
and the routes over them. Its
content tables move into the item's Durable Object.
