# Default folders

Status: the server side is shipped (storage, the API, resolution on create, the intent every create
caller sends, the intent recorded on the document); the surfaces that set, show and clear a default
come later.

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
    including a stored legacy `kind: 'whiteboard'` tab ([Draw mode](../023-whiteboard/whiteboard.md));
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
- They feed the Explorer's filters, one chip per dimension: **Opens
  in** (`opensIn`, one option per editor mode), **Kind** (`tabKind`: Event Storming boards) and **Template**
  (`templateFamily`: Retrospectives, Kanban boards). A document with an unknown value matches no option of a chip;
  it shows whenever that chip is not set. Copy says "opens in" for a mode and never "type"
  (see the domain language spec in 003-system-architecture).

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
5. **The root of My documents** (Personal Space's Unsorted).

- **An absent placement is no choice.** A create whose body names no `folderId` (the key absent) and
  no team, and that carries an intent, consults the defaults.
- **An explicit root is a choice.** `folderId: null`, present in the body, is the root of the chosen
  space, chosen on purpose; with no team it is the explicit root of My documents, and it always wins
  over a default. ([Placement on create](folders.md#placement-on-create) names the wire shape.)
- **The wizard** sends the placement the person saw or picked: the Settings step's picker (its
  root tile, "Here", included) or a `/new?folder=` / `?team=` context is explicit. A create made
  without the picker ever being shown (Quick Start, "Start blank" from the template step, a bypass
  link without context) sends no placement. Once the wizard pre-selects the resolved default
  client-side, it sends that as an explicit placement.
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

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Folder` · `Changed` · `DefaultModeDiagram` / `DefaultModeDraw` / `DefaultKindEventStorming` /
  `DefaultTemplateRetrospective` / `DefaultTemplateKanban`, fired by the surface that sets a
  default, before the write.
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

## Non-goals

- A default for a space's root, per device, or per template (templates route only through their
  family).
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
