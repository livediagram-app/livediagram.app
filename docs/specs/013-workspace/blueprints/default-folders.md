# Default folders: blueprint

Derived from [Default folders](../default-folders.md), with the resolver of
[Folders → Placement on create](../folders.md#placement-on-create) and its blueprint
[document-placement.md](document-placement.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited
as `Dn`.

Scope, by file:

| File                                                      | Role                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/api-schema/src/placement-defaults.ts`           | Keys, board types, intent, `creationIntentOf`, `readCreationIntent`, telemetry types     |
| `packages/document/src/editor-mode.ts`                    | `EDITOR_MODES` (`as const`), `EditorMode`, `DEFAULT_EDITOR_MODE`, `isEditorMode` (`D27`) |
| `apps/api/migrations/0062_document_creation_intent.sql`   | `documents.opens_in`, `documents.board_type`                                             |
| `apps/api/src/document-intent-row.ts`                     | `readOpensIn`, `readBoardType`: stored text to the enums, else null                      |
| `apps/api/src/db/documents.ts`                            | The create insert writes both; summaries read them; the copy carries them                |
| `packages/templates/src/template-board-types.ts`          | `boardTypeOfTemplate`: the one exhaustive template to board type map                     |
| `apps/api/migrations/0061_placement_defaults.sql`         | The `placement_defaults` table (`D17`)                                                   |
| `apps/api/src/db/placement-defaults.ts`                   | `listPlacementDefaults`, `setPlacementDefault`, `clearPlacementDefault`                  |
| `apps/api/src/db/account.ts`                              | Account deletion and owner migration statements                                          |
| `apps/api/src/placement/placement-types.ts`               | `PlacementCaller`, `PlacementFolder`, `PlacementLookups`, `PlacementOutcome`, steps      |
| `apps/api/src/placement/default-folder.ts`                | `judgeDefaultFolder`, `joinedFolderTeam`, the `defaultFolder` step                       |
| `apps/api/src/placement/resolve-placement.ts`             | `FOLDER_STEPS = [explicitFolder, defaultFolder]`; `resolvePlacement(…, intent)`          |
| `apps/api/src/placement/placement-lookups.ts`             | `getPlacementDefaults(ownerId)` beside the membership and folder reads                   |
| `apps/api/src/placement/placement-log.ts`                 | The `placement:` and `placement-defaults:` fingerprints                                  |
| `apps/api/src/placement/placement-response.ts`            | `intentRejected()`                                                                       |
| `apps/api/src/routes/placement-defaults.ts`               | `GET` / `PUT` / `DELETE /api/placement-defaults[/:key]`                                  |
| `apps/api/src/routes/documents.ts`                        | `POST /api/documents` reads `intent`, passes it to the resolver                          |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`             | Dispatch case; owner-scoped segment                                                      |
| `packages/api-schema/src/error-telemetry.ts`              | `placement-defaults` in `API_ROUTE_RESOURCES`                                            |
| `apps/api/src/openapi/manifest.ts`                        | The three routes; the create body's `intent`                                             |
| `apps/live/lib/api/placement-defaults.ts`                 | `apiListPlacementDefaults`, `apiSetPlacementDefault`, `apiClearPlacementDefault`         |
| `apps/live/lib/api/documents.ts`                          | `apiCreateDocument` sends `intent`                                                       |
| `apps/live/app/new/page.tsx`                              | The wizard and its bypasses send the first tab's intent and the template's board type    |
| `apps/live/lib/board-scene-import.ts`                     | Every imported document sends its first tab's intent                                     |
| `apps/live/lib/drive/livediagram-port.ts`                 | `importDocumentCopy` sends an intent only with no target (Import a copy)                 |
| `apps/mcp/src/tools.ts`, `apps/mcp/src/created-folder.ts` | `create_document` sends the intent; reports the folder it landed in                      |

## Domain and naming

| Term             | Identifier                                                                                 | Meaning                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Default folder   | `PlacementDefault` `{ key, folderId }`, row of `placement_defaults`                        | One person's folder for one key                             |
| Default key      | `PlacementDefaultKey`, `PLACEMENT_DEFAULT_KEYS`, column `default_key`                      | `<dimension>:<value>`, closed list of five                  |
| Dimension        | `DEFAULT_KEY_DIMENSIONS = ['board', 'mode']`                                               | Most specific first; the precedence between keys            |
| Creation intent  | `CreationIntent` `{ mode: EditorMode, boardType?: BoardType }`                             | How a new document opens; body field `intent`               |
| Opens in         | `EditorMode`, `EDITOR_MODES` (`@livediagram/document`); column `opens_in`, field `opensIn` | The editor mode the first tab opens in; never a "type"      |
| Recorded intent  | columns `opens_in`, `board_type`; `DocumentSummary.opensIn` / `.boardType`                 | The intent the create insert wrote; null = unknown          |
| Board type       | `BoardType`, `BOARD_TYPES = ['event-storming', 'retrospective', 'kanban']`                 | The kind of board a new document is, when it is one         |
| Dangling default | `DefaultSkipReason`                                                                        | `folder_missing` / `folder_not_visible` / `team_not_joined` |
| Via              | `via: 'default'`, log `via=default key=<key>`                                              | The default step decided                                    |

Banned: "fallback" for a skipped default (it falls through to the next level), "preference" for a
default folder (the preferences blob is a different store), "kind" for a board type (a tab kind is one
input to it, the template another), "whiteboard" as a board type (a whiteboard is `mode: 'draw'`).

## Behaviour and state

`creationIntentOf(tab, templateBoardType = null)` over `{ kind?: string; opensIn?: string } | undefined`:

1. `mode`: `draw` when `kind === 'whiteboard'` (legacy) or `opensIn === 'draw'`, else `diagram` (no tab,
   and an event-storming tab, included).
2. `boardType`: `event-storming` when `kind === 'event-storming'`, else `templateBoardType`; the field is
   left out when that is null.

Callers pass `templateBoardType = boardTypeOfTemplate(templateKind)` where a template made the document
(the wizard and its bypasses, MCP template tabs) and nothing otherwise (imports, Drive copies, MCP
element or graph tabs). The intent is computed once, at the create call, and never re-derived.

`boardTypeOfTemplate` reads a `Record<TemplateKind, BoardType | null>`, so a new template kind that is
not mapped fails the typecheck. Its non-null rows:

| Template kind         | Board type       |
| --------------------- | ---------------- |
| `retrospective`       | `retrospective`  |
| `start-stop-continue` | `retrospective`  |
| `mad-sad-glad`        | `retrospective`  |
| `four-ls`             | `retrospective`  |
| `sailboat`            | `retrospective`  |
| `kanban`              | `kanban`         |
| `event-storming`      | `event-storming` |

Every other template kind maps to null, `incident-postmortem` and `lean-coffee` included (`D26`).

`PLACEMENT_DEFAULT_KEYS` is one `mode:<mode>` key per `EDITOR_MODES` entry, then one
`board:<type>` key per `BOARD_TYPES` entry, both generated: a new editor mode adds its key, its
telemetry type and its place in the list with no other code change.

`defaultKeysFor(intent)` maps each dimension of `DEFAULT_KEY_DIMENSIONS`, in order, to
`<dimension>:<value>` when the intent has that value, keeping only listed keys: `['board:<type>',
'mode:<mode>']` for a board, `['mode:<mode>']` otherwise.

`resolvePlacement(requested, caller, lookups, intent)`, steps in order, first non-null wins:

1. Team judgement, unchanged ([document-placement.md](document-placement.md)).
2. `explicitFolder`, unchanged.
3. `defaultFolder`: null unless `intent !== null && requested.teamId === null && requested.folderId
=== null`. Else reads `lookups.getPlacementDefaults(caller.ownerId)` once, then for each key of
   `defaultKeysFor(intent)` with a stored folder: reads the folder (`null` → skip `folder_missing`); for
   a team folder with a verified id, reads membership; `judgeDefaultFolder(folder, caller, joined)`:
   - `folder === null` → `folder_missing`;
   - personal folder: `folder.ownerId === caller.ownerId` → ok, else `folder_not_visible`;
   - team folder: `joined` (false without a verified id) → ok, else `team_not_joined`.
     A skip is appended to the outcome's `skipped` list and the next key is tried. The first ok answers
     `{ teamId: folder.teamId, folderId }`, `via: 'default'`, `key`.
4. `spaceRoot`.

Every success outcome carries `skipped: DefaultSkip[]` (empty unless step 3 skipped); the route logs each.
Invariants: a skip never rejects; a default never answers for a request naming a team or a folder;
`intent === null` never reads `placement_defaults`; a board default is tried before the mode default.

Route order in `POST /api/documents`: body id/name → dates → `parsePlacement` → **`readCreationIntent`**
(`intent_invalid`) → tabs → clash → … → resolve (genuine create only) → insert. A re-commit logs
`placement: skipped reason=existing` and never reads defaults.

## Recorded intent

- Migration 0062: `ALTER TABLE documents ADD COLUMN opens_in TEXT` and `ADD COLUMN board_type TEXT`,
  both nullable, no default, no backfill: every existing row reads null (unknown).
- `upsertDocumentMeta` takes `opensIn` / `boardType` and writes them in the INSERT only; the
  `ON CONFLICT` update never sets them, so a re-commit or rename leaves them as created.
- `POST /api/documents` passes `intent.mode` / `intent.boardType ?? null` when an intent is present,
  else null and null.
- `copyDocument` inserts `opens_in` / `board_type` read from the source row in the same statement
  (`INSERT … SELECT`), never recomputed.
- `DOCUMENT_SUMMARY_COLS` gains both columns; `rowToSummary` maps them through `readOpensIn` /
  `readBoardType` (`D28`), so `DocumentSummary` always carries `opensIn: EditorMode | null` and
  `boardType: BoardType | null`. An Offline Mode summary carries null and null.
- `LiveDoc` is unchanged: the editor reads the opening mode from the tab.

## Interfaces and contracts

- **Create body:** `intent?: { mode: 'diagram' | 'draw'; boardType?: 'event-storming' | 'retrospective' |
'kanban' }`. `readCreationIntent(value)`: `undefined` or `null` → `{ ok: true, intent: null }`; an object
  whose `mode` is a member and whose `boardType` is absent, null or a member → `{ ok: true, intent }` (a
  null `boardType` dropped, other fields ignored, `D22`); anything else → `{ ok: false }` → 400
  `{ error: 'intent_invalid' }`, nothing written.
- **`GET /api/placement-defaults`** → 200 `{ defaults: PlacementDefault[] }`, in
  `PLACEMENT_DEFAULT_KEYS` order (`D20`); a stored row whose key is not listed is left out.
- **`PUT /api/placement-defaults/:key`**, body `{ folderId: string }` → 204 (`D19`). `:key` is
  `decodeURIComponent`d, so `mode:draw` and `mode%3Adraw` both name it (`D18`); an undecodable segment
  is `default_key_invalid`. Order: key → body (`default_folder_invalid` for a non-object, a missing,
  non-string or empty `folderId`, `D25`) → folder visibility (`judgeDefaultFolder`, any skip reason →
  404 `folder_not_found`) → upsert (a repeat replaces the folder, `D21`).
- **`DELETE /api/placement-defaults/:key`** → 204 whether or not a row existed;
  `default_key_invalid` first.
- Other methods or deeper paths → 404 `not_found`. No resolved owner → the shared `missingAuth()`.
- **Live client:** `apiListPlacementDefaults(owner): Promise<PlacementDefault[]>`,
  `apiSetPlacementDefault(owner, key, folderId)`, `apiClearPlacementDefault(owner, key)`, each throwing
  `ApiError` with the token as `code`; `apiCreateDocument(owner, { …, intent? })` puts `intent` in the
  body only when set.
- **MCP:** `create_document` body gains `intent: creationIntentOf(tabs[0], boardTypeOfTemplate(<the
first input tab's template kind, or null>))`; output `folder` is `"Generated"` when the created
  `document.folderId` is null, else the folder's name (`D24`).

## Data and persistence

```sql
CREATE TABLE placement_defaults (
  owner_id    TEXT NOT NULL,
  default_key TEXT NOT NULL,
  folder_id   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (owner_id, default_key)
);
```

- No foreign key and no `ON DELETE`: a dangling default is kept for a restore. No extra index: the
  primary key's `owner_id` prefix serves the only read.
- Field classes: `owner_id` owner-keyed (guest or account id); `default_key` closed enum, validated
  on write; `folder_id` a reference, checked on write and on every use; `updated_at` ms, written
  on every upsert, not read today.
- Upsert: `INSERT … ON CONFLICT (owner_id, default_key) DO UPDATE SET folder_id = excluded.folder_id,
updated_at = excluded.updated_at`.
- Account deletion: `DELETE FROM placement_defaults WHERE owner_id = ?`.
- Owner migration: `INSERT OR IGNORE … SELECT ?, default_key, folder_id, updated_at … WHERE
owner_id = ?` then `DELETE … WHERE owner_id = <guest>`: the account's row for a key wins.
- Snapshot and restore: rows are not part of a Drive mirror; a restored folder with the same id
  revives a default by being found again.

## Errors and edge cases

| Case                                                          | Handling                                                |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Default's folder deleted                                      | Skipped `folder_missing`, next level; row kept          |
| Default's personal folder not the caller's                    | Skipped `folder_not_visible`                            |
| Default's team left, or caller now on the guest path          | Skipped `team_not_joined`                               |
| Board default dangles, mode default set                       | Board skipped, the mode default answers                 |
| Board with no board default                                   | The mode default answers                                |
| Create with intent and a folder or a team                     | Explicit wins; defaults not read                        |
| Create without intent at the root                             | Root, `via=root`; defaults not read                     |
| `intent` a string, no `mode`, unknown `boardType`             | 400 `intent_invalid`, nothing written                   |
| Re-commit of an owned id with an intent                       | Stored place kept, `placement: skipped reason=existing` |
| PUT unknown key, e.g. `board:mindmap`                         | 400 `default_key_invalid`                               |
| PUT `{}` / `{ folderId: 3 }` / `{ folderId: "" }`             | 400 `default_folder_invalid`                            |
| PUT someone else's folder, unjoined team, guest → team folder | 404 `folder_not_found`                                  |
| DELETE a key with no row                                      | 204                                                     |
| Stored row with a key not in the list                         | Left out of GET; never a candidate                      |
| Malformed JSON body on PUT                                    | 400 `default_folder_invalid`                            |

## Security and trust

- Team membership on PUT and on use is read against `ctx.verifiedUserId` only; a guest `X-Owner-Id`
  never reaches it, so a guest default is personal-only.
- `folder_not_found` covers every invisible folder: setting a default leaks no other person's folder.
- Defaults are keyed on the resolved owner; `placement-defaults` is in `OWNER_SCOPED_SEGMENTS`, so a
  harvested guest id cannot read or write them once signatures are enforced.
- A read-only API token is refused on PUT and DELETE by the global gate (403 `read_only_token`).
- Writes ride `WRITE_RATE_LIMITER` (300 per 60 s per owner, or per token): 429 `rate_limited`.
- A default grants nothing: a create through it is judged exactly as an explicit placement would be.

## Performance and limits

- Rows per owner ≤ `PLACEMENT_DEFAULT_KEYS.length` (5).
- A create with an intent at the root adds one primary-key-prefix read, then per candidate key (at
  most two: board, mode) one folder read and at most one membership read: worst case 1 + 2 × 2 = 5
  point reads. A create without an intent, or with an explicit place, adds none.
- PUT: at most two point reads and one upsert. GET: one read of ≤ 5 rows.

## Observability

| Fingerprint                                                                                         | Where     |
| --------------------------------------------------------------------------------------------------- | --------- |
| `placement: resolved scope=<personal/team> folder=set via=default key=<key>`                        | api, info |
| `placement: default-skipped key=<key> reason=<reason>`                                              | api, info |
| `placement: rejected reason=intent_invalid scope=<personal/team>`                                   | api, warn |
| `placement-defaults: set key=<key> scope=<personal/team>`                                           | api, info |
| `placement-defaults: cleared key=<key>`                                                             | api, info |
| `placement-defaults: rejected reason=<default_key_invalid/default_folder_invalid/folder_not_found>` | api, warn |
| `[mcp] create_document folder lookup failed status=<n>`                                             | mcp, warn |

## Testing

| Rule                                                                             | Test                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Keys, intent derivation and parsing, key order, telemetry types                  | `packages/api-schema/src/placement-defaults.test.ts`                                             |
| Template to board type map                                                       | `apps/live/lib/template-board-types.test.ts`                                                     |
| Default step: gate, board before mode, skips, team and personal                  | `apps/api/src/placement/resolve-placement.test.ts`                                               |
| Routes: every answer and rejection, encoded keys, logs (real SQLite)             | `apps/api/src/routes/placement-defaults.test.ts`                                                 |
| Create lands in the default; precedence; dangling; intent_invalid                | `apps/api/src/routes/document-create-default-folder.test.ts`                                     |
| Recorded intent written once, read back, null for legacy rows, carried by a copy | `apps/api/src/routes/document-create-intent.test.ts`, `apps/api/src/document-intent-row.test.ts` |
| Store order, replace, clear; sign-up keeps the account's row                     | `apps/api/src/db/placement-defaults.test.ts`                                                     |
| Deletion and migration of every owner-keyed column                               | `apps/api/src/db/account-owner-columns.test.ts`                                                  |
| Dispatch, route labels, OpenAPI parity                                           | `apps/api/src/route-resources.test.ts`, `apps/api/src/openapi/*.test.ts`                         |
| Client functions and the create body                                             | `apps/live/lib/api/placement-defaults.test.ts`, `apps/live/lib/api-client.test.ts`               |
| Import and Drive copy send the intent                                            | `apps/live/lib/board-scene-import.test.ts`, `apps/live/lib/drive/livediagram-port.test.ts`       |
| MCP create sends the intent and names the folder                                 | `apps/mcp/src/tools.test.ts`                                                                     |

## Constants and configuration

| Constant                 | Value                                           | Provenance               | Safe range                   |
| ------------------------ | ----------------------------------------------- | ------------------------ | ---------------------------- |
| `PLACEMENT_DEFAULT_KEYS` | The five keys, list order                       | Spec "Default keys"      | Members of the key grammar   |
| `DEFAULT_KEY_DIMENSIONS` | `['board', 'mode']`                             | Spec "Precedence"        | Most specific first          |
| Mode keys                | `mode:<EditorMode>` per `EDITOR_MODES` entry    | Spec "Default keys"      | Grows with the editor modes  |
| `BOARD_TYPES`            | `['event-storming', 'retrospective', 'kanban']` | Spec "Default keys"      | Closed; a new one adds a key |
| Rate limit               | `WRITE_RATE_LIMITER`                            | `apps/api/wrangler.toml` | Shared with every write      |

No environment variable or binding is added.

## Telemetry

`placementDefaultTelemetryType(key)` derives one closed type per key, `Default` + each part in
PascalCase (`DefaultModeDiagram`, `DefaultModeDraw`, `DefaultBoardEventStorming`,
`DefaultBoardRetrospective`, `DefaultBoardKanban`), so a new editor mode gains its type with its key.
`PLACEMENT_DEFAULT_TELEMETRY_TYPES` is the same map, built from the keys. The surfaces that set and clear defaults fire `Folder·Changed·<type>` and
`Folder·Cleared·<type>` before the write; no surface exists yet, so no emitter and no dashboard card are
added here.

## Defaults ledger

D17 to D28 in [DEFAULTS.md](DEFAULTS.md).
