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
|                                |                     | `lastOpenedAt` for `recent`.                                                 |
| `POST /items`                  | person              | `{app, title?, folderId?, teamId?, intent?, source?}` → 201                  |
|                                |                     | `{item, grant}`. The index makes the id; the item's Durable Object           |
|                                |                     | starts empty the first time it is opened with a grant.                       |
| `GET /items/:id`               | person or link      | `{item}`                                                                     |
| `PATCH /items/:id`             | editor              | `{title?, folderId?, teamId?}` → `{item}`. Moving into or out of a           |
|                                |                     | team needs joined membership.                                                |
| `DELETE /items/:id`            | owner / team        | To the Trash; `?permanent=true` purges (below).                              |
| `POST /items/:id/restore`      | owner / team        | `{item}`                                                                     |
| `POST /items/:id/copy`         | anyone who can view | `{title?}` → 201 `{item}`. The index makes the row, then asks the            |
|                                |                     | app to copy the content (`POST <app>/api/internal/items/:from/copy-to/:to`). |
| `POST /items/:id/open`         | person or link      | Records an open for Recent. Debounced: at most one write a minute            |
|                                |                     | per person and item.                                                         |
| `POST /items/:id/grant`        | person or link      | `→ {grant, level, tabId, expiresAt}`. A link visitor sends                   |
|                                |                     | `X-Share-Code` (and `X-Share-Password` when set).                            |
| `GET /trash` / `DELETE /trash` | person              | List, empty (`?team=`).                                                      |

**Purging.** A permanent delete, or the daily sweep of items in the Trash for 30 days, removes the index
rows and asks the app to drop the content (`DELETE <app>/api/internal/items/:id`, app key). If the app
cannot be reached, the index keeps a tombstone and retries daily.

## Folders, tags, favourites, defaults

Folders are not per app: one tree per person, and one per team, holding items from any app.

- `GET/POST /folders`, `PATCH/DELETE /folders/:id` — `{id, name, parentId, teamId, ownerId, createdAt,
updatedAt}`; 409 `folder_exists`, `cycle`. Deleting moves children (folders and items) up a level.
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
those 10 minutes; revoking a link also tells the item at once (`POST <app>/api/internal/items/:id/revoke`).

## What an item pushes

Items push only what is derived from their content, from their Durable Object, on idle, at most once a
minute, with retries:

- `PUT /app/items/:id/summary` — `{summary, updatedAt}`.
- `PUT /app/items/:id/collab/:tabId` — the tab's comment threads and actions, replacing that tab's rows:
  `{threads: [{elementId, elementLabel, resolved, commentCount, participantIds, mentionedIds, latestText,
latestAuthorName, firstAt, latestAt}], actions: [{elementId, actionId, elementLabel, name, status,
assigneeId, assignerId, teamId, createdAt, updatedAt}]}`. The comment text itself stays in the
  content, beside what it is about; the index keeps what the Inbox needs.

## Inbox

`GET /inbox?app=` — `{threads, actions}` across every app: open actions assigned to or by me, and
unresolved threads on my items, where I commented, or where I am mentioned, limited to items I can
reach. Each row carries `app`, `itemId`, `tabId` and `elementId`, so opening it goes to that app.

## What goes away in each app, as it moves

Its tables for folders, tags, favourites, opens, Trash state, share links, shared-with, placement
defaults, the collab index, the Timeline, the teams mirror and guest ids, and the routes over them. Its
content tables move into the item's Durable Object.
