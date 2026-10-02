# Default folders

Status: the server side is shipped (storage, the API, resolution on create, the intent every create
caller sends); the surfaces that set, show and clear a default come later.

## What

A **default folder** is where a person's new documents land when they create one without choosing
a place. A person keeps one default per **default key**, and the key is chosen by what the new
document is: a diagram can land in "Diagrams" while a whiteboard lands in "Sketches". Defaults
belong to the person, not to a folder or a team: two teammates may send the same kind of document
to different places.

## Domain language

| Term                 | Means                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| **default folder**   | The folder a person's new documents of one key land in when no place is chosen.                     |
| **default key**      | What a default is for: `<dimension>:<value>`, e.g. `mode:draw` (`PlacementDefaultKey`).             |
| **creation intent**  | What a new document is, captured once when it is created: its first tab's editor mode and tab kind. |
| **dangling default** | A default whose folder is gone, no longer the person's to see, or in a team the person has left.    |

"Default" on its own is ambiguous here (default theme, default text size, the Default template); in
specs and code say **default folder** or **placement default**.

## Default keys

- A key is `<dimension>:<value>`. The dimensions, most specific first, are `kind` (the tab kind)
  and `mode` (the editor mode the first tab opens in).
- The keys in force are a **closed list** (`PLACEMENT_DEFAULT_KEYS`): `mode:diagram` and
  `mode:draw`. A key outside the list is refused when set and ignored when read.
- `kind:event-storming` is reserved and not in force. Every create already carries its kind, so
  bringing that key into force is adding it to the list and nothing else.
- A general tab (`kind: 'diagram'`) has no kind key: a kind key exists only for a specific tab
  kind, so a general document is routed by its mode.

## Creation intent

- **Captured once, at creation, from the first tab**, and never inferred later: content drawn
  afterwards does not move a document, and the intent is not stored on the document.
  - `mode`: the editor mode the first tab opens in. `draw` for a tab that opens in Draw mode,
    including a stored legacy `kind: 'whiteboard'` tab ([Draw mode](../023-whiteboard/whiteboard.md));
    `diagram` otherwise, including a document with no tab.
  - `kind`: `event-storming` for an [event-storming board](../021-event-storming/event-storming.md),
    `diagram` (the general tab) otherwise. An event-storming board opens in `diagram`.
- **Sent on the create** as `intent: { mode, kind }` beside the placement
  ([Placement on create](folders.md#placement-on-create)).
- **Who sends it:** every create that makes something new. The New Document wizard and its
  bypasses (Quick Start, `/new?blank=1`, `/new?template=`), imports into the account (board and
  draw.io imports, Google Drive **Import a copy**) and the MCP `create_document` tool, which sends
  the intent of the first tab it built (`mode:diagram` unless its input makes a whiteboard).
- **Who does not:** a create that keeps a place the document already has. Duplicate keeps the
  source's place, an Offline Mode sync keeps the folder it had in the browser, a Google Drive copy
  of a mirrored file follows the mirror, a Drive restore puts back what it restores. A create
  without an intent never consults defaults.
- An intent that is present but malformed refuses the create, `intent_invalid` (400), before
  anything is written.

## Precedence

A create's place is decided in this order; the first that answers wins:

1. **Explicit placement**: a folder, or a team (its root included), the person is inside or picked.
2. **Kind default**: the default for `kind:<kind>`, when that key is in force.
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
- A person holds at most one default per key in force, so their rows are bounded by the length of
  the key list.
- Writes ride the per-owner write rate limit (`WRITE_RATE_LIMITER`, [Rate limiting](../015-api/api.md#rate-limiting)).

## API

| Method | Path                           | Body           | Answer                              |
| ------ | ------------------------------ | -------------- | ----------------------------------- |
| GET    | `/api/placement-defaults`      |                | `{ defaults: [{ key, folderId }] }` |
| PUT    | `/api/placement-defaults/:key` | `{ folderId }` | 204, the default set                |
| DELETE | `/api/placement-defaults/:key` |                | 204, the default cleared            |

- Owner-scoped: the Clerk user, an API token's owner, or a guest's `X-Owner-Id`.
- `GET` answers every stored default whose key is in force, dangling ones included: a surface
  shows a dangling default as such.
- `DELETE` of a key with no default is a 204 as well.

| Rejection                | Status | When                                                                  |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| `default_key_invalid`    | 400    | `:key` is not a key in force                                          |
| `default_folder_invalid` | 400    | The body is not an object whose `folderId` is a non-empty string      |
| `folder_not_found`       | 404    | The folder is missing, someone else's, or in a team not joined        |
| `rate_limited`           | 429    | The per-owner write rate limit is spent                               |
| `intent_invalid`         | 400    | (on `POST /api/documents`) `intent` is present but not a valid intent |

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Folder` · `Changed` · `DefaultModeDiagram` / `DefaultModeDraw`, fired by the surface that sets
  a default, before the write.
- `Folder` · `Cleared` · the same types, fired by the surface that clears one, before the write.
- The type is closed: one per key in force (`PLACEMENT_DEFAULT_TELEMETRY_TYPES`), never a folder
  name or id.

## Observability

- `placement: resolved scope=<personal|team> folder=set via=default key=<key>` when a default
  decides a create.
- `placement: default-skipped key=<key> reason=<folder_missing|folder_not_visible|team_not_joined>`
  for every dangling default passed over.
- `placement-defaults: set key=<key> scope=<personal|team>`,
  `placement-defaults: cleared key=<key>` and `placement-defaults: rejected reason=<code>` on the
  routes.

## Non-goals

- A default for a space's root, per device, or per template.
- Defaults for Offline Mode documents: a document made in the browser is filed where it is made.
- Moving existing documents when a default changes.

## References

[Folders](folders.md), [Team shared documents](team-shared-documents.md),
[Dedicated route for new-document creation](../007-editor/new-document-route.md),
[MCP server](../015-api/mcp-server.md), [Auth + guest access](../014-identity/auth-and-guest-access.md).
