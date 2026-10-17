# Default folders

Status: shipped. The server side (storage, the API, resolution on create, the intent every create
caller sends, the intent recorded on the document) and the surfaces that set, show and clear a
default ([Surfaces](#surfaces)) are live.

## What

A **default folder** is where a person's new documents land when they create one without choosing
a place. A person keeps one default per **default key**, and the key is chosen by how the new
document opens and what it is made as: a document that opens in Diagram mode can land in "Diagrams",
one that opens in Drawing mode in "Sketches", and a retrospective in "Retros". Defaults belong to the
person, not to a folder or a team: two teammates may send the same new documents to different places.

## Domain language

| Term                 | Means                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **default folder**   | The folder a person's new documents of one key land in when no place is chosen.                            |
| **default key**      | What a default is for: `<dimension>:<value>`, e.g. `mode:draw` (`PlacementDefaultKey`).                    |
| **creation intent**  | What a new document is made as, captured once when it is created: opens in, tab kind and template family.  |
| **opens in**         | The editor mode the document's first tab opens in (`EditorMode`).                                          |
| **tab kind**         | What the first tab is (`TabKind`): the general `diagram` tab, or a specific kind such as `event-storming`. |
| **template family**  | The family of templates the document was made from, when it has one: `retrospective` or `kanban`.          |
| **explicit root**    | The root of My Documents, chosen on purpose (the placement picker's root tile): a place like any other.    |
| **dangling default** | A default whose folder is gone, no longer the person's to see, or in a team the person has left.           |

- "Default" on its own is ambiguous here (default theme, default text size, the Default template); in
  specs and code say **default folder** or **placement default**.
- A mode and a template family are never a "type": say **opens in** for a mode and **template
  family** for a family. "Board type" is not a term here: of the boards in the list, only the
  event-storming board is a tab kind of its own; a retrospective and a Kanban board are general
  diagram tabs made from a template family.

## Default keys

The list a person sets defaults from is titled **New documents that open as**, and holds, in this
order:

| Entry                 | Key                      |
| --------------------- | ------------------------ |
| Diagrams              | `mode:diagram`           |
| Whiteboards           | `mode:draw`              |
| Illustrate pages      | `mode:illustrate`        |
| Plan boards           | `mode:plan`              |
| Sessions              | `mode:facilitate`        |
| Event Storming boards | `kind:event-storming`    |
| Retrospectives        | `template:retrospective` |
| Kanban boards         | `template:kanban`        |

- A key is `<dimension>:<value>`. The dimensions, most specific first, are `kind` (the tab kind),
  `template` (the template family) and `mode` (opens in).
- The keys are a **closed list** (`PLACEMENT_DEFAULT_KEYS`), generated from three closed lists. A key
  outside it is refused when set and ignored when read.
  - **Mode keys** come from the editor modes (`EDITOR_MODES` in `@livediagram/document`), one
    `mode:<mode>` per mode in the modes' order: a new editor mode gains its key, and its entry in
    the list, with no other change.
  - **Kind keys** come from the specific tab kinds a document can be created with: every creatable
    tab kind but the general `diagram` tab, today `event-storming`.
  - **Template keys** come from the template families (`TEMPLATE_FAMILIES`): `retrospective`,
    `kanban`.

## Creation intent

- **Captured once, at creation**, and never re-derived: content drawn afterwards does not move a
  document. The intent is recorded on the document ([Recorded intent](#recorded-intent)).
  - `mode`: the editor mode the first tab opens in. `draw` for a tab that opens in Drawing mode,
    including a stored legacy `kind: 'whiteboard'` tab ([Drawing mode](../023-drawing-mode/drawing-mode.md));
    `diagram` otherwise, including a document with no tab and an event-storming board.
  - `tabKind`: `event-storming` when the first tab is an
    [event-storming board](../021-event-storming/event-storming.md), read the way the document model
    reads a tab's kind; `diagram` otherwise (a legacy whiteboard tab included). Absent on the wire
    reads as `diagram`.
  - `templateFamily`: by the **template** the document is made from. One exhaustive map from every
    template to its family, or none, decides it (`templateFamilyOf` in `@livediagram/templates`):
    every retrospective format (Retrospective, Start / Stop / Continue, Mad / Sad / Glad, 4Ls,
    Sailboat) is `retrospective`, the Kanban template `kanban`, every other template none, the
    Incident postmortem and Lean coffee included. A new template is not complete until it is
    mapped. Absent for an import, a blank document, or a template with no family.
- **Sent on the create** as `intent: { mode, tabKind?, templateFamily? }` beside the placement
  ([Placement on create](folders.md#placement-on-create)).
- **Who sends it:**
  - every create that makes something new: the New Document wizard and its bypasses
    (`/new?blank=1`, `/new?template=`), imports into the account (board and draw.io imports, Google
    Drive **Import a copy**) and the MCP `create_document` tool, which sends the intent of the first
    tab it built and the template it used;
  - **Duplicate**, which sends the source's **recorded** intent unchanged, together with an explicit
    placement, so it is recorded and never routed ([Duplicate](#duplicate)).
- **Who does not:** a create that keeps a place the document already has and has no recorded intent
  to carry. An Offline Mode sync keeps the folder it had in the browser and records unknown; a
  Google Drive copy of a mirrored file follows the mirror; a Drive restore puts back what it
  restores. A create without an intent never consults defaults.
- An intent that is present but malformed (no known `mode`, a `tabKind` or `templateFamily` outside
  its list) refuses the create, `intent_invalid` (400), before anything is written.

## Recorded intent

The creation intent is also **written on the document**, by the same insert that creates it, and
never re-derived or rewritten afterwards:

| Column            | Field            | Holds                                          |
| ----------------- | ---------------- | ---------------------------------------------- |
| `opens_in`        | `opensIn`        | The editor mode the document opens in, or null |
| `tab_kind`        | `tabKind`        | The first tab's kind at creation, or null      |
| `template_family` | `templateFamily` | The template family it was made from, or null  |

- **Null `opensIn` means unknown**, never Diagram: the document was made before intents were
  recorded, or by a create that carries none (an Offline Mode sync, a Drive mirror copy, an API
  script, the Duplicate of a document whose own intent is unknown). Its `tabKind` and
  `templateFamily` are then unknown too.
- **With a known `opensIn`**, `tabKind` is always known, and a null `templateFamily` means made from
  no family.
- The first tab's kind is a column of its own because the document has no other honest record of
  it: tabs are reordered, removed and shared between documents after creation.
- The fields are on both the document summary and the document.
- A copy made by `POST /api/documents/:id/copy` carries the source's recorded values, as Duplicate
  does: they are a fact about the content, not derived again.
- A stored value outside its list (one since retired) reads as null.
- They feed the [Explorer filters](explorer-filters.md), one chip per dimension: **Opens
  in** (`opensIn`, one option per editor mode), **Kind** (`tabKind`: Event Storming boards) and **Template**
  (`templateFamily`: Retrospectives, Kanban boards). A document with an unknown value matches no option of a chip;
  it shows whenever that chip is not set. Copy says "opens in" for a mode and never "type"
  (see [Domain language](../003-system-architecture/domain-language.md)).

## Duplicate

- A Duplicate lands **beside its source**: the source's own team and folder, sent as an explicit
  placement, the root of My Documents included (as an explicit root). When the server refuses that
  place (a team the person is not in, someone else's personal folder), the Duplicate is filed at the
  explicit root of My Documents instead, saying so in its log.
- It records the **source's recorded intent** (`opensIn`, `tabKind`, `templateFamily`), unchanged;
  an unknown one stays unknown.
- It is **never routed by a default**: its placement is always explicit.
- The server copy (`POST /api/documents/:id/copy`) agrees: it carries the same three values, and
  files the copy at the root of the copier's My Documents, a place it chooses, never a default.

## Precedence

A create's place is decided in this order; the first that answers wins:

1. **Explicit placement**: a folder, a team (its root included), or the explicit root of My
   documents.
2. **Kind default**: the default for `kind:<tabKind>`, when the first tab is a specific kind.
3. **Template default**: the default for `template:<templateFamily>`, when the document has one.
4. **Mode default**: the default for `mode:<mode>`.
5. **The root of My Documents**.

- **An absent placement is no choice.** A create whose body names no `folderId` (the key absent) and
  no team, and that carries an intent, consults the defaults.
- **An explicit root is a choice.** `folderId: null`, present in the body, is the root of the chosen
  space, chosen on purpose; with no team it is the explicit root of My Documents, and it always wins
  over a default. ([Placement on create](folders.md#placement-on-create) names the wire shape.)
- **The wizard** sends a `/new?folder=` / `?team=` context as an explicit placement. Every other create from
  `/new` (a mode chosen, **Create**, **Skip**, a bypass link without context) sends no placement, so these
  defaults decide ([The New Document wizard](#the-new-document-wizard)).
- A re-commit of an id the person already owns keeps its stored place; defaults are not consulted.

## What a default may point at

- **A personal folder of the person**, or **a team folder of a team the person has joined**. Team
  membership is checked against the verified account id (a Clerk session or an API token) only,
  never the guest `X-Owner-Id`, as for [Placement on create](folders.md#placement-on-create).
- Not a space's root: the root of My Documents is where a document lands with no default, and a
  team's root is reached by creating inside the team.
- Setting a default checks the folder then: a folder that is missing, someone else's, or in a team
  the person has not joined is `folder_not_found` (the answer never reveals that someone else's
  folder exists).

## Dangling defaults

- A default is checked again **each time it is used**. Its folder may since have been deleted or
  binned, may no longer be the person's to see, or may be in a team the person has left.
- A dangling default is **skipped**: resolution falls through to the next level of the precedence.
  It never fails a create.
- A dangling default is **kept**. There is no foreign key and no cascade, so a Google Drive restore
  that recreates the same folder id revives it. It goes when the person clears it or sets that key
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
  list (five).
- Writes ride the per-owner write rate limit (`WRITE_RATE_LIMITER`, [Rate limiting](../015-api/api.md#rate-limiting)).

## API

| Method | Path                           | Body           | Answer                              |
| ------ | ------------------------------ | -------------- | ----------------------------------- |
| GET    | `/api/placement-defaults`      |                | `{ defaults: [{ key, folderId }] }` |
| PUT    | `/api/placement-defaults/:key` | `{ folderId }` | 204, the default set                |
| DELETE | `/api/placement-defaults/:key` |                | 204, the default cleared            |

- Owner-scoped: the Clerk user, an API token's owner, or a guest's `X-Owner-Id`.
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

| Key                      | Label                 | In a sentence         | Icon                       |
| ------------------------ | --------------------- | --------------------- | -------------------------- |
| `mode:diagram`           | Diagrams              | diagrams              | The Diagram mode's icon    |
| `mode:draw`              | Whiteboards           | whiteboards           | The Drawing mode's icon    |
| `mode:illustrate`        | Illustrate pages      | Illustrate pages      | The Illustrate mode's icon |
| `mode:plan`              | Plan boards           | Plan boards           | The Plan mode's icon       |
| `mode:facilitate`        | Sessions              | sessions              | The Facilitate mode's icon |
| `kind:event-storming`    | Event Storming boards | Event Storming boards | A sticky note              |
| `template:retrospective` | Retrospectives        | retrospectives        | A clock turning back       |
| `template:kanban`        | Kanban boards         | Kanban boards         | A board of three columns   |

- A new editor mode, tab kind or template family is named once (label, plural and icon) and
  needs nothing else; until it is named, it does not compile.
- Lists of entries in a sentence join with commas and a final "and": "diagrams, whiteboards and
  retrospectives".

### Use as default for

- **Every folder menu** (the one shared folder menu of the Explorer page's rows and cards, the
  sidebar tree, the editor's Explorer panel and a team's library) carries **Use as default for**,
  which opens a submenu titled **New documents that open as** listing the five entries, each a
  checkable item, checked when this folder is that key's default.
  - Choosing an unchecked entry makes this folder the key's default; a key points at one folder,
    so the folder that held it loses it.
  - Choosing a checked entry clears the key's default.
  - The submenu stays open after a choice, so several entries can be set in one visit; Escape or a
    click elsewhere closes it.
- **Team folders** offer it only to a signed-in, joined member: the folder menus of a team's
  library, and of the editor panel's team tree, are theirs alone. A guest never sees a team folder.
- **My Documents** carries the same submenu on its own menu (the sidebar's My Documents row, and
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
- Its tooltip says what it means: "Default folder for new whiteboards", "Default folder for new
  diagrams, whiteboards and retrospectives". Assistive technology hears the same words: as the
  row's description in a tree, after the name in a list row or card. It is never colour alone: the
  icons differ in shape, and the words are always there.
- It takes space the row already holds after the name, so its appearance once the defaults load
  moves nothing on the row.
- A dangling default marks nothing; the My Documents row shows no marker.

### The New Document wizard

The wizard never asks where a document goes ([New document route](../007-editor/new-document-route.md#one-step-wizard)):
it has no Location step and shows no folder browser.

- **No context, no placement.** A document made from `/new` without a `/new?folder=` or `?team=` context carries no
  placement, only its intent, so the server's [precedence](#precedence) files it: the default for its kind, template
  or mode, else the root of My Documents. A default the browser has not loaded yet is still honoured, as the server
  resolves it.
- **A context is explicit.** A `/new?folder=` or `?team=` link files the document there, in livediagram, ahead of
  any default.
- **Where to change it.** Settings > Documents > Default Folders ([Settings](#settings)), the folder menus' **Use as
  default for** and My Documents' own menu. The wizard itself sets nothing.
- None of this applies to **Local Browser**: an offline document has no folder ([Non-goals](#non-goals)).

### A template picked after creation

The wizard makes the chosen mode's blank, and the template is picked afterwards on the new document's start screen
([Template starts](../007-editor/start-diagramming.md)), so a template's own default (`template:kanban`,
`kind:event-storming`) can only answer then.

- **The wizard leaves a note** (`lib/placement-defaults/template-pick-handoff.ts`, this browser tab only): the
  document it made, its first tab, and whether the person chose the folder themselves (a `/new?folder=` / `?team=`
  context). It is written for a
  cloud document made from a mode's blank, never for Local Browser or a template link (`/new?template=`), which is
  filed by its template at creation.
- **The first template picked from a start screen** (Start Diagramming, Drawing, Facilitating, Illustrating, or
  Start Planning's templates) on that first tab takes the note. When the person did not choose the folder, the
  precedence is resolved again for the template's intent, as the server resolves it (kind, then template, then mode
  default, `templatePickMoveTarget`), and the document **moves** to the default that answers, when it is somewhere
  else. A toast says so: "Moved to **Boards**, your default folder for Kanban boards."
- **Once per document:** the note is taken at the first pick, and dropped when the tab gains content any other
  way first.
- **Only an Editor** picks from a start screen, so only an Editor's pick moves a document.
- **The recorded intent stays as created** ([Recorded intent](#recorded-intent)): the mode's blank. The move does
  not rewrite `templateFamily`, so the Explorer's **Template** filter does not see a template picked after
  creation.
- A failure (a list that cannot be read, a refused move) leaves the document where it is, logged
  (`[default-folders] template pick move failed`); a move logs `[default-folders] moved on template pick key=<key>`.

### Settings

- Settings holds a **Documents** category, for guests and accounts alike, led by **Default Folders**.
- **Default Folders** has one row per entry, in list order, under one line saying what they share
  ("Where each kind of new document is saved when you create it without choosing a place.") and the
  article's **Learn more**, said once rather than under every row.
- A row names the entry, in the title case of every Settings label ("Whiteboards", "Kanban
  Boards"), and beneath it where those documents go: the folder's name (a team folder adds its
  team: "Workshops · Design team", with a small folder mark), or **My Documents** when there is
  no default. Until the
  defaults and the folders have loaded it reads "Loading…"; if either cannot be read, "Couldn't
  load your default folders", with no buttons, never a guess.
- **Clear** and **Change** sit beside it. **Change** opens the [default folder
  picker](#the-default-folder-picker). **Clear** clears the default; it is shown only while there is one.
- **A dangling default** reads "<folder> (deleted), using <place>", or "<folder> (no longer
  available), using <place>" for a team folder whose team is not among the reader's, where <place>
  is where those documents go instead: the next working default of the
  [precedence](#precedence) for that entry, else My Documents. A Clear is offered.
  - The folder's name comes from this browser's memory of the names of the reader's default
    folders, kept while they were visible. When the browser never saw it, the row reads "A deleted
    folder, using <place>".

### The default folder picker

A dialog around the shared placement browser ([Folders](folders.md)), titled "Default folder for
new <these>", opened by Settings' Change.

- It opens with the key's current default selected, else the My Documents root.
- Choosing the **My Documents root** clears the default. A team's root cannot be chosen: with it
  selected, the dialog says "Choose a folder inside the team" and its button is unavailable.
- Its button reads **Use this folder** (or **Use My Documents** at the root), and is unavailable
  until the selection differs from the current default.
- It offers the inline New Folder tile, as the move picker does.

### Deleting a default folder

- The folder delete confirmation ([Folders](folders.md#deleting-a-folder)) adds a line when the
  folder is one of the reader's defaults: "New whiteboards and retrospectives are saved here by
  default. Choose another default folder in Settings."
- Deleting it leaves the default dangling ([Dangling defaults](#dangling-defaults)); the confirm
  does not clear it.
- Only the reader's own defaults are known: a teammate's default on a team folder is theirs.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Folder` · `Changed` · `DefaultModeDiagram` / `DefaultModeDraw` / `DefaultModeIllustrate` /
  `DefaultModePlan` / `DefaultModeFacilitate` / `DefaultKindEventStorming` /
  `DefaultTemplateRetrospective` / `DefaultTemplateKanban`, fired by the surface that sets a
  default, before the write.
- `Folder` · `Cleared` · the same values, fired by the surface that clears one, before the write.
- The value is closed: one per key, derived from it (`placementDefaultTelemetryType`), never a
  folder name or id.
- `UI` · `Toggled` · `SkipLocationStepOn` / `SkipLocationStepOff` are retired with the wizard's Location step
  ([Telemetry → Retired features](../017-telemetry/telemetry.md#retired-features)).

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

- A default for a space's root, per device, or per template (templates route only through their
  family).
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
