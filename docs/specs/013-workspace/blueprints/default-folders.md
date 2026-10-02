# Default folders: blueprint

Derived from [Default folders](../default-folders.md), with the resolver of
[Folders → Placement on create](../folders.md#placement-on-create) and its blueprint
[document-placement.md](document-placement.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited
as `Dn`.

Scope, by file:

| File                                                      | Role                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/api-schema/src/placement-defaults.ts`           | Keys, intent, `creationIntentOf`, `readCreationIntent`, `defaultKeysFor`, telemetry |
| `apps/api/migrations/0061_placement_defaults.sql`         | The `placement_defaults` table (`D17`)                                              |
| `apps/api/src/db/placement-defaults.ts`                   | `listPlacementDefaults`, `setPlacementDefault`, `clearPlacementDefault`             |
| `apps/api/src/db/account.ts`                              | Account deletion and owner migration statements                                     |
| `apps/api/src/placement/placement-types.ts`               | `PlacementCaller`, `PlacementFolder`, `PlacementLookups`, `PlacementOutcome`, steps |
| `apps/api/src/placement/default-folder.ts`                | `judgeDefaultFolder`, the `defaultFolder` step                                      |
| `apps/api/src/placement/resolve-placement.ts`             | `FOLDER_STEPS = [explicitFolder, defaultFolder]`; `resolvePlacement(…, intent)`     |
| `apps/api/src/placement/placement-lookups.ts`             | `getPlacementDefaults(ownerId)` beside the membership and folder reads              |
| `apps/api/src/placement/placement-log.ts`                 | The `placement:` and `placement-defaults:` fingerprints                             |
| `apps/api/src/placement/placement-response.ts`            | `intentRejected()`                                                                  |
| `apps/api/src/routes/placement-defaults.ts`               | `GET` / `PUT` / `DELETE /api/placement-defaults[/:key]`                             |
| `apps/api/src/routes/documents.ts`                        | `POST /api/documents` reads `intent`, passes it to the resolver                     |
| `apps/api/src/index.ts`, `auth/guest-rest.ts`             | Dispatch case; owner-scoped segment                                                 |
| `packages/api-schema/src/error-telemetry.ts`              | `placement-defaults` in `API_ROUTE_RESOURCES`                                       |
| `apps/api/src/openapi/manifest.ts`                        | The three routes; the create body's `intent`                                        |
| `apps/live/lib/api/placement-defaults.ts`                 | `apiListPlacementDefaults`, `apiSetPlacementDefault`, `apiClearPlacementDefault`    |
| `apps/live/lib/api/documents.ts`                          | `apiCreateDocument` sends `intent`                                                  |
| `apps/live/app/new/page.tsx`                              | The wizard and its bypasses send the first tab's intent                             |
| `apps/live/lib/board-scene-import.ts`                     | Every imported document sends its first tab's intent                                |
| `apps/live/lib/drive/livediagram-port.ts`                 | `importDocumentCopy` sends an intent only with no target (Import a copy)            |
| `apps/mcp/src/tools.ts`, `apps/mcp/src/created-folder.ts` | `create_document` sends the intent; reports the folder it landed in                 |

## Domain and naming

| Term             | Identifier                                                            | Meaning                                                     |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Default folder   | `PlacementDefault` `{ key, folderId }`, row of `placement_defaults`   | One person's folder for one key                             |
| Default key      | `PlacementDefaultKey`, `PLACEMENT_DEFAULT_KEYS`, column `default_key` | `<dimension>:<value>`, closed list in force                 |
| Dimension        | `DEFAULT_KEY_DIMENSIONS = ['kind', 'mode']`                           | Most specific first; the precedence between keys            |
| Creation intent  | `CreationIntent` `{ mode: CreationMode, kind: CreationKind }`         | What a new document is; body field `intent`                 |
| Editor mode      | `CreationMode`, `CREATION_MODES = ['diagram', 'draw']`                | The mode the first tab opens in                             |
| Tab kind         | `CreationKind`, `CREATION_KINDS = ['diagram', 'event-storming']`      | The first tab's kind; `diagram` is the general tab          |
| Dangling default | `DefaultSkipReason`                                                   | `folder_missing` / `folder_not_visible` / `team_not_joined` |
| Via              | `via: 'default'`, log `via=default key=<key>`                         | The default step decided                                    |

Banned: "fallback" for a skipped default (it falls through to the next level), "preference" for a
default folder (the preferences blob is a different store), "whiteboard kind" in intent (a legacy
whiteboard tab is `mode: 'draw'`, `kind: 'diagram'`).

## Behaviour and state

`creationIntentOf(tab)` over `{ kind?: string; opensIn?: string } | undefined`:

1. `kind === 'event-storming'` → `{ mode: 'diagram', kind: 'event-storming' }`.
2. `kind === 'whiteboard'` (legacy) or `opensIn === 'draw'` → `{ mode: 'draw', kind: 'diagram' }`.
3. Otherwise (no tab included) → `{ mode: 'diagram', kind: 'diagram' }`.

`defaultKeysFor(intent)` maps each dimension of `DEFAULT_KEY_DIMENSIONS`, in order, to
`<dimension>:<intent[dimension]>` and keeps only keys in `PLACEMENT_DEFAULT_KEYS`. Today that is
`['mode:<mode>']`; adding `'kind:event-storming'` to the list makes it `['kind:event-storming',
'mode:diagram']` for a board, with no other change.

`resolvePlacement(requested, caller, lookups, intent)`, steps in order, first non-null wins:

1. Team judgement, unchanged ([document-placement.md](document-placement.md)).
2. `explicitFolder`, unchanged.
3. `defaultFolder`: null unless `intent !== null && requested.teamId === null && requested.folderId
=== null`. Else reads `lookups.getPlacementDefaults(caller.ownerId)` once, then for each key of
   `defaultKeysFor(intent)` with a stored folder: reads the folder; for a team folder with a verified
   id, reads membership; `judgeDefaultFolder(folder, caller, joined)`:
   - `folder === null` → `folder_missing`;
   - personal folder: `folder.ownerId === caller.ownerId` → ok, else `folder_not_visible`;
   - team folder: `joined` (false without a verified id) → ok, else `team_not_joined`.
     A skip is appended to the outcome's `skipped` list and the next key is tried. The first ok answers
     `{ teamId: folder.teamId, folderId }`, `via: 'default'`, `key`.
4. `spaceRoot`.

Every success outcome carries `skipped: DefaultSkip[]` (empty unless step 3 ran); the route logs each.
Invariants: a skip never rejects; a default never answers for a request naming a team or a folder;
`intent === null` never reads `placement_defaults`.

Route order in `POST /api/documents`: body id/name → dates → `parsePlacement` → **`readCreationIntent`**
(`intent_invalid`) → tabs → clash → … → resolve (genuine create only) → insert. A re-commit logs
`placement: skipped reason=existing` and never reads defaults.

## Interfaces and contracts

- **Create body:** `intent?: { mode: 'diagram' | 'draw'; kind: 'diagram' | 'event-storming' }`.
  `readCreationIntent(value)`: `undefined` or `null` → `{ ok: true, intent: null }`; an object whose
  `mode` and `kind` are members → `{ ok: true, intent: { mode, kind } }` (other fields ignored, `D22`);
  anything else → `{ ok: false }` → 400 `{ error: 'intent_invalid' }`, nothing written.
- **`GET /api/placement-defaults`** → 200 `{ defaults: PlacementDefault[] }`, in
  `PLACEMENT_DEFAULT_KEYS` order (`D20`); a stored row whose key is not in force is left out.
- **`PUT /api/placement-defaults/:key`**, body `{ folderId: string }` → 204 (`D19`). `:key` is
  `decodeURIComponent`d, so `mode:draw` and `mode%3Adraw` both name it (`D18`); an undecodable segment
  is `default_key_invalid`. Order: key → body (`default_folder_invalid` for a non-object, a missing,
  non-string or empty `folderId`, `D25`) → folder visibility (`judgeDefaultFolder`, any skip reason →
  404 `folder_not_found`) → upsert (a repeat replaces the folder, `D21`).
- **`DELETE /api/placement-defaults/:key`** → 204 whether or not a row existed;
  `default_key_invalid` first.
- Other methods or deeper paths → 404 `not_found`. No resolved owner → the shared `missingAuth()`.
- **Live client:** `apiListPlacementDefaults(owner): Promise<PlacementDefault[]>` (throws
  `ApiError`), `apiSetPlacementDefault(owner, key, folderId)`, `apiClearPlacementDefault(owner, key)`
  (throw `ApiError` with the token as `code`); `apiCreateDocument(owner, { …, intent? })` puts
  `intent` in the body only when set.
- **MCP:** `create_document` body gains `intent: creationIntentOf(tabs[0])`; output `folder` is
  `"Generated"` when the created `document.folderId` is null, else the folder's name (`D24`).

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
| Default's team left, or caller now a guest path               | Skipped `team_not_joined`                               |
| Create with intent and a folder or a team                     | Explicit wins; defaults not read                        |
| Create without intent at the root                             | Root, `via=root`; defaults not read                     |
| `intent` a string, missing `kind`, unknown `mode`             | 400 `intent_invalid`, nothing written                   |
| Re-commit of an owned id with an intent                       | Stored place kept, `placement: skipped reason=existing` |
| PUT unknown key, e.g. `kind:event-storming`                   | 400 `default_key_invalid`                               |
| PUT `{}` / `{ folderId: 3 }` / `{ folderId: "" }`             | 400 `default_folder_invalid`                            |
| PUT someone else's folder, unjoined team, guest → team folder | 404 `folder_not_found`                                  |
| DELETE a key with no row                                      | 204                                                     |
| Stored row with a key no longer in force                      | Left out of GET; never a candidate                      |
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

- Rows per owner ≤ `PLACEMENT_DEFAULT_KEYS.length` (2).
- A create with an intent at the root adds one primary-key-prefix read, then per candidate key one
  folder read and at most one membership read: worst case 1 + 2 × keys = 5 point reads. A create
  without an intent, or with an explicit place, adds none.
- PUT: at most two point reads and one upsert. GET: one read of ≤ 2 rows.

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

| Rule                                                                 | Test                                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Keys, intent derivation and parsing, key order, telemetry types      | `packages/api-schema/src/placement-defaults.test.ts`                         |
| Default step: gate, order, skips, team and personal targets          | `apps/api/src/placement/resolve-placement.test.ts`                           |
| Routes: every answer and rejection, encoded keys, logs (real SQLite) | `apps/api/src/routes/placement-defaults.test.ts`                             |
| Create lands in the default; precedence; dangling; intent_invalid    | `apps/api/src/routes/document-create-default-folder.test.ts`                 |
| Deletion and migration, the account's row winning                    | `apps/api/src/db/account-owner-columns.test.ts`, `account.test.ts`           |
| Dispatch, owner scope, route labels                                  | `apps/api/src/route-resources.test.ts`, openapi parity tests                 |
| Client functions and the create body                                 | `apps/live/lib/api/placement-defaults.test.ts`, `api-client.test.ts`         |
| Import and Drive copy send the intent                                | `apps/live/lib/board-scene-import.test.ts`, `drive/livediagram-port.test.ts` |
| MCP create sends the intent and names the folder                     | `apps/mcp/src/tools.test.ts`                                                 |

## Constants and configuration

| Constant                 | Value                           | Provenance                                      | Safe range                       |
| ------------------------ | ------------------------------- | ----------------------------------------------- | -------------------------------- |
| `PLACEMENT_DEFAULT_KEYS` | `['mode:diagram', 'mode:draw']` | Spec "Default keys"                             | Members of the key grammar       |
| `DEFAULT_KEY_DIMENSIONS` | `['kind', 'mode']`              | Spec "Precedence"                               | Most specific first              |
| `CREATION_MODES`         | `['diagram', 'draw']`           | [Draw mode](../../023-whiteboard/whiteboard.md) | The editor modes                 |
| `CREATION_KINDS`         | `['diagram', 'event-storming']` | Spec "Creation intent"                          | Tab kinds other than legacy ones |
| Rate limit               | `WRITE_RATE_LIMITER`            | `apps/api/wrangler.toml`                        | Shared with every write          |

No environment variable or binding is added.

## Telemetry

`placementDefaultTelemetryType(key)` derives the closed type from the key: `Default` + PascalCase of
each part (`mode:draw` → `DefaultModeDraw`). The surfaces that set and clear defaults fire
`Folder·Changed·<type>` and `Folder·Cleared·<type>` before the write; no surface exists yet, so no
emitter and no dashboard card are added here.

## Defaults ledger

D17 to D25 in [DEFAULTS.md](DEFAULTS.md).
