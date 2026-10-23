# One Explorer, and content in Durable Objects

Status: plan, October 2026, being built in the order below. The calls, types and tokens are in
[one-explorer-contracts.md](one-explorer-contracts.md).

Today each app (livediagram, liveplanner, livedocuments, livedesign) runs its own copy of the same
Explorer over its own D1 database: its own folders, tags, favourites, Trash, sharing, Recent,
Timeline and Inbox. A folder in livediagram and a folder in liveplanner have nothing to do with each
other, and every Explorer fix has to be made four times.

This plan moves the Explorer and everything it lists to liveworkspace, and moves each item's content
out of D1 into its own Durable Object. It builds on the RFC "Move document content from D1 to
per-document Durable Objects" (livediagram discussion #508), and goes one step further: the small
index that RFC keeps in D1 leaves the apps and lives once, on liveworkspace.app.

## What each app calls its things

| App           | One item is a | Its Durable Object |
| ------------- | ------------- | ------------------ |
| livediagram   | Canvas        | `CanvasRoom`       |
| liveplanner   | Plan          | `PlanRoom`         |
| livedocuments | Document      | `DocumentRoom`     |
| livedesign    | Design        | `DesignRoom`       |

The new names are used from the start in the new Durable Objects, routes and index rows, so nothing
is renamed twice. Until each app moves, only what people see is renamed.

## The shape

```
                 liveworkspace.app
   ┌─────────────────────────────────────────────┐
   │ accounts   people, guests, teams, tokens    │
   │ index      items, folders, tags, favourites │
   │            sharing, opens, Trash,           │
   │            comments, actions, Inbox         │
   │ grants     short-lived "may open item X"    │
   │ explorer   the UI, as a package             │
   └─────────────────────────────────────────────┘
        ▲ register / rename / move     │ grant
        │                              ▼
   livediagram.app   liveplanner.app   livedocuments.app   livedesign.app
   /explorer renders @liveworkspace/explorer, filtered to this app or All
   one Durable Object per item: tabs, elements, change log, presence
```

### 1. The index is the only record of where an item is and who can reach it

liveworkspace keeps one row per item: id, app, title, owner, team, folder, tags, favourite, Trash
state, created, updated, last opened, a thumbnail key, and its share links and the people it is
shared with. Folders are not per app: a folder can hold a Canvas, a Plan, a Document and a Design.

The Durable Object never keeps its own copy of any of this. Renaming in the editor writes the
index. Moving, tagging, sharing, trashing and restoring happen only in the index. That removes the
"feed D1 from every object" problem the RFC reply called the bulk of the work: the only things an
app pushes are its content-derived summary (see 5) and a thumbnail.

Search is title, tag and folder search over the index. It does not search inside content.

### 2. Who may open an item: short-lived grants

When the editor opens an item, it asks liveworkspace for a grant: a token signed by the index
naming the person (or guest), the item, the app and the access (view, participate or edit), valid for
ten minutes. The app's Durable Object checks it against the index's published keys without calling
liveworkspace, and the editor asks for a fresh one before it runs out. Share-link visitors get a grant from the link. Removing someone's access takes effect
within those few minutes.

Because the index decides access, including team access, each app's copy of the teams (the mirror
added this month) is no longer needed and goes away.

### 3. One identity for guests across every app

A guest's id today lives in each app's own browser storage, which other sites cannot read, so the
same person is a different guest on each site. Guests move into liveworkspace accounts: the first
time an app needs an identity, it sends the browser through liveworkspace.app (a quick redirect, the
same hand-off sign-in uses), which keeps a long-lived guest identity there and hands the app a guest
token. Every app gets the same guest. Signing up keeps the guest's items: the guest becomes the
account.

That first visit costs one redirect, once per browser per app. Opening an item without any identity
(a share link, an embed) needs no redirect: the link grants view access on its own.

### 4. The Explorer is built once and shown inside each app

`@liveworkspace/explorer` is a package in liveworkspace holding the whole Explorer UI and its client
for the index API. Each app renders it at its own `/explorer`, in its own colours and chrome, so
people stay on livediagram.app/explorer or liveplanner.app/explorer. A filter shows "this app's
items" or "All". Opening an item from another app goes to that app.

Creating is aware of where it is: New on livediagram.app/explorer makes a Canvas, on
liveplanner.app a Plan, and so on. The app creates the Durable Object and registers it in the index
in one step, then opens it.

The editors' floating Explorer panel and move-to-folder picker use the same package.

### 5. Comments, actions and the Inbox live in liveworkspace

What the Inbox needs about comments and actions is stored in liveworkspace, keyed by app, item, tab and
element: each item pushes its threads and actions there as they change. The comment text itself stays in
the item's content, beside what it is about, so it saves, undoes and copies with it. The Inbox in the
Explorer is then one query across every app: threads you are in, mentions, and actions assigned to you or by you. Comment and mention emails
are sent from liveworkspace too.

The Timeline moves too, and spans apps the same way: the index records what it changes itself (made,
renamed, moved, trashed, restored, shared, favourited) and each app reports who edited what. The
Explorer shows it filtered to the app it is in, or All, and Home's What Happened is read from it.

### 6. Content lives in one Durable Object per item

As the RFC proposes, and as its reply agreed: one SQLite-backed object per item, which is also the
live room. It holds tabs and their elements (as rows or chunks, which removes D1's 2 MB row limit),
the change log, the sequence counter and presence. Saves go to the object instead of to D1, and the
object gives each change its number and stores it in one step. Images stay in liveworkspace's media
service; snapshots stay in R2.

Each app's D1 shrinks to what is genuinely its own, if anything (for example livediagram's community
publishing or a Plan's cross-item caches); everything the Explorer needs is gone from it.

### 7. Google Drive

The Drive mirror covers every app, not just livediagram. It moves to liveworkspace: liveworkspace
walks the index, asks each item's app for an export of its content, and keeps Drive in step.

## Order of work

1. **Contracts.** The index schema, the grant format, the registration and summary calls an app
   makes, and the content API each item's object exposes (read, save, export). Written down before
   code, in this folder.
2. **Guests in accounts.** The guest identity and hand-off on liveworkspace.app, with the
   guest-to-account merge.
3. **The index service** on liveworkspace.app: items, folders, tags, favourites, sharing, opens,
   Trash, comments, actions, the Inbox query, and grants. Starts empty.
4. **`@liveworkspace/explorer`**, built against the index service and tried on liveworkspace.app.
5. **liveplanner first** (it holds no data): `PlanRoom` holds content, creation registers in the
   index, `/explorer` renders the shared package, comments, actions and the Timeline go to liveworkspace,
   and its own folders, tags, sharing, Timeline, Inbox, teams mirror and content tables are removed.
6. **livedocuments, then livedesign**, the same way.
7. **livediagram last.** It has real documents, so it needs a migration; that is planned separately.

## Cost and performance

- **Opening an item** adds one grant request to liveworkspace before the room connects. It can run
  in parallel with loading the editor's code, and the grant is reused for its lifetime.
- **The index is one D1 database for every app.** It takes only metadata writes (create, rename,
  move, share, open, comment), not content saves, which is what made D1's single write queue a worry
  in the RFC. "Last opened" writes are the most frequent; they are batched and debounced. If the
  index ever reports "overloaded", it can be split by owner.
- **Explorer lists** are index queries with indexes on owner, team, folder, app and last-opened, and
  are paged.
- **Durable Objects** cost what the RFC estimates (roughly $14 a month at a million items), with
  hibernating WebSockets.
- **Content-derived summaries** (thumbnails, element counts for cards) are pushed by the object on
  idle, at most once a minute per item, with retries.

## Decided

- The index is the source of truth for everything but content.
- Access is checked offline with short-lived grants signed by liveworkspace.
- Guests have one identity across every app.
- The Explorer UI is one package rendered inside each app, filterable to that app or All, and New
  creates that app's kind.
- Search covers the index only. The Timeline, comments, actions and the Inbox are centralised.
- The Drive mirror covers every app.
- Item names: Canvas, Plan, Document, Design, applied as each app moves.

## Not decided yet

- Moving livediagram's existing documents.
- Self-hosting an app without liveworkspace.
- The CLI and MCP server across apps.
