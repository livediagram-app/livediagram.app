# The move from the historical livediagram.app: blueprint

Derived from [migrate.md](../migrate.md) and [migrating-from-clerk.md](../migrating-from-clerk.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term           | Identifier                               | Meaning                                     |
| -------------- | ---------------------------------------- | ------------------------------------------- |
| Snapshot       | `migrate snapshot`                       | A D1 export into a local SQLite file        |
| Bundle         | `migrate plan`                           | The whole migration, deterministic, on disk |
| Ledger         | local, beside the bundle                 | What each `apply` step wrote                |
| Splitter       | `splitOldDocument`, `splitLocalDocument` | An old document divided by product          |
| Migration door | `PUT /api/internal/items/:id/migration`  | Each app's door for a moved document        |

## Interfaces and contracts

The commands and their flags are in [docs/migration.md "Tooling"](../../../../../docs/migration.md#tooling) and
`apps/migrate/README.md`. The contract is `packages/migration/src/contract.ts`.

## Security and trust

Each `apply` step holds only its side's credentials; `verify` only reads. The migration door takes
`MIGRATION_KEY` or the app's `INDEX_KEY`.

## Performance and limits

Run from a laptop, never deployed, so it costs no Worker time beyond the writes it makes.

## Observability

The command prints its reports to the terminal (`plan`'s bundle path, `apply`'s ledger, `verify`'s counts); a failure
prints the usage and exits non-zero. Nothing is logged remotely.

## Files

| File                                               | Role                                                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/migrate/src/apply.ts`          | `migrate apply <bundle> --env staging\|production [--dry-run]` (docs/migration.md "Tooling"): runs a bundle's steps in the manifest's order (accounts, index, media; the R2… |
| `liveworkspace/apps/migrate/src/cli.ts`            | The migrate command (README.md is the runbook): migrate snapshot <export.sql> <out.sqlite> migrate plan <snapshot> --clerk <users.csv> --accounts <existing-accounts.json>…  |
| `liveworkspace/apps/migrate/src/hooks.ts`          | The splitter's hooks (SplitHooks in @liveworkspace/migration), wired to the products' real code: - upgradeTab: livediagram's stored-tab upgrades without its Pages and Pla…  |
| `liveworkspace/apps/migrate/src/ids.ts`            | Deterministic ids and the one-way names the new side keys people by                                                                                                          |
| `liveworkspace/apps/migrate/src/ledger.ts`         | The ledger (docs/migration.md "Writing without overwriting"): a local SQLite file kept with the bundles, holding what every earlier apply wrote, row by row, with the vers…  |
| `liveworkspace/apps/migrate/src/owner-map.ts`      | The owner map (docs/migration.md, step 1): every old owner id to the id it has on the new side                                                                               |
| `liveworkspace/apps/migrate/src/page-geometry.ts`  | Where each page of an old Pages tab sat on its canvas, for the splitter's `pageRects` hook (docs/migration.md, step 3: an element goes with the page its centre is on).      |
| `liveworkspace/apps/migrate/src/pictures.ts`       | The pictures frozen references keep (docs/migration.md, step 3: "each keeps its last picture")                                                                               |
| `liveworkspace/apps/migrate/src/plan/accounts.ts`  | The accounts database (docs/migration.md, step 1): the Clerk users, teams and their members, live API tokens, settings, the onboarding emails' stamps and the legacy guest…  |
| `liveworkspace/apps/migrate/src/plan/community.ts` | Community (docs/migration.md, step 5): the old posts with their tags, likes, copies and open reports, each post pointing at the part that holds what was posted (the part …  |
| `liveworkspace/apps/migrate/src/plan/context.ts`   | What every part of the plan shares: the snapshot, the owner map, the ledger's view, the time the plan stands at, the writers for each database and the report it fills.      |
| `liveworkspace/apps/migrate/src/plan/documents.ts` | The documents (docs/migration.md, steps 2 to 4): each old document read raw, split by product, its parts' rooms written for the apps' migration doors, its pictures drawn,…  |
| `liveworkspace/apps/migrate/src/plan/files.ts`     | The bundle's non-SQL files, written as they are made: the rooms (one JSON file per part, listed in order in rooms/rooms.jsonl), the R2 copies (r2/images.json) and the pic…  |
| `liveworkspace/apps/migrate/src/plan/folders.ts`   | Folders and placement defaults into the index (docs/migration.md, step 2.3)                                                                                                  |
| `liveworkspace/apps/migrate/src/plan/index.ts`     | `migrate plan` (docs/migration.md "Tooling"): the whole migration as a bundle on disk, written once and read by apply and verify                                             |
| `liveworkspace/apps/migrate/src/plan/kv.ts`        | The old MCP server's dynamic client registrations (docs/migration.md, step 1.5: "Connected AI tools"): every `client:<id>` of its OAUTH_KV, the same key and value the new…  |
| `liveworkspace/apps/migrate/src/plan/media.ts`     | The old images into the media service (docs/migration.md, step 4.1): each `images` row under its old id, its owner through the owner map as the media service keys owners,…  |
| `liveworkspace/apps/migrate/src/plan/report.ts`    | report.json (docs/migration.md "Tooling"): what the plan found and decided, for the rehearsal's read-through and step 9's checks                                             |
| `liveworkspace/apps/migrate/src/plan/shares.ts`    | A document's share links and Shared with me rows into the index (docs/migration.md, step 2.3: "keeping each link's token so old share URLs still work").                     |
| `liveworkspace/apps/migrate/src/plan/timeline.ts`  | The old Timeline into the index's (docs/migration.md, step 2: "History is kept"): each old event with its original time, its actor through the owner map, and `detail: {"i…  |
| `liveworkspace/apps/migrate/src/read-documents.ts` | Reads the old documents out of a snapshot, one at a time, as the splitter takes them (OldDocumentInput): the `documents` row, its tabs through `document_tabs` in order, i…  |
| `liveworkspace/apps/migrate/src/run.ts`            | The real Runner and Http apply and verify use (the tests hand in fakes): a child process per wrangler run, with only the environment it was given, and fetch.                |
| `liveworkspace/apps/migrate/src/snapshot.ts`       | `migrate snapshot <export.sql> <out.sqlite>` (docs/migration.md "Tooling"): loads a `wrangler d1 export` of the old database into a local SQLite file that everything afte…  |
| `liveworkspace/apps/migrate/src/sql.ts`            | The SQL the plan writes for each new-side database (docs/migration.md "Writing without overwriting"), chunked for `wrangler d1 execute --remote --file`.                     |
| `liveworkspace/apps/migrate/src/targets.ts`        | Where apply writes, per environment: the liveworkspace services' D1 databases and media bucket (each named by its own wrangler.toml, which pins the liveworkspace account)…  |
| `liveworkspace/apps/migrate/src/verify.ts`         | `migrate verify <bundle> --env …` (docs/migration.md, step 9): read-only checks that what the bundle wrote is on the new side                                                |
| `packages/migration/src/contract.ts`               | The one contract between the parts of the migration from the historical livediagram.app (docs/migration.md, "Tooling"): the migrate tool (liveworkspace/apps/migrate) buil…  |
| `packages/migration/src/index.ts`                  |                                                                                                                                                                              |
| `packages/migration/src/page-index.ts`             | Which page a point falls on, for splitting a Pages tab by page (docs/migration.md, step 3): a uniform grid over the pages' rectangles, so each lookup reads a handful of c…  |
| `packages/migration/src/person-ids.ts`             | Card and sheet people across the move (docs/migration.md, step 3)                                                                                                            |
| `packages/migration/src/sha256.ts`                 | SHA-256 in plain synchronous code (FIPS 180-4), for the splitter's card-person ids: the splitter is synchronous (it runs inside a Worker request, a Node loop and a browse…  |
| `packages/migration/src/split-fixtures.ts`         | Hand-written fixtures for the splitter's tests, in the old site's stored shapes (docs/migration.md, step 3): tab bodies as `tabs.data` held them, and hooks standing in fo…  |
| `packages/migration/src/split.ts`                  | The splitter (docs/migration.md, step 3 and "Tooling"): one old livediagram document in, one payload per app out.                                                            |

## Constants and configuration: named constants

| Constant                       | Value                                                             | File                |
| ------------------------------ | ----------------------------------------------------------------- | ------------------- |
| `LIVEDIAGRAM_MEDIA_APP`        | `'livediagram.app'`                                               | `ids.ts`            |
| `SHARE_PASSWORD_ITERATIONS`    | `100_000`                                                         | `ids.ts`            |
| `TABLE_ORDER`                  | `(object or list, see file)`                                      | `context.ts`        |
| `KIND_OF`                      | `(object or list, see file)`                                      | `context.ts`        |
| `DAY_MS`                       | `86_400_000`                                                      | `context.ts`        |
| `BUNDLE_FORMAT`                | `1`                                                               | `index.ts`          |
| `KV_MIN_TTL_SECONDS`           | `60`                                                              | `kv.ts`             |
| `DBS`                          | `['accounts', 'index', 'media', 'community']`                     | `sql.ts`            |
| `EMPTY_LEDGER`                 | `{ version: () => undefined }`                                    | `sql.ts`            |
| `BATCH_ROWS`                   | `100`                                                             | `sql.ts`            |
| `BATCH_BYTES`                  | `90_000`                                                          | `sql.ts`            |
| `CHUNK_STATEMENTS`             | `5_000`                                                           | `sql.ts`            |
| `CHUNK_BYTES`                  | `6_000_000`                                                       | `sql.ts`            |
| `REPO_ROOT`                    | `resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')` | `targets.ts`        |
| `OLD_IMAGES_BUCKET`            | `'livediagram-images'`                                            | `targets.ts`        |
| `OAUTH_KV`                     | `(object or list, see file)`                                      | `targets.ts`        |
| `MCP_CONFIG`                   | `join('livediagram', 'apps', 'mcp', 'wrangler.toml')`             | `targets.ts`        |
| `TARGET_ACCOUNT_ID`            | `'851be7d244b76a6557bcbe6c4ded80f5'`                              | `targets.ts`        |
| `SOURCE_ACCOUNT_VAR`           | `'MIGRATE_SOURCE_ACCOUNT_ID'`                                     | `targets.ts`        |
| `SOURCE_TOKEN_VAR`             | `'MIGRATE_SOURCE_API_TOKEN'`                                      | `targets.ts`        |
| `TARGET_TOKEN_VAR`             | `'MIGRATE_TARGET_API_TOKEN'`                                      | `targets.ts`        |
| `KEY_COLUMNS`                  | `(object or list, see file)`                                      | `verify.ts`         |
| `MIGRATION_APPS`               | `(object or list, see file)`                                      | `contract.ts`       |
| `OLD_SCHEMA_LEVEL`             | `'0099_workbench_workspace.sql'`                                  | `contract.ts`       |
| `LEGACY_GUEST_SIGNING_LIVE_AT` | `1790337600000`                                                   | `contract.ts`       |
| `OLD_ITEM_PERSON_PREFIX`       | `'livediagram-item-person:'`                                      | `person-ids.ts`     |
| `PLANNER_ITEM_PERSON_PREFIX`   | `'liveplanner-item-person:'`                                      | `person-ids.ts`     |
| `OWNER`                        | `'user_ali'`                                                      | `split-fixtures.ts` |
| `NEW_OWNER`                    | `'acct_ali'`                                                      | `split-fixtures.ts` |
| `PART_ORIGINS`                 | `(object or list, see file)`                                      | `split.ts`          |

## Testing

3 test files:

- `packages/migration/src/sha256.test.ts`
- `packages/migration/src/split.perf.test.ts`
- `packages/migration/src/split.test.ts`
