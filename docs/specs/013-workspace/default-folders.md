# Default folders

Status: shipped. The server side (storage, the API, resolution on create, the intent every create
caller sends, the intent recorded on the document) and the surfaces that set, show and clear a
default ([Surfaces](#surfaces)) are live.

## What

A **default folder** is where a person's new documents land when they create one without choosing
a place. A person keeps one default per **default key**, and the key is chosen by how the new
document opens and what it is made as: a document that opens in Diagram mode can land in "Diagrams",
one that opens in Draw mode in "Sketches", and a retrospective in "Retros". Defaults belong to the
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
| **explicit root**    | The root of My documents, chosen on purpose (the placement picker's root tile): a place like any other.    |
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
  - `mode`: the editor mode the first tab opens in. `draw` for a tab that opens in Draw mode,
    including a stored legacy `kind: 'whiteboard'` tab ([Draw mode](../023-draw-mode/draw-mode.md));
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
  - every create that makes something new: the New Document wizard and its bypasses (Quick Start,
    `/new?blank=1`, `/new?template=`), imports into the account (board and draw.io imports, Google
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
  placement, the root of My documents included (as an explicit root). When the server refuses that
  place (a team the person is not in, someone else's personal folder), the Duplicate is filed at the
  explicit root of My documents instead, saying so in its log.
- It records the **source's recorded intent** (`opensIn`, `tabKind`, `templateFamily`), unchanged;
  an unknown one stays unknown.
- It is **never routed by a default**: its placement is always explicit.
- The server copy (`POST /api/documents/:id/copy`) agrees: it carries the same three values, and
  files the copy at the root of the copier's My documents, a place it chooses, never a default.

## Precedence

A create's place is decided in this order; the first that answers wins:

1. **Explicit placement**: a folder, a team (its root included), or the explicit root of My
   documents.
2. **Kind default**: the default for `kind:<tabKind>`, when the first tab is a specific kind.
3. **Template default**: the default for `template:<templateFamily>`, when the document has one.
4. **Mode default**: the default for `mode:<mode>`.
5. **The root of My documents**.

- **An absent placement is no choice.** A create whose body names no `folderId` (the key absent) and
  no team, and that carries an intent, consults the defaults.
- **An explicit root is a choice.** `folderId: null`, present in the body, is the root of the chosen
  space, chosen on purpose; with no team it is the explicit root of My documents, and it always wins
  over a default. ([Placement on create](folders.md#placement-on-create) names the wire shape.)
- **The wizard** sends the place the person picked (its root tile included), a `/new?folder=` /
  `?team=` context, or the default it pre-selected, each as an explicit placement. The root it shows
  only because nothing else resolved is no choice, and neither is a create made without the picker
  ever being shown (Quick Start, "Start blank" from the template step, a bypass link without
  context): they send no placement ([The New Document wizard](#the-new-document-wizard)).
- A re-commit of an id the person already owns keeps its stored place; defaults are not consulted.

## What a default may point at

- **A personal folder of the person**, or **a team folder of a team the person has joined**. Team
  membership is checked against the verified account id (a Clerk session or an API token) only,
  never the guest `X-Owner-Id`, as for [Placement on create](folders.md#placement-on-create).
- Not a space's root: the root of My documents is where a document lands with no default, and a
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
any surface that sets or clears one, so a change made in a menu shows at once in the markers, the
wizard and Settings.

### Entry names

Each key has a label, the plural a sentence uses, and an icon, in list order:

| Key                      | Label                 | In a sentence         | Icon                       |
| ------------------------ | --------------------- | --------------------- | -------------------------- |
| `mode:diagram`           | Diagrams              | diagrams              | The Diagram mode's icon    |
| `mode:draw`              | Whiteboards           | whiteboards           | The Draw mode's icon       |
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
- **My documents** carries the same submenu on its own menu (the sidebar's My documents row, and
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
- A dangling default marks nothing; the My documents row shows no marker.

### The New Document wizard

The Location step ([Save locations](../006-document/save-locations.md)) shows where the new
document will go and why.

- **It pre-selects the resolved default.** The wizard resolves the precedence itself, for the
  intent of the template picked on the first step, over the reader's defaults and the folders it
  has loaded; a default whose folder it cannot see (deleted, or in a team not listed) is skipped, as
  the server skips it.
- **It shows the pre-selection.** The folder browser opens at the level that lists the selected
  folder, that folder's card checked ("Workshops" inside "My documents › Projects"), never on a
  space card that only holds it ([Save locations](../006-document/save-locations.md), "It opens
  where its selection is"). A `/new?folder=` context opens the same way.
- **At the My documents root the default wins; inside a real folder or team, that folder wins.**
  A `/new?folder=` or `?team=` context is pre-selected as it always was; with no context, the
  resolved default is.
- **It says why.** While the pre-selected default is the selection, a line under the folder browser
  reads "**Whiteboards** go to **Workshops** by default", the entry's label and the folder's name,
  with a **Change default** button that opens the [default folder picker](#the-default-folder-picker)
  for that key. A new default chosen there is pre-selected at once.
  - The line and the Always save switch below never show together, so they share one slot
    under the browser, kept whenever the folder step shows: neither moves the browser as it appears.
- **Changing template re-resolves** the pre-selection, unless the reader has picked a place
  themselves: their pick stands.
- **What is sent:**
  - a place the reader picked, the root tile ("My documents") included, is explicit, so choosing
    the root on purpose sends `folderId: null`, the explicit root;
  - a `/new` context is explicit;
  - a pre-selected default is sent as that folder, explicitly;
  - the root shown only because nothing else resolved is **no choice**: the create carries no
    placement and the server's precedence decides, so a default the wizard could not yet see is
    still honoured.
- **Always save <these> here.** A switch row (`SwitchRow`, the house iOS-style switch) under the folder browser, worded for the intent's most
  specific key ("Always save whiteboards here", "Always save Event Storming boards here"), offers
  to make the selection that key's default.
  - It shows only when the selection could be a default (a personal folder, a team folder, or the
    My documents root) and is not already where those documents go.
  - It starts off each time it appears.
  - On, Create sets the key's default to the selected folder (or clears it, at the My documents
    root) before creating. A failed write is logged and never stops the create.
- None of this applies to **Local Browser**: an offline document has no folder step
  ([Non-goals](#non-goals)).

### Skipping the Location step

A reader who always files new documents in one place can tell the wizard so once, and stop being
asked. It is a [user preference](../007-editor/user-preferences.md) (`skipLocationStep`), off by
default, synced like the others; it is about the wizard, not a default folder, so it never touches
the defaults above.

- **What it holds:** the whole Location-step selection at the moment it was set: the save location
  (livediagram or Local Browser, [Save locations](../006-document/save-locations.md)), the place
  (`unsorted`, a personal folder, a team's root or a team folder; always `unsorted` for Local
  Browser), and the place's name as shown then, for the lines below. Off is `null`, written
  explicitly so a cleared value wins the merge over another device's cache.
- **The switch.** At the bottom of the Location step, below everything else, a switch row (`SwitchRow`) reads
  "Always save new documents in **<place>** and skip this step". `<place>` is the current selection
  as the reader sees it: a folder's name, **My documents**, a team's name, a team folder with its
  team ("Workshops · Design team"), or **Local Browser** when that save location is chosen. It
  follows the selection while on.
  - It starts off each time the Location step shows.
  - It sits in its own row under the per-key [Always save](#the-new-document-wizard) slot, so the
    two can both show and neither moves the other.
  - On, Create saves the preference (telemetry first), then creates as usual; a double-click
    commit on a destination card saves that destination.
- **While it is on, the wizard has one step.** On `/new` the step rail is not shown, the template
  step's primary button reads **Create**, and choosing a template card (a click or a double-click
  that would have moved to Location) creates at once, in the saved place, with the template's
  default name. **Skip** saves its blank document there too.
- **It says where.** A quiet line above the footer reads "Saving in **<place>**" with a **Change**
  button. Change opens the Location step, pre-selected on the saved place, for this one document:
  the preference stays on, and the wizard is the normal two-step wizard for the rest of the visit.
- **The saved place is explicit.** It is sent as a chosen place (the My documents root as the
  explicit root), so it wins over the reader's default folders, as a pick on the Location step
  would.
- **A context still wins.** A `/new?folder=` or `?team=` link files the document there, in
  livediagram, and still skips the step; the line names the context folder.
- **A place that has gone falls back.** When the folders and teams have loaded and the saved folder
  or team is not among them (deleted, or a team the reader has left), the visit shows the normal
  Location step, so the reader picks again; the preference is kept. Until they load, the saved
  place stands, and a create the server refuses takes the existing "choose another place" path.
- It never applies to the in-editor **Quick Start**, which has no Location step.

### Settings

- Settings holds a **Documents** category whose section **Where New Documents Go** has one row per
  entry, in list order, for guests and accounts alike.
- Its first row is **Skip the Location Step** ([Skipping the Location step](#skipping-the-location-step)).
  On, it reads "New documents are saved in **<place>**" with a **Turn Off** button, which clears
  the preference and restores the two-step wizard. Off, it reads "Off: the New Document wizard asks
  where each document goes.", with no button: it is turned on from the wizard, where the place is
  chosen.
- A row names the entry, in the title case of every Settings label ("Whiteboards", "Kanban
  Boards"), and beneath it where those documents go: the folder's name (a team folder adds its
  team: "Workshops · Design team"), or **My documents** when there is no default. Until the
  defaults and the folders have loaded it reads "Loading…"; if either cannot be read, "Couldn't
  load your default folders", with no buttons, never a guess.
- **Change** opens the [default folder picker](#the-default-folder-picker). **Clear** clears the
  default; it is shown only while there is one.
- **A dangling default** reads "<folder> (deleted), using <place>", or "<folder> (no longer
  available), using <place>" for a team folder whose team is not among the reader's, where <place>
  is where those documents go instead: the next working default of the
  [precedence](#precedence) for that entry, else My documents. A Clear is offered.
  - The folder's name comes from this browser's memory of the names of the reader's default
    folders, kept while they were visible. When the browser never saw it, the row reads "A deleted
    folder, using <place>".

### The default folder picker

A dialog around the shared placement browser ([Folders](folders.md)), titled "Default folder for
new <these>", opened by Settings' Change and the wizard's Change default.

- It opens with the key's current default selected, else the My documents root.
- Choosing the **My documents root** clears the default. A team's root cannot be chosen: with it
  selected, the dialog says "Choose a folder inside the team" and its button is unavailable.
- Its button reads **Use this folder** (or **Use My documents** at the root), and is unavailable
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
  `DefaultModePlan` / `DefaultKindEventStorming` /
  `DefaultTemplateRetrospective` / `DefaultTemplateKanban`, fired by the surface that sets a
  default, before the write.
- `Folder` · `Cleared` · the same values, fired by the surface that clears one, before the write.
- The value is closed: one per key, derived from it (`placementDefaultTelemetryType`), never a
  folder name or id.
- `UI` · `Toggled` · `SkipLocationStepOn` when Create saves the skip preference from the wizard,
  and `SkipLocationStepOff` when Settings' Turn Off clears it, each before the write.

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
  `set key=<key> surface=<menu|wizard|settings>`, `cleared key=<key> surface=<…>`,
  `write failed key=<key> code=<code>, rolled back`, and the wizard's
  `pre-selected key=<key>` and `default-skipped key=<key> reason=folder_unknown`.
- `[skip-location]` lines in the browser: `saved location=<livediagram|browser> scope=<root|personal|team>`,
  `cleared`, and `place-unavailable scope=<personal|team>, showing the Location step` for the
  fallback.

## Non-goals

- A default for a space's root, per device, or per template (templates route only through their
  family).
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
