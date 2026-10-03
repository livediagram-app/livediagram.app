# Default folders: blueprint

Derived from [Default folders](../default-folders.md), with the resolver of
[Folders → Placement on create](../folders.md#placement-on-create) and its blueprint
[document-placement.md](document-placement.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited
as `Dn`.

Scope, by file:

| File                                                      | Role                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/editor-mode.ts`                    | `EDITOR_MODES` (read off `EDITOR_MODE_CATALOGUE`), `EditorMode`, `DEFAULT_EDITOR_MODE`, `isEditorMode` (`D27`) |
| `packages/api-schema/src/placement-defaults.ts`           | Dimensions, keys, intent, `creationIntentOf`, `readCreationIntent`, telemetry values                           |
| `packages/templates/src/template-families.ts`             | `templateFamilyOf`: the one exhaustive template to template family map                                         |
| `apps/api/migrations/0061_placement_defaults.sql`         | The `placement_defaults` table (`D17`)                                                                         |
| `apps/api/migrations/0062_document_creation_intent.sql`   | `documents.opens_in`, `documents.tab_kind`, `documents.template_family`                                        |
| `apps/api/src/document-intent-row.ts`                     | `readRecordedIntent`: stored text to the lists, else null                                                      |
| `apps/api/src/db/documents.ts`                            | The create insert writes the record; reads expose it; the copy carries it                                      |
| `apps/api/src/db/placement-defaults.ts`                   | `listPlacementDefaults`, `setPlacementDefault`, `clearPlacementDefault`                                        |
| `apps/api/src/db/account.ts`                              | Account deletion and owner migration statements                                                                |
| `apps/api/src/placement/placement-types.ts`               | `RequestedPlacement`, `PlacementCaller`, `PlacementLookups`, `PlacementOutcome`, steps                         |
| `apps/api/src/placement/default-folder.ts`                | `judgeDefaultFolder`, `joinedFolderTeam`, the `defaultFolder` step                                             |
| `apps/api/src/placement/resolve-placement.ts`             | `parsePlacement` (chosen or not); `FOLDER_STEPS = [explicitFolder, defaultFolder]`                             |
| `apps/api/src/placement/placement-lookups.ts`             | `getPlacementDefaults(ownerId)` beside the membership and folder reads                                         |
| `apps/api/src/placement/placement-log.ts`                 | The `placement:` and `placement-defaults:` fingerprints                                                        |
| `apps/api/src/placement/placement-response.ts`            | `intentRejected()`                                                                                             |
| `apps/api/src/routes/placement-defaults.ts`               | `GET` / `PUT` / `DELETE /api/placement-defaults[/:key]`                                                        |
| `apps/api/src/routes/documents.ts`                        | `POST /api/documents` reads `intent`, resolves, records                                                        |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`             | Dispatch case; owner-scoped segment                                                                            |
| `packages/api-schema/src/error-telemetry.ts`              | `placement-defaults` in `API_ROUTE_RESOURCES`                                                                  |
| `apps/api/src/openapi/manifest.ts`                        | The three routes; the create body's `folderId` semantics and `intent`                                          |
| `apps/live/lib/api/placement-defaults.ts`                 | `apiListPlacementDefaults`, `apiSetPlacementDefault`, `apiClearPlacementDefault`                               |
| `apps/live/lib/api/documents.ts`                          | `apiCreateDocument` sends `folderId` when not `undefined` (null included) and `intent`                         |
| `apps/live/components/palette/TemplatePicker.tsx`         | The wizard's placement: a pick, the context or the default, else none (`useWizardPlacement`)                   |
| `apps/live/app/new/page.tsx`                              | The wizard and its bypasses send the first tab's intent and the template's family                              |
| `apps/live/lib/duplicate-document.ts`                     | Duplicate: beside the source, the source's recorded intent, root on refusal                                    |
| `apps/live/lib/board-scene-import.ts`                     | Every imported document sends its first tab's intent                                                           |
| `apps/live/lib/drive/livediagram-port.ts`                 | `importDocumentCopy`: no placement and an intent with no target; the mirror's place else                       |
| `apps/mcp/src/tools.ts`, `apps/mcp/src/created-folder.ts` | `create_document` sends the intent; reports the folder it landed in                                            |

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

**Wizard** (`TemplatePicker`, `useWizardPlacement`): the placement is the reader's pick, else the
`/new?folder=` / `?team=` context, else the default resolved for the template, each sent as
`parsePlacement(...)`; the root shown because nothing resolved sends no `teamId` / `folderId`, and
Skip sends only a pick or a context ([Surfaces (live)](#surfaces-live), "Wizard"). The page passes
them through, `undefined` staying absent, and passes no `initialPlacement` without a context. The
bypass reads `?folder=` / `?team=` as `undefined` when missing.

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
input tab's template kind, or null>))`; output `folder` is `"My documents"` when the created
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

| Rule                                                                            | Test                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Editor modes are one list                                                       | `packages/document/src/editor-mode.test.ts`                                                      |
| Keys, intent derivation and parsing, key order, telemetry values                | `packages/api-schema/src/placement-defaults.test.ts`                                             |
| Template to template family map                                                 | `apps/live/lib/template-families.test.ts`                                                        |
| Chosen or not; explicit root; default step; kind before template before mode    | `apps/api/src/placement/resolve-placement.test.ts`                                               |
| Routes: every answer and rejection, encoded keys, logs (real SQLite)            | `apps/api/src/routes/placement-defaults.test.ts`                                                 |
| Create lands in the default; explicit root wins; dangling; intent_invalid       | `apps/api/src/routes/document-create-default-folder.test.ts`                                     |
| Placement on create, chosen roots logged as explicit                            | `apps/api/src/routes/document-create-placement.test.ts`                                          |
| Recorded intent written once, read back, unknown for legacy rows, copied        | `apps/api/src/routes/document-create-intent.test.ts`, `apps/api/src/document-intent-row.test.ts` |
| Store order, replace, clear; sign-up keeps the account's row                    | `apps/api/src/db/placement-defaults.test.ts`                                                     |
| Deletion and migration of every owner-keyed column                              | `apps/api/src/db/account-owner-columns.test.ts`                                                  |
| Dispatch, route labels, OpenAPI parity                                          | `apps/api/src/route-resources.test.ts`, `apps/api/src/openapi/*.test.ts`                         |
| Client functions; the create body's absent versus null `folderId`               | `apps/live/lib/api/placement-defaults.test.ts`, `apps/live/lib/api-client.test.ts`               |
| Wizard placement: a pick, a context or the default; the shown root is no choice | `apps/live/components/palette/TemplatePicker.test.tsx`                                           |
| Duplicate beside its source, record-only, root on refusal                       | `apps/live/lib/duplicate-document.test.ts`                                                       |
| Import and Drive copy send the intent                                           | `apps/live/lib/board-scene-import.test.ts`, `apps/live/lib/drive/livediagram-port.test.ts`       |
| MCP create sends the intent and names the folder                                | `apps/mcp/src/create-document-placement.test.ts`                                                 |

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
`Folder·Cleared·<value>` before the write; the one emitter is the store
(`placement-defaults-store.ts`), which every surface writes through. The dashboard charts them as Default
Folders Set and Default Folders Cleared in its Organisation stack
(`apps/telemetry/app/catalogue/features.ts`), their values read from `PLACEMENT_DEFAULT_KEYS`
(`apps/telemetry/app/computed-emitters.ts`).

## Defaults ledger

D17 to D25, D27, D28, D105 to D120, D123 and D124 in [DEFAULTS.md](DEFAULTS.md).

## Surfaces (live)

Derived from [Default folders → Surfaces](../default-folders.md#surfaces). Defaults applied where that
section is silent are `D105` to `D120` and `D123` to `D125`.

| File                                                                                                                                    | Role                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/icons/lucide-manifest.json`                                                                                                   | Vendors `square-kanban` and `folder-check` (`D110`, `D118`)                                                                                               |
| `apps/live/lib/placement-defaults/default-key-entries.ts`                                                                               | `DEFAULT_KEY_ENTRIES`, `defaultKeyEntry`, `joinNouns`, `defaultFolderDescription`                                                                         |
| `apps/live/lib/placement-defaults/placement-defaults-store.ts`                                                                          | The page's one copy: load, set, clear, optimistic with rollback, telemetry, logs                                                                          |
| `apps/live/lib/placement-defaults/default-destination.ts`                                                                               | Pure: `DefaultFolderIndex`, `workingDefault`, `resolveDefaultFor`, `destinationOf`, keys                                                                  |
| `apps/live/lib/placement-defaults/default-folder-names.ts`                                                                              | This browser's memory of default folders' names (`D113`)                                                                                                  |
| `apps/live/lib/folder-delete-confirmation.ts`                                                                                           | `folderDeleteConfirmation`: where the contents go, the default-folder line                                                                                |
| `apps/live/hooks/persistence/usePlacementDefaults.ts`                                                                                   | `usePlacementDefaults(ownerId)`, `useFolderDefaultKeys(folderId)`                                                                                         |
| `apps/live/hooks/persistence/useDefaultFolderMenus.ts`                                                                                  | `useDefaultFolderIndex(lists)`, `useDefaultFolderMenus(ownerId, lists)`: the menu bundles for a folder and for My documents; notes default folders' names |
| `apps/live/hooks/persistence/usePlacementOptions.ts`                                                                                    | Moved from `app/new`: folders, teams and team folders for a picker, inline create, and `ready` / `failed`                                                 |
| `apps/live/components/placement/default-key-icons.tsx`                                                                                  | `DEFAULT_KEY_ICONS`, `DefaultKeyIcon`                                                                                                                     |
| `apps/live/components/placement/DefaultFolderMarker.tsx`                                                                                | The marker; `useDefaultFolderDescription(folderId)` for a tree row's description                                                                          |
| `apps/live/components/placement/UseAsDefaultMenu.tsx`                                                                                   | The submenu: a plain flyout of `MenuCheckRow`s                                                                                                            |
| `apps/live/components/placement/DefaultFolderPickerDialog.tsx`                                                                          | The default folder picker                                                                                                                                 |
| `apps/live/components/primitives/MenuCheckRow.tsx`                                                                                      | A `menuitemcheckbox` row                                                                                                                                  |
| `apps/live/components/primitives/MenuFlyoutSection.tsx`, `MenuFlyoutPanel.tsx`                                                          | Gains `plain`: a trigger shaped like a plain `MenuActionRow`; the panel and trigger faces in their own file                                               |
| `apps/live/app/explorer/folder-actions-menu.tsx`                                                                                        | `defaults?: DefaultFolderMenu` renders the submenu before Delete                                                                                          |
| `apps/live/app/explorer/folder-row.tsx`, `explorer-folder-cards.tsx`                                                                    | Marker; `menuHandlers` passes `defaults`                                                                                                                  |
| `apps/live/app/explorer/useExplorerState.ts`                                                                                            | `folderActions` bundles `defaults`; exposes `rootDefaults`                                                                                                |
| `apps/live/app/explorer/sidebar/SpacesGroup.tsx`, `useMyDocumentsMenu.tsx`                                                              | My documents' `⋯` and right-click menu, shared with the panel                                                                                             |
| `apps/live/app/explorer/sidebar/SidebarFolderSubtree.tsx`, `TeamFolderSubtree.tsx`                                                      | `FolderLabel` (name, then marker); the marker's words as the row's description                                                                            |
| `apps/live/components/panels/explorer-tree/*`                                                                                           | `PanelTree.defaultFolders`; panel folder rows and My documents                                                                                            |
| `apps/live/components/panels/TeamSharedDocuments.tsx`                                                                                   | Team library folder menus carry `defaults`                                                                                                                |
| `apps/live/components/palette/useWizardPlacement.ts`                                                                                    | The wizard's placement: picked, context, default, what is sent                                                                                            |
| `apps/live/components/placement/placement-view.ts`, `usePlacementView.ts`                                                               | The browser opens where its selection is: `placementViewFor`, followed until the reader moves (`D125`)                                                    |
| `apps/live/components/palette/WizardDefaultFolder.tsx`                                                                                  | The slot under the browser: the reason line with Change default, or Always save                                                                           |
| `apps/live/components/palette/template-picker-settings.tsx`, `TemplatePicker.tsx`, `TemplatePickerHeader.tsx`                           | `placementFooter` under the browser; the picker's placement from `useWizardPlacement`; its header in its own file                                         |
| `apps/live/app/new/page.tsx`, `useWizardDefaults.ts`                                                                                    | No context = no `initialPlacement`; `useWizardDefaults` resolves per template; `applyAlwaysSave` before the create                                        |
| `apps/live/components/dialogs/settings/SettingsPlacementDefaultRow.tsx`                                                                 | One Settings row                                                                                                                                          |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`, `settings-icons.tsx`                                                     | The `documents` category (its folder glyph on a lime tile), one `placementDefault` row per key                                                            |
| `apps/live/components/dialogs/SettingsDialog.tsx`, `apps/live/components/dialogs/settings/SettingsCategoryPane.tsx`                     | `ownerId` loads the defaults; the pane fetches the folder lists only for a pane with Documents rows                                                       |
| `apps/live/lib/drive/snapshot.ts`, `plan-inbound.ts`, `engine.ts`                                                                       | `deletedFolders`: a folder deleted here is never restored by its own stale create ([drive blueprint](../../022-drive-mirror/blueprints/drive-mirror.md))  |
| `apps/live/app/explorer/useExplorerState.ts` (settings link)                                                                            | The `?settings=` deep link is read once hydrated                                                                                                          |
| `apps/live/hooks/persistence/useDocumentListActions.ts`, `useFolders.ts`, `hooks/ui/useTeamFolderActions.ts`, `TeamSharedDocuments.tsx` | One confirmation; optimistic move-up                                                                                                                      |

### Domain and naming (surfaces)

| Term                    | Identifier                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Entry                   | `DefaultKeyEntry { key, label, noun }`, `DEFAULT_KEY_ENTRIES` in `PLACEMENT_DEFAULT_KEYS` order                                      |
| The page's defaults     | `PlacementDefaultsState { ownerId, status: 'idle'/'loading'/'ready'/'failed', defaults }`                                            |
| Folder index            | `DefaultFolderIndex { personal: Map<id, folder>, team: Map<id, folder & { teamId }>, teams }`                                        |
| Working default         | `workingDefault(key, defaults, index)`: the stored folder when the index holds it, else null                                         |
| Destination             | `DefaultDestination`: `{ kind: 'root' }`, `{ kind: 'folder', folder, teamName }`, `{ kind: 'dangling', folderId, reason, fallback }` |
| Default folder menu     | `DefaultFolderMenu { isChecked(key), isDisabled(key), toggle(key) }`                                                                 |
| Surface                 | `DefaultSurface = 'menu' / 'wizard' / 'settings'`, for the log only                                                                  |
| Wizard placement source | `'picked' / 'context' / 'default' / 'none'`                                                                                          |

Banned: "home folder", "favourite folder", "preferred folder", "routing" in copy.

### Behaviour and state (surfaces)

**Store** (module scope, `useSyncExternalStore`): one state per page.

- `loadPlacementDefaults(ownerId)`: no-op when this owner is `loading` or `ready`; a different owner
  replaces the state (`status: 'loading'`, empty map). `GET` → `ready` with the map, logs `loaded
count=<n>`; a failure → `failed`, logs `load failed status=<n>`. A response for an owner no longer
  current is dropped.
- `setPlacementDefault(key, folderId, surface)` and `clearPlacementDefault(key, surface)`: require
  `ready`; fire `track('Folder', 'Changed' | 'Cleared', placementDefaultTelemetryType(key))`
  **before** the write; apply the change optimistically; on success log `set key=<key>
surface=<surface>` / `cleared key=<key> surface=<surface>`; on failure restore the previous value,
  log `write failed key=<key> code=<code>, rolled back` (warn) and resolve `false`.
- A set whose folder already holds the key, or a clear of a key with no default, writes nothing.

**Destination** (pure, `default-destination.ts`):

- `workingDefault(key, defaults, index)`: `defaults.get(key)` when it names a folder in
  `index.personal`, or in `index.team` whose `teamId` is in `index.teams`; else null.
- `resolveDefaultFor(intent, defaults, index)`: the first of `defaultKeysFor(intent)` with a working
  default → `{ key, folderId, teamId, folderName }`; each stored but not working key before it is
  listed in `skipped`.
- `representativeIntent(key)`: `mode:<m>` → `{ mode: m, tabKind: 'diagram' }`; `kind:<k>` →
  `{ mode: 'diagram', tabKind: k }`; `template:<f>` → `{ mode: 'diagram', tabKind: 'diagram',
templateFamily: f }` (`D112`).
- `destinationOf(key, defaults, index)`: no stored default → `root`; working → `folder`; else
  `dangling` with `reason: 'deleted'` (a personal id, or a team folder of a listed team, not in the
  index) or `'unavailable'` (remembered as a team folder whose team is not listed), and
  `fallback = resolveDefaultFor(representativeIntent(key))` over the other keys (null = My documents).
- `folderDefaultKeys(folderId, defaults)`: the keys stored for this folder, in list order.

**Menus** (`useDefaultFolderMenus`):

- `forFolder(folder)`: `isChecked(key)` = `defaults.get(key) === folder.id`; `toggle(key)` clears
  when checked, else sets this folder; `isDisabled` never.
- `forRoot`: `isChecked(key)` = `workingDefault(key) === null`; `isDisabled(key)` = `isChecked(key)`;
  `toggle(key)` clears.
- Both are `undefined` until the store is `ready`, so a menu opened before the load shows no
  submenu rather than wrong checks.

**Wizard** (`useWizardPlacement`):

- Inputs: `context` (the `/new` URL's placement string, else `undefined`), `resolved` (the default
  for the picked template's intent), the reader's `picked` placement.
- `selected = picked ?? context ?? resolved?.value ?? 'unsorted'`; `source` follows the same order.
- `sent()`: `picked`, `context`, `default` → `parsePlacement(selected)`; `none` → `{}` (`D115`).
  `skipToDefaults` sends only `picked` or `context`.
- `resolved` is re-read on every render, so a template change, a load, or a Change default
  re-resolves; `picked` survives. A Change default clears `picked`.
- **Shown where it is:** the picker hands `selected` to the shared browser, which opens at
  `placementViewFor(parsePlacement(selected))` (below), so the pre-selected default folder's card is the checked
  radio; a `/new?folder=` context takes the same path.
- Logs `pre-selected key=<key>` once per resolved key and `default-skipped key=<key>
reason=folder_unknown` per skipped key.
- **Always save:** `alwaysSaveKey = defaultKeysFor(intent)[0]`. Offered when the location is
  livediagram, the selection is the My documents root or a folder (not a team root), and
  `workingDefault(alwaysSaveKey)` differs from the selection's folder (null for the root). Reset to
  unticked whenever the offer's selection or key changes. On Create, when ticked, the page awaits
  `setPlacementDefault` (or `clearPlacementDefault` at the root) with surface `wizard` before
  `apiCreateDocument`; its result never stops the create.

**Browser view** (`usePlacementView`, `placementViewFor`; spec [Save locations](../../006-document/save-locations.md), "It opens where its selection is"):

- `PlacementView = { space: string | null; stack: PickerFolder[] }`: `space` null is the overview,
  `'personal-space'` or a team id a space; `stack` the folders opened, root inward.
- `PlacementSpaces = { showPersonal, teams, folders, teamFolders }`; `PERSONAL_SPACE` is
  `'personal-space'`; `hasSpaceOverview(spaces)` is `showPersonal || teams.length > 1`, and
  `spaceRootView(spaces)` the overview where there is one, else the surface's one space at its root.
- `placementViewFor({ teamId, folderId }, spaces)` (a parsed placement): a folder selection whose
  folder is in its offered space's list opens that space with `stack` = the folder's ancestors
  (root inward, the folder itself excluded), so the level shown lists the folder (`D125`).
  Anything else (a space's root, a folder not in the lists yet, a space not offered) is
  `spaceRootView`.
- `usePlacementView(placement, derived)` holds `pinned: { view, at } | null`. It shows the pinned
  view while its `at` equals the placement, else `derived`, recomputed per render: a late
  default, a Change default, or a list that arrives later is followed.
- Every reader move (select, drill, back, enter a space, create a folder or team) pins the view it
  leads to, with `at` set to the placement it leaves selected: the view never jumps under the reader.
  A placement changed from outside the browser (`at` no longer matching) unpins it.

**Folder delete (client):** the confirmation is `folderDeleteConfirmation({ name, parentName,
scope, defaultKeys })`; the optimistic update moves the folder's subfolders and documents to its
`parentId`, as the api does.

### Interfaces and contracts (surfaces)

- `FolderActionsMenu` gains `defaults?: DefaultFolderMenu`; `FolderActionBundle` gains
  `defaults?: DefaultFolderMenu`; `menuHandlers` passes it through.
- `MenuFlyoutSection` gains `plain?: boolean`: the trigger is a full-width 13px sentence-case row
  with its icon in the 20px slot, as `MenuActionRow plain`, and a chevron-right in place of the
  ellipsis.
- `MenuCheckRow { label, icon, checked, disabled?, onToggle }`: `role="menuitemcheckbox"`,
  `aria-checked`, `aria-disabled` when disabled; a check glyph in a fixed 16px slot whether checked
  or not, then the entry's icon, then the label.
- `NewDocumentSettings` gains `alwaysSave?: { key: PlacementDefaultKey; folderId: string | null }`.
- `TemplatePicker` gains `defaults?: WizardDefaults` (`resolve(kind)`, `alwaysSaveKey(kind)`,
  `currentValue(key)`, `change(key, folderId)`), built by `useWizardDefaults`; the picker's folder
  lists are reused by the Change default dialog. `NewDocumentSettingsStep` gains `placementFooter`.
- `SettingsDialog` gains `ownerId?: string | null`, handed to the Documents rows; the store's own
  owner is used when absent.
- `SettingsPlacementDefaultRowSpec = RowBase & { kind: 'placementDefault'; placementKey }`.
- `DefaultFolderPickerDialog { entry, current: string | null, folders, teams, teamFolders,
onCreateFolder?, onPick(folderId: string | null), onClose }`.

### Presentation and UX (surfaces)

- Menu row: **Use as default for** with the folder-check icon, after Change Folder, before the Delete
  separator. Its flyout: a `MenuHeader` "New documents that open as", then the five `MenuCheckRow`s.
- Marker: `inline-flex shrink-0 items-center gap-0.5` icons at 12px in `text-slate-500
dark:text-slate-400`, then `+N` at 10px semibold; after the count badge; in a tree row inside the
  label's flex box (the label truncates, the marker does not).
- Wizard slot (`min-h-6`, under the browser): either a `role="note"` line in `text-xs` slate with
  the label and folder in semibold and a text button **Change default** (brand, underlined on
  hover), or the Always save checkbox, `text-sm`, native. They never show together (`D123`).
- Settings row card: the label (title case, `D124`) over the destination text (wrapping), with
  **Change** and, with a default, **Clear** as small bordered buttons on the right, as the Trash
  row's link. Dangling destination in amber-700 /
  amber-300 with the reason in words. While the store loads, the destination reads "Loading…"; a
  failed load reads "Couldn't load your default folders" and offers no buttons (`D120`).
- Folder delete confirmation: title `Delete "<name>"?`, message "Its documents and subfolders move to
  <parent>." plus the default-folder line, confirm **Delete folder**.

### Accessibility (surfaces)

- The submenu trigger is a `button` with `aria-haspopup="menu"` and `aria-expanded`; its items are
  `menuitemcheckbox` with `aria-checked`; a disabled root entry has `aria-disabled="true"` and keeps
  focusability for discovery.
- The marker's icons are `aria-hidden`; its words are a visually hidden span: in a tree row they are
  the row's `aria-describedby` description; in a list row or card they follow the name.
- The marker's icons on the row background meet 3:1 (slate-500 on white 4.8:1; slate-400 on
  slate-800 5.4:1). Not colour alone: each key's icon differs in shape, and the words exist.
- The wizard's checkbox is a native `input type="checkbox"` with its `label`; the note is
  `role="note"`; Change default is a `button`.
- Settings buttons name their entry: "Change default folder for whiteboards", "Clear default folder
  for whiteboards".

### Web experience (surfaces)

- CLS: the marker renders inside space the row already has (after the truncating name), and the
  wizard's note and checkbox share one slot under the browser, reserved (`min-h-6`) whenever the
  folder step shows, so neither pushes content as it appears.
- One `GET /api/placement-defaults` per page; no request on hover or render.
- INP: a toggle updates the store synchronously (optimistic), the write runs after paint.

### Errors and edge cases (surfaces)

| Case                                                    | Handling                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Store not ready when a menu opens                       | No submenu                                                                           |
| Set or clear refused (`folder_not_found`, network, 429) | Rolled back, `write failed` warning, the check flips back                            |
| The wizard's default folder not in its lists yet        | Skipped (`default-skipped reason=folder_unknown`), the root shown, no placement sent |
| A selected folder not in the browser's lists yet        | The overview; the folder's level once the list arrives, unless the reader has moved  |
| Always save write fails                                 | Logged; the create goes ahead with the explicit placement                            |
| Reader owner changes (sign-in)                          | The store reloads for the new owner                                                  |
| Dangling default, name unknown                          | "A deleted folder (deleted), using …"                                                |
| Team root selected in the picker                        | "Choose a folder inside the team", button unavailable                                |

### Observability (surfaces)

| Fingerprint                                                         | Where             |
| ------------------------------------------------------------------- | ----------------- |
| `[default-folders] loaded count=<n>` / `load failed status=<n>`     | editor, info/warn |
| `[default-folders] set key=<key> surface=<surface>`                 | editor, info      |
| `[default-folders] cleared key=<key> surface=<surface>`             | editor, info      |
| `[default-folders] write failed key=<key> code=<code>, rolled back` | editor, warn      |
| `[default-folders] pre-selected key=<key>`                          | editor, info      |
| `[default-folders] default-skipped key=<key> reason=folder_unknown` | editor, info      |

### Testing (surfaces)

| Rule                                                         | Test                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Entries, nouns joined, marker words                          | `apps/live/lib/placement-defaults/default-key-entries.test.ts`                                   |
| Load, set, clear, telemetry before the write, rollback       | `apps/live/lib/placement-defaults/placement-defaults-store.test.ts`                              |
| Working default, resolution, destinations, dangling fallback | `apps/live/lib/placement-defaults/default-destination.test.ts`                                   |
| Name memory per owner                                        | `apps/live/lib/placement-defaults/default-folder-names.test.ts`                                  |
| Folder delete wording                                        | `apps/live/lib/folder-delete-confirmation.test.ts`                                               |
| Menu checks for a folder and for My documents                | `apps/live/hooks/persistence/useDefaultFolderMenus.test.tsx`                                     |
| Submenu renders, toggles, ARIA                               | `apps/live/components/placement/UseAsDefaultMenu.test.tsx`                                       |
| Marker icons, +N, words                                      | `apps/live/components/placement/DefaultFolderMarker.test.tsx`                                    |
| Wizard selection, what is sent, Always save offer            | `apps/live/components/palette/useWizardPlacement.test.tsx`, `TemplatePicker.test.tsx`            |
| The browser opens at the selected folder's level, then pins  | `apps/live/components/placement/placement-view.test.ts`, `PlacementBrowser.test.tsx`             |
| Lists ready or failed                                        | `apps/live/hooks/persistence/usePlacementOptions.test.tsx`                                       |
| A folder deleted here never restored by its stale create     | `apps/live/lib/drive/plan-inbound.test.ts`, `engine.outbound.test.ts`                            |
| Settings row states                                          | `apps/live/components/dialogs/settings/SettingsPlacementDefaultRow.test.tsx`                     |
| End to end, guest and signed in, desktop and phone           | `apps/live/e2e/default-folders.spec.ts`, `apps/live/e2e/clerk-stub/default-folders-team.spec.ts` |

### Constants and configuration (surfaces)

| Constant                      | Value                                  | Provenance  | Safe range |
| ----------------------------- | -------------------------------------- | ----------- | ---------- |
| `MARKER_MAX_ICONS`            | 2                                      | Spec marker | 1 to 3     |
| `DEFAULT_FOLDER_NAMES_PREFIX` | `livediagram:v2:default-folder-names:` | `D113`      | Fixed      |

### Assets (surfaces)

| Icon                  | Source                        | Licence | Path                                                               |
| --------------------- | ----------------------------- | ------- | ------------------------------------------------------------------ |
| Diagrams, Whiteboards | `FlowchartIcon`, `MarkerIcon` | MIT     | `packages/ui/src/icons/drawing-kinds.tsx`                          |
| Event Storming boards | Lucide `sticky-note`          | ISC     | `packages/icons/src/lucide.generated.ts`                           |
| Retrospectives        | Lucide `history`              | ISC     | same                                                               |
| Kanban boards         | Lucide `square-kanban`        | ISC     | same, vendored by `pnpm --filter @livediagram/icons vendor:lucide` |
| Use as default for    | Lucide `folder-check`         | ISC     | same                                                               |
