# Default folders

Status: shipped. The server side (storage, the API, resolution on create, the intent every create
caller sends, the intent recorded on the document) and the surfaces that set, show and clear a
default ([Surfaces](#surfaces)) are live.

## What

A **default folder** is where a person's new documents land when they create one without choosing
a place. A person keeps one default per **default key**, and the key is chosen by how the new
document opens. livedocuments has one editor mode, Pages, so today the list holds one key: every new document can land in, say, "Pages". Defaults belong to the person, not to a folder or a
team: two teammates may send the same new documents to different places.

## Domain language

| Term                 | Means                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **default folder**   | The folder a person's new documents of one key land in when no place is chosen.                    |
| **default key**      | What a default is for: `<dimension>:<value>`, e.g. `mode:pages` (`PlacementDefaultKey`).           |
| **creation intent**  | What a new document is made as, captured once when it is created: opens in and tab kind.           |
| **opens in**         | The editor mode the document's first tab opens in (`EditorMode`).                                  |
| **tab kind**         | What the first tab is (`TabKind`).                                                                 |
| **explicit root**    | The root of My Work, chosen on purpose (the placement picker's root tile): a place like any other. |
| **dangling default** | A default whose folder is gone, no longer the person's to see, or in a team the person has left.   |

- "Default" on its own is ambiguous here (default theme, default text size, the Default template); in
  specs and code say **default folder** or **placement default**.
- A mode is never a "type": say **opens in**.

## Default keys

The list a person sets defaults from is titled **New documents that open as**, and holds, in this
order:

| Entry           | Key          |
| --------------- | ------------ |
| Pages documents | `mode:pages` |

- A key is `<dimension>:<value>`. There is one dimension, `mode` (opens in).
- The keys are a **closed list** (`PLACEMENT_DEFAULT_KEYS`), generated from the editor modes. A key
  outside it is refused when set and ignored when read.
  - **Mode keys** come from the editor modes (`EDITOR_MODES` in `@livedocuments/document`), one
    `mode:<mode>` per mode in the modes' order: a new editor mode gains its key, and its entry in
    the list, with no other change.

## Creation intent

- **Captured once, at creation**, and never re-derived: content drawn afterwards does not move a
  document. The intent is recorded on the document ([Recorded intent](#recorded-intent)).
  - `mode`: the editor mode the first tab opens in: `pages`, including a document with no tab.
  - `tabKind`: the first tab's kind. Absent on the wire reads as the general tab.
- **Sent on the create** as `intent: { mode, tabKind? }` beside the placement
  ([Placement on create](folders.md#placement-on-create)).
- **Who sends it:**
  - every create that makes something new: the New Document wizard and its bypasses
    (`/new?blank=1`, `/new?template=`), imports into the account and the MCP `create_document` tool, which sends the intent of the first
    tab it built;
  - **Duplicate**, which sends the source's **recorded** intent unchanged, together with an explicit
    placement, so it is recorded and never routed ([Duplicate](#duplicate)).
- **Who does not:** a create that keeps a place the document already has and has no recorded intent
  to carry. An Offline Mode sync keeps the folder it had in the browser and records unknown. A create without an intent never consults defaults.
- An intent that is present but malformed (no known `mode`, a `tabKind` outside its list) refuses the create, `intent_invalid` (400), before anything is written.

## Recorded intent

The creation intent is also **written on the document**, by the same insert that creates it, and
never re-derived or rewritten afterwards:

| Column     | Field     | Holds                                          |
| ---------- | --------- | ---------------------------------------------- |
| `opens_in` | `opensIn` | The editor mode the document opens in, or null |
| `tab_kind` | `tabKind` | The first tab's kind at creation, or null      |

- **Null `opensIn` means unknown**, never Pages: the document was made before intents were
  recorded, or by a create that carries none (an Offline Mode sync, an API
  script, the Duplicate of a document whose own intent is unknown). Its `tabKind` is then unknown too.
- **With a known `opensIn`**, `tabKind` is always known.
- The first tab's kind is a column of its own because the document has no other honest record of
  it: tabs are reordered, removed and shared between documents after creation.
- The fields are on both the document summary and the document.
- A copy made by `POST /api/documents/:id/copy` carries the source's recorded values, as Duplicate
  does: they are a fact about the content, not derived again.
- A stored value outside its list (one since retired) reads as null.
- They are kept for the [Explorer filters](explorer-filters.md), whose `opens-in:` token reads `opensIn`.
  Copy says "opens in" for a mode and never "type" (see [Domain language](../003-system-architecture/domain-language.md)).

## Duplicate

- A Duplicate lands **beside its source**: the source's own team and folder, sent as an explicit
  placement, the root of My Work included (as an explicit root). When the server refuses that
  place (a team the person is not in, someone else's personal folder), the Duplicate is filed at the
  explicit root of My Work instead, saying so in its log.
- It records the **source's recorded intent** (`opensIn`, `tabKind`), unchanged;
  an unknown one stays unknown.
- It is **never routed by a default**: its placement is always explicit.
- The server copy (`POST /api/documents/:id/copy`) agrees: it carries the same two values, and
  files the copy at the root of the copier's My Work, a place it chooses, never a default.

## Precedence

A create's place is decided in this order; the first that answers wins:

1. **Explicit placement**: a folder, a team (its root included), or the explicit root of My
   documents.
2. **Mode default**: the default for `mode:<mode>`.
3. **The root of My Work**.

- **An absent placement is no choice.** A create whose body names no `folderId` (the key absent) and
  no team, and that carries an intent, consults the defaults.
- **An explicit root is a choice.** `folderId: null`, present in the body, is the root of the chosen
  space, chosen on purpose; with no team it is the explicit root of My Work, and it always wins
  over a default. ([Placement on create](folders.md#placement-on-create) names the wire shape.)
- **The wizard** sends a `/new?folder=` / `?team=` context as an explicit placement. Every other create from
  `/new` (**Create**, **Skip**, a bypass link without context) sends no placement, so these
  defaults decide ([The New Document wizard](#the-new-document-wizard)).
- A re-commit of an id the person already owns keeps its stored place; defaults are not consulted.

## What a default may point at

- **A personal folder of the person**, or **a team folder of a team the person has joined**. Team
  membership is checked against the verified account id (a signed-in session or an API token) only,
  never the guest `X-Owner-Id`, as for [Placement on create](folders.md#placement-on-create).
- Not a space's root: the root of My Work is where a document lands with no default, and a
  team's root is reached by creating inside the team.
- Setting a default checks the folder then: a folder that is missing, someone else's, or in a team
  the person has not joined is `folder_not_found` (the answer never reveals that someone else's
  folder exists).

## Dangling defaults

- A default is checked again **each time it is used**. Its folder may since have been deleted or
  binned, may no longer be the person's to see, or may be in a team the person has left.
- A dangling default is **skipped**: resolution falls through to the next level of the precedence.
  It never fails a create.
- A dangling default is **kept**. There is no foreign key and no cascade. It goes when the person clears it or sets that key
  to another folder, or with the account.

## Guests and accounts

- **Guests have defaults too**, keyed on their owner id, limited to their personal folders (a team
  needs a verified account).
- **Signing up carries them into the account** with the guest's folders (`POST /api/migrate`). When
  the account already has a default for the same key, the account's stays and the guest's goes.
- **Account deletion removes them** ([Owner-keyed data](../015-api/api.md#owner-keyed-data)).

## Storage and limits

- Defaults live in their **own D1 table** (`placement_defaults`), one row per person and key, not
  in the 4 KB preferences blob ([User preferences](../007-editor/user-preferences.md)).
- A person holds at most one default per key, so their rows are bounded by the length of the key
  list (one today).
- Writes ride the per-owner write rate limit (`WRITE_RATE_LIMITER`, [Rate limiting](../015-api/api.md#rate-limiting)).

## API

| Method | Path                           | Body           | Answer                              |
| ------ | ------------------------------ | -------------- | ----------------------------------- |
| GET    | `/api/placement-defaults`      |                | `{ defaults: [{ key, folderId }] }` |
| PUT    | `/api/placement-defaults/:key` | `{ folderId }` | 204, the default set                |
| DELETE | `/api/placement-defaults/:key` |                | 204, the default cleared            |

- Owner-scoped: the signed-in account, an API token's owner, or a guest's `X-Owner-Id`.
- `GET` answers every stored default whose key is in the list, in list order, dangling ones
  included: a surface shows a dangling default as such.
- `DELETE` of a key with no default is a 204 as well.

| Rejection                | Status | When                                                                  |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| `default_key_invalid`    | 400    | `:key` is not one of the keys                                         |
| `default_folder_invalid` | 400    | The body is not an object whose `folderId` is a non-empty string      |
| `folder_not_found`       | 404    | The folder is missing, someone else's, or in a team not joined        |
| `rate_limited`           | 429    | The per-owner write rate limit is spent                               |
| `intent_invalid`         | 400    | (on `POST /api/documents`) `intent` is present but not a valid intent |

## Surfaces

Every surface reads one copy of the person's defaults, loaded once per page and updated in place by
any surface that sets or clears one, so a change made in a menu shows at once in the markers and
Settings.

### Entry names

Each key has a label, the plural a sentence uses, and an icon, in list order:

| Key          | Label           | In a sentence   | Icon                  |
| ------------ | --------------- | --------------- | --------------------- |
| `mode:pages` | Pages documents | Pages documents | The Pages mode's icon |

- A new editor mode is named once (label, plural and icon) and
  needs nothing else; until it is named, it does not compile.
- Lists of entries in a sentence join with commas and a final "and".

### Use as Default for

- **Every folder menu** (the one shared folder menu of the Explorer page's rows and cards, the
  sidebar tree, the editor's Explorer panel and a team's library) carries **Use as Default for**,
  which opens a submenu titled **New documents that open as** listing the entries, each a
  checkable item, checked when this folder is that key's default.
  - Choosing an unchecked entry makes this folder the key's default; a key points at one folder,
    so the folder that held it loses it.
  - Choosing a checked entry clears the key's default.
  - The submenu stays open after a choice, so several entries can be set in one visit; Escape or a
    click elsewhere closes it.
- **Team folders** offer it only to a signed-in, joined member: the folder menus of a team's
  library, and of the editor panel's team tree, are theirs alone. A guest never sees a team folder.
- **My Work** carries the same submenu on its own menu (the sidebar's My Work row, and
  the editor panel's): the root is where a document lands without a default, so there an entry is
  checked when its key has **no working default** (none, or a dangling one). Choosing an unchecked
  entry clears that key's default, sending those documents back to the root; a checked entry is
  already the root's, and is shown checked and unavailable.
- **A team's root** offers no submenu: it cannot be a default ([What a default may point
  at](#what-a-default-may-point-at)).

### The default marker

- A folder that is one of the reader's defaults shows a **default marker** after its name (and
  after its count badge, where it has one): in the sidebar tree, the editor panel's folder rows, and
  the Explorer's and a team library's folder list rows and cards.
- The marker shows the icons of the folder's keys in list order, at most two, then **+N** for the
  rest, in the muted chrome colour.
- Its tooltip says what it means: "Default folder for new Pages documents". Assistive technology hears the same words: as the
  row's description in a tree, after the name in a list row or card. It is never colour alone: the
  icons differ in shape, and the words are always there.
- It takes space the row already holds after the name, so its appearance once the defaults load
  moves nothing on the row.
- A dangling default marks nothing; the My Work row shows no marker.

### The New Document wizard

The wizard never asks where a document goes ([New document route](../007-editor/new-document-route.md#one-step-wizard)):
it has no Location step and shows no folder browser.

- **No context, no placement.** A document made from `/new` without a `/new?folder=` or `?team=` context carries no
  placement, only its intent, so the server's [precedence](#precedence) files it: the default for its key, else the
  root of My Work. A default the browser has not loaded yet is still honoured, as the server
  resolves it.
- **A context is explicit.** A `/new?folder=` or `?team=` link files the document there, in livedocuments, ahead of
  any default.
- **Where to change it.** Settings > Documents > Default Folders ([Settings](#settings)), the folder menus' **Use as
  Default for** and My Work' own menu. The wizard itself sets nothing.
- None of this applies to **This Browser**: an offline document has no folder ([Non-goals](#non-goals)).

### Settings

- Settings holds a **Documents** category, for guests and accounts alike, led by **Default Folders**.
- **Default Folders** has one row per entry, in list order, under one line saying what they share
  ("Where each kind of new document is saved when you create it without choosing a place.") and the
  article's **Learn more**, said once rather than under every row.
- A row names the entry, in the title case of every Settings label ("Pages Documents"), and beneath it where those documents go: the folder's name (a team folder adds its
  team: "Decks · Design team", with a small folder mark), or **My Work** when there is
  no default. Until the
  defaults and the folders have loaded it reads "Loading…"; if either cannot be read, "Couldn't
  load your default folders", with no buttons, never a guess.
- **Clear** and **Change** sit beside it. **Change** opens the [default folder
  picker](#the-default-folder-picker). **Clear** clears the default; it is shown only while there is one.
- **A dangling default** reads "<folder> (deleted), using <place>", or "<folder> (no longer
  available), using <place>" for a team folder whose team is not among the reader's, where <place>
  is where those documents go instead: the next working default of the
  [precedence](#precedence) for that entry, else My Work. A Clear is offered.
  - The folder's name comes from this browser's memory of the names of the reader's default
    folders, kept while they were visible. When the browser never saw it, the row reads "A deleted
    folder, using <place>".

### The default folder picker

A dialog around the shared placement browser ([Folders](folders.md)), titled "Default folder for
new <these>", opened by Settings' Change.

- It opens with the key's current default selected, else the My Work root.
- Choosing the **My Work root** clears the default. A team's root cannot be chosen: with it
  selected, the dialog says "Choose a folder inside the team" and its button is unavailable.
- Its button reads **Use this folder** (or **Use My Work** at the root), and is unavailable
  until the selection differs from the current default.
- It offers the inline New Folder tile, as the move picker does.

### Deleting a default folder

- The folder delete confirmation ([Folders](folders.md#deleting-a-folder)) adds a line when the
  folder is one of the reader's defaults: "New Pages documents are saved here by
  default. Choose another default folder in Settings."
- Deleting it leaves the default dangling ([Dangling defaults](#dangling-defaults)); the confirm
  does not clear it.
- Only the reader's own defaults are known: a teammate's default on a team folder is theirs.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Folder` · `Changed` · `DefaultModePages`, fired by the surface that sets a default, before the write.

- `Folder` · `Cleared` · the same values, fired by the surface that clears one, before the write.
- The value is closed: one per key, derived from it (`placementDefaultTelemetryType`), never a
  folder name or id.

## Observability

- `placement: resolved scope=<personal|team> folder=set via=default key=<key>` when a default
  decides a create; `via=explicit` for a chosen place, the explicit root included.
- `placement: default-skipped key=<key> reason=<folder_missing|folder_not_visible|team_not_joined>`
  for every dangling default passed over.
- `placement-defaults: set key=<key> scope=<personal|team>`,
  `placement-defaults: cleared key=<key>` and `placement-defaults: rejected reason=<code>` on the
  routes.
- `[duplicate] placement refused reason=<code>, filed at the root` when a Duplicate cannot sit
  beside its source.
- In the browser, `[default-folders]` lines: `loaded count=<n>`, `load failed status=<n>`,
  `set key=<key> surface=<menu|settings>`, `cleared key=<key> surface=<…>` and
  `write failed key=<key> code=<code>, rolled back`.

## Non-goals

- A default for a space's root, per device, or per template.
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
