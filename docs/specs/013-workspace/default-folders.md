# Default folders

Status: the server side is shipped (storage, the API, resolution on create, the intent every create
caller sends); the surfaces that set, show and clear a default come later.

## What

A **default folder** is where a person's new documents land when they create one without choosing
a place. A person keeps one default per **default key**, and the key is chosen by what the new
document opens as: a document that opens in Diagram mode can land in "Diagrams", one that opens in
Draw mode in "Sketches", and a retrospective in "Retros". Defaults belong to the person, not to a
folder or a team: two teammates may send the same new documents to different places.

## Domain language

| Term                 | Means                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **default folder**   | The folder a person's new documents of one key land in when no place is chosen.                                           |
| **default key**      | What a default is for: `<dimension>:<value>`, e.g. `mode:draw` (`PlacementDefaultKey`).                                   |
| **creation intent**  | How a new document opens, captured once when it is created: the editor mode it opens in and, for a board, its board type. |
| **opens in**         | The editor mode a document's first tab opens in (`EditorMode`). Never a type of document or tab.                          |
| **board type**       | The kind of board a new document is, when it is one: `event-storming`, `retrospective` or `kanban` (`BoardType`).         |
| **dangling default** | A default whose folder is gone, no longer the person's to see, or in a team the person has left.                          |

"Default" on its own is ambiguous here (default theme, default text size, the Default template); in
specs and code say **default folder** or **placement default**.

## Default keys

The list a person sets defaults from is titled **New documents that open as**, and holds, in this
order:

| Entry                 | Key                    |
| --------------------- | ---------------------- |
| Diagrams              | `mode:diagram`         |
| Whiteboards           | `mode:draw`            |
| Event Storming boards | `board:event-storming` |
| Retrospectives        | `board:retrospective`  |
| Kanban boards         | `board:kanban`         |

- A key is `<dimension>:<value>`. The dimensions, most specific first, are `board` (the board
  type) and `mode` (the editor mode the first tab opens in).
- The keys are a **closed list** (`PLACEMENT_DEFAULT_KEYS`). A key outside it is refused when set
  and ignored when read.
- The mode keys are **generated from the editor modes** (`EDITOR_MODES` in `@livediagram/document`):
  one `mode:<mode>` key per mode, in the modes' order. A new editor mode gains its default key, and
  its entry in the list, with no other change.
- The board types are a **closed list** (`BOARD_TYPES`): `event-storming`, `retrospective`,
  `kanban`. Every other document has no board type and is routed by its mode alone.

## Creation intent

- **Captured once, at creation**, and never re-derived: content drawn afterwards does not move a
  document. The intent is recorded on the document ([Recorded intent](#recorded-intent)).
  - `mode`: the editor mode the first tab opens in. `draw` for a tab that opens in Draw mode,
    including a stored legacy `kind: 'whiteboard'` tab ([Draw mode](../023-whiteboard/whiteboard.md));
    `diagram` otherwise, including a document with no tab and an event-storming board.
  - `boardType`, when the document is a board:
    - `event-storming` when the first tab is an
      [event-storming board](../021-event-storming/event-storming.md) (its kind is
      `event-storming`), or the document is made from the Event storming template;
    - `retrospective` or `kanban` by the **template** the document is made from. One exhaustive
      map from every template to its board type, or none, decides it
      (`boardTypeOfTemplate` in `@livediagram/templates`): every retrospective format is a
      retrospective, the Kanban template a Kanban board, every other template no board. A new
      template is not complete until it is mapped.
    - absent otherwise: an import, a blank document, any other template.
- **Sent on the create** as `intent: { mode, boardType? }` beside the placement
  ([Placement on create](folders.md#placement-on-create)).
- **Who sends it:** every create that makes something new. The New Document wizard and its
  bypasses (Quick Start, `/new?blank=1`, `/new?template=`), imports into the account (board and
  draw.io imports, Google Drive **Import a copy**) and the MCP `create_document` tool, which sends
  the intent of the first tab it built and the template it used (`mode:diagram` unless its input
  makes a whiteboard or a board).
- **Who does not:** a create that keeps a place the document already has. Duplicate keeps the
  source's place, an Offline Mode sync keeps the folder it had in the browser, a Google Drive copy
  of a mirrored file follows the mirror, a Drive restore puts back what it restores. A create
  without an intent never consults defaults.
- An intent that is present but malformed (no known `mode`, or a `boardType` outside the list)
  refuses the create, `intent_invalid` (400), before anything is written.

## Recorded intent

The creation intent is also **written on the document**, by the same insert that creates it, and
never re-derived or rewritten afterwards:

| Column       | Summary field | Holds                                          |
| ------------ | ------------- | ---------------------------------------------- |
| `opens_in`   | `opensIn`     | The editor mode the document opens in, or null |
| `board_type` | `boardType`   | Its board type, or null                        |

- **Null `opensIn` means unknown**, never Diagram: the document was made before intents were
  recorded, or by a create that carries none (Duplicate, an Offline Mode sync, a Drive mirror copy,
  an API script). Its `boardType` is then unknown too.
- **A known `opensIn` with a null `boardType` means not a board.** Only a recorded intent can say
  that; an unknown one says nothing.
- A copy made by `POST /api/documents/:id/copy` carries the source's recorded values; they are a
  fact about the content, not derived again.
- A stored value outside the editor modes or the board types (one since retired) reads as null.
- They feed the Explorer's filters: an **Opens in** chip (one option per editor mode) and a
  **Board** chip (one option per board type). A document with an unknown value matches no option of
  that chip; it shows whenever the chip is not set. Copy says "opens in", never "type", for a mode.

## Precedence

A create's place is decided in this order; the first that answers wins:

1. **Explicit placement**: a folder, or a team (its root included), the person is inside or picked.
2. **Board default**: the default for `board:<boardType>`, when the document is a board.
3. **Mode default**: the default for `mode:<mode>`.
4. **The root of My documents** (Personal Space's Unsorted).

- **The root of My documents is not explicit.** A create with no `teamId` and no `folderId` (absent
  or null) that carries an intent consults the defaults. A caller that means the root itself, and
  not the default, sends no intent.
- The **wizard** resolves the default itself, from the same key order, pre-selects it in its
  placement picker and sends it as an explicit placement. Instant-create paths send no placement
  and the intent, and the **server** resolves the default.
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

- `Folder` · `Changed` · `DefaultModeDiagram` / `DefaultModeDraw` / `DefaultBoardEventStorming` /
  `DefaultBoardRetrospective` / `DefaultBoardKanban`, fired by the surface that sets a default,
  before the write.
- `Folder` · `Cleared` · the same types, fired by the surface that clears one, before the write.
- The type is closed: one value per key, derived from it (`placementDefaultTelemetryType`), never a folder name
  or id.

## Observability

- `placement: resolved scope=<personal|team> folder=set via=default key=<key>` when a default
  decides a create.
- `placement: default-skipped key=<key> reason=<folder_missing|folder_not_visible|team_not_joined>`
  for every dangling default passed over.
- `placement-defaults: set key=<key> scope=<personal|team>`,
  `placement-defaults: cleared key=<key>` and `placement-defaults: rejected reason=<code>` on the
  routes.

## Non-goals

- A default for a space's root, per device, or per template (templates route only through their
  board type).
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
