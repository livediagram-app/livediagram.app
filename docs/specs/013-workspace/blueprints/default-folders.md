# Default folders: blueprint

Derived from [Default folders](../default-folders.md), with the resolver of
[Folders → Placement on create](../folders.md#placement-on-create) and its blueprint
[document-placement.md](document-placement.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited
as `Dn`.

Scope, by file:

| File                                                      | Role                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/document/src/editor-mode.ts`                    | `EDITOR_MODES` (`as const`), `EditorMode`, `DEFAULT_EDITOR_MODE`, `isEditorMode` (`D27`) |
| `packages/api-schema/src/placement-defaults.ts`           | Dimensions, keys, intent, `creationIntentOf`, `readCreationIntent`, telemetry values     |
| `packages/templates/src/template-families.ts`             | `templateFamilyOf`: the one exhaustive template to template family map                   |
| `apps/api/migrations/0061_placement_defaults.sql`         | The `placement_defaults` table (`D17`)                                                   |
| `apps/api/migrations/0062_document_creation_intent.sql`   | `documents.opens_in`, `documents.tab_kind`, `documents.template_family`                  |
| `apps/api/src/document-intent-row.ts`                     | `readRecordedIntent`: stored text to the lists, else null                                |
| `apps/api/src/db/documents.ts`                            | The create insert writes the record; reads expose it; the copy carries it                |
| `apps/api/src/db/placement-defaults.ts`                   | `listPlacementDefaults`, `setPlacementDefault`, `clearPlacementDefault`                  |
| `apps/api/src/db/account.ts`                              | Account deletion and owner migration statements                                          |
| `apps/api/src/placement/placement-types.ts`               | `RequestedPlacement`, `PlacementCaller`, `PlacementLookups`, `PlacementOutcome`, steps   |
| `apps/api/src/placement/default-folder.ts`                | `judgeDefaultFolder`, `joinedFolderTeam`, the `defaultFolder` step                       |
| `apps/api/src/placement/resolve-placement.ts`             | `parsePlacement` (chosen or not); `FOLDER_STEPS = [explicitFolder, defaultFolder]`       |
| `apps/api/src/placement/placement-lookups.ts`             | `getPlacementDefaults(ownerId)` beside the membership and folder reads                   |
| `apps/api/src/placement/placement-log.ts`                 | The `placement:` and `placement-defaults:` fingerprints                                  |
| `apps/api/src/placement/placement-response.ts`            | `intentRejected()`                                                                       |
| `apps/api/src/routes/placement-defaults.ts`               | `GET` / `PUT` / `DELETE /api/placement-defaults[/:key]`                                  |
| `apps/api/src/routes/documents.ts`                        | `POST /api/documents` reads `intent`, resolves, records                                  |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`             | Dispatch case; owner-scoped segment                                                      |
| `packages/api-schema/src/error-telemetry.ts`              | `placement-defaults` in `API_ROUTE_RESOURCES`                                            |
| `apps/api/src/openapi/manifest.ts`                        | The three routes; the create body's `folderId` semantics and `intent`                    |
| `apps/live/lib/api/placement-defaults.ts`                 | `apiListPlacementDefaults`, `apiSetPlacementDefault`, `apiClearPlacementDefault`         |
| `apps/live/lib/api/documents.ts`                          | `apiCreateDocument` sends `folderId` when not `undefined` (null included) and `intent`   |
| `apps/live/components/palette/TemplatePicker.tsx`         | The wizard's placement counts only once seen or picked                                   |
| `apps/live/app/new/page.tsx`                              | The wizard and its bypasses send the first tab's intent and the template's family        |
| `apps/live/lib/duplicate-document.ts`                     | Duplicate: beside the source, the source's recorded intent, root on refusal              |
| `apps/live/lib/board-scene-import.ts`                     | Every imported document sends its first tab's intent                                     |
| `apps/live/lib/drive/livediagram-port.ts`                 | `importDocumentCopy`: no placement and an intent with no target; the mirror's place else |
| `apps/mcp/src/tools.ts`, `apps/mcp/src/created-folder.ts` | `create_document` sends the intent; reports the folder it landed in                      |

## Domain and naming

| Term             | Identifier                                                                                               | Meaning                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Default folder   | `PlacementDefault` `{ key, folderId }`, row of `placement_defaults`                                      | One person's folder for one key                             |
| Default key      | `PlacementDefaultKey`, `PLACEMENT_DEFAULT_KEYS`, column `default_key`                                    | `<dimension>:<value>`, closed list of five                  |
| Dimension        | `DEFAULT_KEY_DIMENSIONS = ['kind', 'template', 'mode']`                                                  | Most specific first; the precedence between keys            |
| Creation intent  | `CreationIntent` `{ mode: EditorMode, tabKind: CreationTabKind, templateFamily?: TemplateFamily }`       | What a new document is made as; body field `intent`         |
| Opens in         | `EditorMode`, `EDITOR_MODES`; column `opens_in`, field `opensIn`                                         | The editor mode the first tab opens in                      |
| Tab kind         | `CreationTabKind`, `CREATION_TAB_KINDS = ['diagram', 'event-storming']`; `tab_kind`, `tabKind`           | The first tab's kind at creation                            |
| Specific kind    | `SpecificTabKind`, `SPECIFIC_TAB_KINDS` (every creatable kind but `diagram`)                             | The kinds that have a `kind:` key                           |
| Template family  | `TemplateFamily`, `TEMPLATE_FAMILIES = ['retrospective', 'kanban']`; `template_family`, `templateFamily` | The family of templates a document was made from            |
| Recorded intent  | `RecordedIntent` `{ opensIn, tabKind, templateFamily }`, each nullable                                   | What the create insert wrote; null `opensIn` = unknown      |
| Chosen placement | `RequestedPlacement.chosen`                                                                              | The body names a team or carries the `folderId` key         |
| Explicit root    | `{ teamId: null, folderId: null, chosen: true }`                                                         | The root of My documents, chosen on purpose                 |
| Dangling default | `DefaultSkipReason`                                                                                      | `folder_missing` / `folder_not_visible` / `team_not_joined` |
| Via              | `via: 'explicit' \| 'default' \| 'root'`, log `via=default key=<key>`                                    | Which step decided; `root` only when nothing was chosen     |

Banned: "type" for a mode or a template family (say opens in, template family), "board type" for
anything, "fallback" for a skipped default, "preference" for a default folder, "whiteboard" as a tab
kind in an intent (a whiteboard is `mode: 'draw'`, `tabKind: 'diagram'`).

## Behaviour and state

`creationIntentOf(tab, templateFamily = null)` over `{ kind?: string; opensIn?: string; layers?: Layer[] } | undefined`:

1. `mode`: `draw` when `kind === 'whiteboard'` (legacy) or `opensIn === 'draw'`, else `diagram`.
2. `tabKind`: `event-storming` when `isEventStormingTab(tab)` (the document model's reader: the kind,
   or a legacy board's layer), else `diagram`.
3. `templateFamily`: the argument, left out when null.

Callers pass `templateFamilyOf(templateKind)` where a template made the document (the wizard and its
bypasses, MCP template tabs) and nothing otherwise (imports, Drive copies, MCP element or graph tabs).

`templateFamilyOf` reads a `Record<TemplateKind, TemplateFamily | null>`, so a new template kind that is
not mapped fails the typecheck. Its non-null rows:

| Template kind         | Template family |
| --------------------- | --------------- |
| `retrospective`       | `retrospective` |
| `start-stop-continue` | `retrospective` |
| `mad-sad-glad`        | `retrospective` |
| `four-ls`             | `retrospective` |
| `sailboat`            | `retrospective` |
| `kanban`              | `kanban`        |

Every other template kind maps to null: `event-storming` (a tab kind, read from the tab),
`incident-postmortem` and `lean-coffee` included.

`PLACEMENT_DEFAULT_KEYS` is generated in list order: one `mode:<m>` per `EDITOR_MODES` entry, one
`kind:<k>` per `SPECIFIC_TAB_KINDS` entry, one `template:<f>` per `TEMPLATE_FAMILIES` entry.
`SPECIFIC_TAB_KINDS` is `CREATION_TAB_KINDS` without `DEFAULT_TAB_KIND`. `CREATION_TAB_KINDS` is checked
against `TabKind` with `satisfies`; the legacy `whiteboard` kind is not in it.

`defaultKeysFor(intent)`: `kind:<tabKind>` when the tab kind is specific, then
`template:<templateFamily>` when present, then `mode:<mode>`; only listed keys kept.

`parsePlacement(body)` → `RequestedPlacement { teamId, folderId, chosen }` or null (`placement_invalid`):
`teamId` absent / null → null, a non-empty string → itself; `folderId` absent → null, null → null, a
non-empty string → itself; anything else invalid. `chosen = teamId !== null || 'folderId' in body`.

`resolvePlacement(requested, caller, lookups, intent)`, steps in order, first non-null wins:

1. Team judgement, unchanged ([document-placement.md](document-placement.md)).
2. `explicitFolder`: null unless `requested.chosen`. A folder is judged as before (`via: 'explicit'`); a
   chosen root answers `{ teamId, folderId: null }`, `via: 'explicit'`.
3. `defaultFolder`: null unless `intent !== null` (and, by step 2, nothing chosen). Reads
   `lookups.getPlacementDefaults(caller.ownerId)` once, then for each key of `defaultKeysFor(intent)`
   with a stored folder: reads the folder (`null` → skip `folder_missing`); for a team folder with a
   verified id, reads membership; `judgeDefaultFolder(folder, caller, joined)`:
   - personal folder: `folder.ownerId === caller.ownerId` → ok, else `folder_not_visible`;
   - team folder: `joined` (false without a verified id) → ok, else `team_not_joined`.
     A skip is appended to `skipped` and the next key is tried. The first ok answers
     `{ teamId: folder.teamId, folderId }`, `via: 'default'`, `key`.
4. `spaceRoot`: `{ teamId: null, folderId: null }`, `via: 'root'`.

Invariants: a skip never rejects; a chosen placement never reads `placement_defaults`; `intent === null`
never reads it; kind before template before mode. Outcome placements carry `teamId` and `folderId`
only.

Route order in `POST /api/documents`: body id/name → dates → `parsePlacement` → `readCreationIntent`
(`intent_invalid`) → tabs → clash → … → resolve (genuine create only) → insert, recording the intent.

**Duplicate** (`duplicateDocument(ownerId, sourceId, placement?)`): loads the source document; the
placement is the argument, else the source's own `{ teamId, folderId }`, always sent with the
`folderId` key (null included), so always chosen; the intent is the source's recorded one when its
`opensIn` is known (`{ mode: opensIn, tabKind, templateFamily? }`), else none. A refusal whose code is
`team_forbidden`, `folder_not_found` or `folder_scope_mismatch` retries once at the explicit root of My
documents (`{ folderId: null }`), logging `[duplicate] placement refused reason=<code>, filed at the
root`.

**Wizard** (`TemplatePicker`): `placementSeen` starts true when a `/new?folder=` / `?team=` context
seeded the picker, and turns true when the Settings step opens or a destination is double-clicked.
`settingsFor(p)` carries `parsePlacement(p)` only when seen; otherwise no `teamId` / `folderId`. The
page passes them through, `undefined` staying absent. The bypass reads `?folder=` / `?team=` as
`undefined` when missing.

## Recorded intent

- Migration 0062: `ALTER TABLE documents ADD COLUMN opens_in TEXT`, `ADD COLUMN tab_kind TEXT`,
  `ADD COLUMN template_family TEXT`; nullable, no default, no backfill: existing rows read unknown.
- `upsertDocumentMeta` takes `opensIn` / `tabKind` / `templateFamily` and writes them in the INSERT
  only; the `ON CONFLICT` update never sets them.
- `POST /api/documents` records `intent.mode`, `intent.tabKind`, `intent.templateFamily ?? null` when
  an intent is present, else null, null, null.
- `copyDocument` inserts the three columns read from the source row in the same statement
  (`INSERT … SELECT`), never recomputed.
- `DOCUMENT_COLS` and `DOCUMENT_SUMMARY_COLS` gain the three columns; `readRecordedIntent(row)` maps
  them: `opensIn` through `isEditorMode`, `tabKind` and `templateFamily` through their lists; when
  `opensIn` reads null, all three are null (`D28`). `LiveDoc` and `DocumentSummary` carry
  `opensIn: EditorMode | null`, `tabKind: CreationTabKind | null`,
  `templateFamily: TemplateFamily | null`. An Offline Mode document and summary carry null, null, null.

## Interfaces and contracts

- **Create body:** `folderId?: string | null` (absent = no choice, null = the space's root chosen),
  `teamId?: string | null`, `intent?: { mode: EditorMode; tabKind?: 'diagram' | 'event-storming';
templateFamily?: 'retrospective' | 'kanban' }`. `readCreationIntent(value)`: `undefined` or `null` →
  `{ ok: true, intent: null }`; an object whose `mode` is a member, whose `tabKind` is absent, null
  (both `diagram`) or a member, and whose `templateFamily` is absent, null (dropped) or a member →
  `{ ok: true, intent }` (other fields ignored, `D22`); anything else → `{ ok: false }` → 400
  `{ error: 'intent_invalid' }`, nothing written.
- **`GET /api/placement-defaults`** → 200 `{ defaults: PlacementDefault[] }`, in
  `PLACEMENT_DEFAULT_KEYS` order (`D20`); a stored row whose key is not listed is left out.
- **`PUT /api/placement-defaults/:key`**, body `{ folderId: string }` → 204 (`D19`). `:key` is
  `decodeURIComponent`d, so `kind:event-storming` and `kind%3Aevent-storming` both name it (`D18`); an
  undecodable segment is `default_key_invalid`. Order: key → body (`default_folder_invalid` for a
  non-object, a missing, non-string or empty `folderId`, `D25`) → folder visibility
  (`judgeDefaultFolder`, any skip reason → 404 `folder_not_found`) → upsert (a repeat replaces, `D21`).
- **`DELETE /api/placement-defaults/:key`** → 204 whether or not a row existed;
  `default_key_invalid` first.
- Other methods or deeper paths → 404 `not_found`. No resolved owner → the shared `missingAuth()`.
- **Live client:** `apiCreateDocument(owner, { …, teamId?, folderId?, intent? })` puts `teamId` in the
  body when a string, `folderId` when not `undefined` (null included), `intent` when set. The
  placement-default functions throw `ApiError` with the token as `code`.
- **MCP:** `create_document` body gains `intent: creationIntentOf(tabs[0], templateFamilyOf(<the first
input tab's template kind, or null>))`; output `folder` is `"Generated"` when the created
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

- No foreign key and no `ON DELETE`: a dangling default is kept for a restore. The primary key's
  `owner_id` prefix serves the only read.
- Field classes: `owner_id` owner-keyed; `default_key` closed list, validated on write; `folder_id` a
  reference, checked on write and on every use; `updated_at` ms, written on every upsert.
- Upsert: `INSERT … ON CONFLICT (owner_id, default_key) DO UPDATE SET folder_id = excluded.folder_id,
updated_at = excluded.updated_at`.
- Account deletion: `DELETE FROM placement_defaults WHERE owner_id = ?`.
- Owner migration: `INSERT OR IGNORE … SELECT ?, default_key, folder_id, updated_at … WHERE
owner_id = ?` then `DELETE … WHERE owner_id = <guest>`: the account's row for a key wins.
- The recorded intent columns follow their document (deleted, migrated and trashed with it).

## Errors and edge cases

| Case                                                             | Handling                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Default's folder deleted                                         | Skipped `folder_missing`, next level; row kept                     |
| Default's personal folder not the caller's                       | Skipped `folder_not_visible`                                       |
| Default's team left, or caller now on the guest path             | Skipped `team_not_joined`                                          |
| Kind default dangles, template or mode default set               | Kind skipped, the next level answers                               |
| `folderId: null` sent with an intent                             | Explicit root, `via=explicit folder=root`; defaults not read       |
| `folderId` absent, no team, with an intent                       | Defaults consulted                                                 |
| `teamId: null` alone                                             | No choice, as absent                                               |
| `intent` a string, no `mode`, unknown `tabKind`/`templateFamily` | 400 `intent_invalid`, nothing written                              |
| Re-commit of an owned id with an intent                          | Stored place and record kept, `placement: skipped reason=existing` |
| Duplicate of a document with an unknown intent                   | No intent sent; the copy records unknown                           |
| Duplicate refused beside its source                              | Retried once at the explicit root, `[duplicate]` warning           |
| PUT unknown key, e.g. `board:kanban`                             | 400 `default_key_invalid`                                          |
| PUT `{}` / `{ folderId: 3 }` / `{ folderId: "" }`                | 400 `default_folder_invalid`                                       |
| PUT someone else's folder, unjoined team, guest → team folder    | 404 `folder_not_found`                                             |
| DELETE a key with no row                                         | 204                                                                |
| Stored key, opens-in, tab kind or family not in its list         | Left out of GET; never a candidate; reads unknown                  |

## Security and trust

- Team membership on PUT and on use is read against `ctx.verifiedUserId` only; a guest default is
  personal-only.
- `folder_not_found` covers every invisible folder: setting a default leaks no other person's folder.
- `placement-defaults` is in `OWNER_SCOPED_SEGMENTS`.
- A read-only API token is refused on PUT and DELETE by the global gate (403 `read_only_token`).
- Writes ride `WRITE_RATE_LIMITER` (300 per 60 s per owner, or per token): 429 `rate_limited`.
- A default grants nothing; a recorded intent grants nothing: it is a label on the caller's own row.

## Performance and limits

- Rows per owner ≤ `PLACEMENT_DEFAULT_KEYS.length` (5).
- A create with an intent and no choice adds one primary-key-prefix read, then per candidate key (at
  most three: kind, template, mode) one folder read and at most one membership read: worst case
  1 + 2 × 3 = 7 point reads. A chosen placement, or no intent, adds none.
- The recorded intent adds three short text columns to a row; no index.

## Observability

| Fingerprint                                                                                         | Where        |
| --------------------------------------------------------------------------------------------------- | ------------ |
| `placement: resolved scope=<personal/team> folder=<set/root> via=<explicit/default/root>`           | api, info    |
| `placement: resolved … via=default key=<key>`                                                       | api, info    |
| `placement: default-skipped key=<key> reason=<reason>`                                              | api, info    |
| `placement: rejected reason=intent_invalid scope=<personal/team>`                                   | api, warn    |
| `placement-defaults: set key=<key> scope=<personal/team>`                                           | api, info    |
| `placement-defaults: cleared key=<key>`                                                             | api, info    |
| `placement-defaults: rejected reason=<default_key_invalid/default_folder_invalid/folder_not_found>` | api, warn    |
| `[duplicate] placement refused reason=<code>, filed at the root`                                    | editor, warn |
| `[mcp] create_document folder lookup failed status=<n>`                                             | mcp, warn    |

## Testing

| Rule                                                                         | Test                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Editor modes are one list                                                    | `packages/document/src/editor-mode.test.ts`                                                      |
| Keys, intent derivation and parsing, key order, telemetry values             | `packages/api-schema/src/placement-defaults.test.ts`                                             |
| Template to template family map                                              | `apps/live/lib/template-families.test.ts`                                                        |
| Chosen or not; explicit root; default step; kind before template before mode | `apps/api/src/placement/resolve-placement.test.ts`                                               |
| Routes: every answer and rejection, encoded keys, logs (real SQLite)         | `apps/api/src/routes/placement-defaults.test.ts`                                                 |
| Create lands in the default; explicit root wins; dangling; intent_invalid    | `apps/api/src/routes/document-create-default-folder.test.ts`                                     |
| Placement on create, chosen roots logged as explicit                         | `apps/api/src/routes/document-create-placement.test.ts`                                          |
| Recorded intent written once, read back, unknown for legacy rows, copied     | `apps/api/src/routes/document-create-intent.test.ts`, `apps/api/src/document-intent-row.test.ts` |
| Store order, replace, clear; sign-up keeps the account's row                 | `apps/api/src/db/placement-defaults.test.ts`                                                     |
| Deletion and migration of every owner-keyed column                           | `apps/api/src/db/account-owner-columns.test.ts`                                                  |
| Dispatch, route labels, OpenAPI parity                                       | `apps/api/src/route-resources.test.ts`, `apps/api/src/openapi/*.test.ts`                         |
| Client functions; the create body's absent versus null `folderId`            | `apps/live/lib/api/placement-defaults.test.ts`, `apps/live/lib/api-client.test.ts`               |
| Wizard placement only once seen                                              | `apps/live/components/palette/TemplatePicker.test.tsx`                                           |
| Duplicate beside its source, record-only, root on refusal                    | `apps/live/lib/duplicate-document.test.ts`                                                       |
| Import and Drive copy send the intent                                        | `apps/live/lib/board-scene-import.test.ts`, `apps/live/lib/drive/livediagram-port.test.ts`       |
| MCP create sends the intent and names the folder                             | `apps/mcp/src/create-document-placement.test.ts`                                                 |

## Constants and configuration

| Constant                 | Value                               | Provenance               | Safe range                   |
| ------------------------ | ----------------------------------- | ------------------------ | ---------------------------- |
| Mode keys                | `mode:<m>` per `EDITOR_MODES` entry | Spec "Default keys"      | Grows with the editor modes  |
| `CREATION_TAB_KINDS`     | `['diagram', 'event-storming']`     | Spec "Creation intent"   | `TabKind` members, no legacy |
| `TEMPLATE_FAMILIES`      | `['retrospective', 'kanban']`       | Spec "Default keys"      | Closed; a new one adds a key |
| `DEFAULT_KEY_DIMENSIONS` | `['kind', 'template', 'mode']`      | Spec "Precedence"        | Most specific first          |
| Rate limit               | `WRITE_RATE_LIMITER`                | `apps/api/wrangler.toml` | Shared with every write      |

No environment variable or binding is added.

## Telemetry

`placementDefaultTelemetryType(key)` derives one closed value per key, `Default` + each part in
PascalCase (`DefaultModeDiagram`, `DefaultModeDraw`, `DefaultKindEventStorming`,
`DefaultTemplateRetrospective`, `DefaultTemplateKanban`), so a new editor mode gains its value with its
key. The surfaces that set and clear defaults fire `Folder·Changed·<value>` and
`Folder·Cleared·<value>` before the write; no surface exists yet, so no emitter and no dashboard card
are added here.

## Defaults ledger

D17 to D25, D27 and D28 in [DEFAULTS.md](DEFAULTS.md).
