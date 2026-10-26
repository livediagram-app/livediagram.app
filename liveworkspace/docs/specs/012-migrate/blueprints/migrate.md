# The move from the historical livediagram.app: blueprint

Derived from [migrate.md](../migrate.md) and [migrating-from-clerk.md](../migrating-from-clerk.md). The spec decides;
this file only adds engineering precision, read from the code. Defaults are cited as `MIGn`. Paths are relative to the
repository root. The runbook (files to export, credentials, steps) is `liveworkspace/apps/migrate/README.md`; the
splitter's rules are `packages/migration/README.md`. This file pins what both rest on.

Scope, by file:

| File                                                                                                        | Role                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/migrate/src/cli.ts`                                                                     | The `migrate` command: `snapshot`, `plan`, `apply`, `verify`                                                                                 |
| `liveworkspace/apps/migrate/src/snapshot.ts`                                                                | A `wrangler d1 export` streamed into a local SQLite file                                                                                     |
| `liveworkspace/apps/migrate/src/plan/*.ts`                                                                  | The bundle: accounts, folders, documents, shares, timeline, media, community, kv, files, report                                              |
| `liveworkspace/apps/migrate/src/owner-map.ts`                                                               | Every old owner to its new id                                                                                                                |
| `liveworkspace/apps/migrate/src/sql.ts`                                                                     | `SqlWriter`: batched, chunked, ledger-guarded SQL                                                                                            |
| `liveworkspace/apps/migrate/src/ledger.ts`                                                                  | The local ledger: rows written, units applied, the generation                                                                                |
| `liveworkspace/apps/migrate/src/apply.ts`, `run.ts`                                                         | Running a bundle's steps; the real process runner and HTTP                                                                                   |
| `liveworkspace/apps/migrate/src/verify.ts`                                                                  | Read-only checks by key                                                                                                                      |
| `liveworkspace/apps/migrate/src/targets.ts`                                                                 | Databases, buckets, KV and credential variable names per environment                                                                         |
| `liveworkspace/apps/migrate/src/read-documents.ts`, `hooks.ts`, `page-geometry.ts`, `pictures.ts`, `ids.ts` | Reading old documents, the splitter's hooks, the old page layout, drawing frozen references, derived ids                                     |
| `packages/migration/src/contract.ts`                                                                        | The payloads every part shares: the room payload, the door's answer, moved parts, cross references, Local only parts, the legacy guest claim |
| `packages/migration/src/split.ts`, `page-index.ts`, `person-ids.ts`, `sha256.ts`                            | The splitter, its page grid, card people, a synchronous SHA-256                                                                              |

## Domain and naming

| Term           | Identifier                                                                          | Meaning                                                                                     |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Snapshot       | a local SQLite file plus `_migrate_snapshot (key, value)`                           | The export, at schema level `OLD_SCHEMA_LEVEL` `0099_workbench_workspace.sql`               |
| Bundle         | a folder; id the first 16 hex of SHA-256(`<export sha256>:<generation>:<format 1>`) | The whole migration, deterministic, written once                                            |
| Ledger         | a local SQLite file, one per environment                                            | What every earlier apply wrote, and which units finished                                    |
| Generation     | `meta.generation`                                                                   | Finished applies; a bundle applies only at the generation it was planned at                 |
| Unit           | a SQL chunk file, `r2:<key>`, `rooms:<app>/<id>`, `kv`                              | What apply records as done                                                                  |
| Part           | one `MigrationRoomPayload`                                                          | One app's share of an old document                                                          |
| Legacy guest   | `legacyGuestOwner(<old guest id>)`                                                  | An old bare-UUID guest, held by nobody until claimed                                        |
| Migration door | `PUT /api/internal/items/:id/migration`                                             | Each app's api; `Bearer MIGRATION_KEY` (bulk) or `INDEX_KEY` (a browser's Local only parts) |

## Behaviour and state

### `snapshot <export.sql> <out.sqlite>`

The export is streamed through `StatementSplitter` (cut at each `;` outside quotes and comments), skipping SQLite's
and D1's own tables, in transactions of 10,000 statements, so a multi-GB export loads in bounded memory. The
snapshot's meta records the export's SHA-256, its schema level and its time. A snapshot whose last `d1_migrations` row
isn't `OLD_SCHEMA_LEVEL` is refused and its file removed. Only ever reads a file.

### `plan <snapshot> --clerk --accounts [--ledger] [--oauth-kv] [--no-pictures] --out`

Refuses an output folder that isn't empty. "Now" is the snapshot's time and every id is derived (`uuidFromSeed` under a
fixed namespace), so the same inputs make the same bundle, byte for byte. In order:

1. The owner map: a Clerk id (`user_…`) keeps its id unless its email already has an account (`existing-accounts.json`),
   then it is that account; an `owner_aliases` guest is its account; any other bare UUID is a legacy guest; an old
   account id with no Clerk row is kept and reported (`ownerMap.unknownAccounts`).
2. Accounts (`plan/accounts.ts`): `"user"`, `team`, `team_member`, live `api_token`, `settings`, `profile`,
   `email_lifecycle`, `account_app`, `legacy_guest`. A row whose account the new side lacks is skipped and reported.
3. Folders and placement defaults (`plan/folders.ts`), parents first; a parent in another scope is dropped.
4. Documents (`plan/documents.ts`), one at a time in id order: read raw (`read-documents.ts`), split, pictures drawn
   for frozen references (unless `--no-pictures`), each part's room written, and its index rows: `items` (summary
   `{"imported":"1"}`), `favourites`, `opens`, `use_days`, `share_passwords`; media `refs` and drawn `images`.
5. Shares (`plan/shares.ts`): each old link to the part that holds what it shares, codes upper-cased (a case collision:
   the oldest keeps it, the other reported); Shared with me rows on every part, with a derived link per level where a
   part holds none.
6. Timeline (`plan/timeline.ts`): each old event once as `imp:<old id>`, its original time, its actor mapped, detail
   `{"imported":"1"}`; a document's event on the part that kept the id; a team's or token's under `liveworkspace`; a
   kind with no equivalent dropped and counted.
7. Media (`plan/media.ts`): each old `images` row under its old id, owner mapped, app `livediagram.app`, and an R2 copy
   by key; two that become one owner's with the same bytes keep the first (`imageCollisions`).
8. Community (`plan/community.ts`): posts, tags, likes, copies, open reports, each post pointing at the part its share
   link went to; a post whose content went to livedocuments or livedesign is reported and not carried.
9. KV (`plan/kv.ts`): every `client:<id>` of the old MCP's `OAUTH_KV`, with the same absolute expiry.
10. The manifest, `owner-map.json`, `moved-parts.json` and `report.json` (lists capped, full counts kept).

### How each row is written (`SqlWriter`)

| Ledger says                        | Statement                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| never written                      | `INSERT OR IGNORE`, batched: up to 100 rows or 90,000 bytes a statement            |
| written, unchanged on the old side | nothing                                                                            |
| written, changed, with a guard     | `INSERT … ON CONFLICT … DO UPDATE … WHERE <table>.<guard> = <the version written>` |
| written, changed, no guard         | nothing; counted `changedNotWritten`                                               |
| a `merge` table                    | `ON CONFLICT DO UPDATE SET <merge>` (filling empty stamps, adding an opt-out)      |

Nothing is ever deleted. Statements stay in each database's table order (parents first). Chunk files close at 5,000
statements or 6,000,000 bytes. Each chunk's ledger rows go to `ledger/<db>/NNNN.jsonl`.

### `apply <bundle> --env --ledger [--dry-run] [--concurrency 8]`

1. `--concurrency` must be a whole number of at least 1. The ledger `begin`s the bundle: another bundle in progress
   refuses ("finish that first"); a generation mismatch refuses ("plan again"). A dry run only notes it.
2. The manifest's steps, in order: SQL `accounts`, `index`, `media` (`wrangler d1 execute <db> --remote --file`); R2
   (`wrangler r2 object get` from `livediagram-images` with the source credentials, its SHA-256 checked against the
   plan's, then `put` into the media bucket with the target's; drawn pictures from `r2/pictures/`); rooms (`PUT` each
   part to its app's door, eight at a time; non-2xx stops the run; `edited` tabs collected); SQL `community`; KV
   (`wrangler kv bulk put`, leaving out registrations about to lapse).
3. Each unit is marked done in the ledger, with its rows, as soon as it succeeds; a finished unit is skipped on a
   re-run. When every step is done the ledger's generation goes up by one.
4. The summary prints what ran, what was skipped, and the parts whose tabs were edited on the new side and left alone.

Every wrangler run gets only `PATH`, `HOME`, `TMPDIR`, `LANG`, `NODE_OPTIONS`, `XDG_CONFIG_HOME` and the one side's
token (no ambient `CLOUDFLARE_*`), with prompts and telemetry off; secrets are masked in what is printed.

### `verify <bundle> --env [--out]`

Every key the bundle's ledger files name is looked up by its table's primary key (`KEY_COLUMNS`), 500 keys a query,
and each table counted. Only one `SELECT` (or `WITH … SELECT`) per command is allowed. Exits 1 when any key is missing;
usage errors exit 2.

### The apps' side

- The migration door takes a `MigrationRoomPayload` (`v: 1`, app, id, name, owner, team, times, source, deck,
  `opensIn`, `tabKind`, tabs, changesets, image grants and owners, Plan data for liveplanner), writes the room with
  the given times, never deletes, and replaces a tab only while it holds the revision the door last wrote; it answers
  `{ written, edited, meta }`. A plain 404 when no key is set.
- A browser's Local only record goes to livediagram's `POST /api/migration/local-parts`, which splits it
  (`splitLocalDocument`), keeps livediagram's tabs in the browser, and hands every other part to the index's
  `POST /api/index/app/migration/handoff` ([guest-merge.md](../../004-index/blueprints/guest-merge.md)).
- A returning legacy guest is claimed through livediagram's `POST /api/legacy-guest/claim` and accounts'
  `internal/legacy-guests/claim` ([sessions-and-guests.md](../../003-accounts/blueprints/sessions-and-guests.md)): an
  HMAC-SHA-256 signature of the bare id, or for an unsigned id, an old `participants.created_at` before
  `LEGACY_GUEST_SIGNING_LIVE_AT` (1790337600000).

## Data and persistence

The ledger:

| Table     | Key              | Holds                           |
| --------- | ---------------- | ------------------------------- |
| `rows`    | `(db, tbl, key)` | the version written, as JSON    |
| `applied` | `(bundle, unit)` | `done_at` of each finished unit |
| `meta`    | `key`            | `generation`, `in_progress`     |

All three `WITHOUT ROWID`. Tables written on the new side, with the keys verify reads:

| Database  | Tables (key)                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| accounts  | `"user"` (id), `team` (id), `team_member` (id), `api_token` (id), `settings` (owner_id, scope), `email_lifecycle` (user_id), `account_app` (user_id, app), `profile` (owner_id), `legacy_guest` (id)                                                                                             |
| index     | `folders`, `items` (id), `favourites`, `opens` (person_id, item_id), `use_days` (+ day), `share_links` (code), `share_passwords` (item_id), `shared_with` (person_id, item_id), `placement_defaults` (person_id, default_key), `timeline_events` (id), `timeline_event_scopes` (scope, event_id) |
| media     | `images` (id), `refs` (app, document, image_id)                                                                                                                                                                                                                                                  |
| community | `posts` (id), `post_tags` (post_id, tag), `likes` (post_id, liker_key), `copies` (post_id, copier), `reports` (post_id, reporter_key)                                                                                                                                                            |

Plus the media bucket's objects, each app's rooms, and the livediagram MCP's `OAUTH_KV` `client:` keys.

## Errors and edge cases

| Case                                      | Behaviour                                                     |
| ----------------------------------------- | ------------------------------------------------------------- |
| An export at another schema level         | `snapshot` refuses and removes its file                       |
| A non-empty `--out`                       | `plan` refuses                                                |
| A bundle planned at an older generation   | `apply` refuses: plan again                                   |
| A stopped apply                           | resumes with the same bundle and ledger; never repeats a unit |
| R2 bytes that don't match the plan's hash | the run stops                                                 |
| A door answering non-2xx                  | the run stops; the room is not marked                         |
| A row changed on the new side since       | the guard leaves it; counted                                  |
| A case collision of share codes           | the oldest keeps the code; the other reported                 |
| A card person nobody named                | the old hash kept; counted                                    |

## Security and trust

- `snapshot` and `plan` read only local files; `apply` is the only writer; `verify` runs only `SELECT`s.
- The source and target credentials are never in one command; the source token only reads the old bucket.
- The doors take only `MIGRATION_KEY` (or the app's `INDEX_KEY` for the handoff), and answer 404 without one.

## Performance and limits

Measured in `liveworkspace/apps/migrate/test/plan.perf.test.ts`: planning 10,000 generated documents took 10.4 s,
heap growth about 31 MB; one picture 58 ms (20 elements) to 320 ms (200). Every reader streams; one document is in
memory at a time. The split is linear (`split.perf.test.ts`: a tab over 1 MB, 5,000 elements over 20 mixed pages, to a
CPU budget). Apply's R2 copies are two processes per image, eight at a time.

## Observability

Everything prints to the terminal: `snapshot`'s meta, `plan`'s bundle id and counts, `apply`'s commands (secrets
masked, `[dry-run]` marked) and summary, `verify`'s table counts (and `--out` JSON). Nothing is logged remotely.

## Testing

| Test                                                    | Pins                                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/migrate/test/plan.test.ts` (18)     | planning the hand-made old database (`test/fixtures/old-migrations.sql`, 100 migrations) and running its SQL into this repository's schemas |
| `liveworkspace/apps/migrate/test/parts.test.ts` (10)    | split documents' parts, rooms and references                                                                                                |
| `liveworkspace/apps/migrate/test/apply.test.ts` (7)     | apply with a fake runner and door: order, resume, refusals, dry run                                                                         |
| `liveworkspace/apps/migrate/test/planner.test.ts` (2)   | determinism                                                                                                                                 |
| `liveworkspace/apps/migrate/test/plan.perf.test.ts` (2) | the plan's time and heap budgets                                                                                                            |
| `packages/migration/src/split.test.ts` (27)             | the splitter's rules                                                                                                                        |
| `packages/migration/src/split.perf.test.ts` (1)         | the split's CPU budget                                                                                                                      |
| `packages/migration/src/sha256.test.ts` (3)             | the synchronous SHA-256 against `node:crypto`                                                                                               |

Nothing in the tests calls wrangler or the network.

## Constants and configuration

`OLD_SCHEMA_LEVEL` `0099_workbench_workspace.sql`, `LEGACY_GUEST_SIGNING_LIVE_AT` 1790337600000 (`contract.ts`);
`OLD_ITEM_PERSON_PREFIX` `livediagram-item-person:`, `PLANNER_ITEM_PERSON_PREFIX` `liveplanner-item-person:`
(`person-ids.ts`); `BUNDLE_FORMAT` 1 (`plan/index.ts`); `TRANSACTION_STATEMENTS` 10,000 (`snapshot.ts`);
`BATCH_ROWS` 100, `BATCH_BYTES` 90,000, `CHUNK_STATEMENTS` 5,000, `CHUNK_BYTES` 6,000,000, `DBS` (`sql.ts`);
`KEYS_PER_QUERY` 500 (`verify.ts`); `DEFAULT_CONCURRENCY` 8 (`apply.ts`); `KV_MIN_TTL_SECONDS` 60 (`plan/kv.ts`);
`SHARE_PASSWORD_ITERATIONS` 100,000, `LIVEDIAGRAM_MEDIA_APP` `livediagram.app` (`ids.ts`); `OLD_IMAGES_BUCKET`
`livediagram-images`, `MCP_CONFIG`, `TARGET_ACCOUNT_ID` (the liveworkspace account), `SOURCE_ACCOUNT_VAR`,
`SOURCE_TOKEN_VAR`, `TARGET_TOKEN_VAR`, `MIGRATE_ORIGIN_<APP>`, `MIGRATION_KEY_<APP>` (`targets.ts`). Databases and the
media bucket are read from each service's `wrangler.toml` (checked by a test).

## Defaults ledger

- `MIG1`: a row with no time of its own (a favourite, a refs row) is only ever inserted; a later change to it is
  counted, never written.
- `MIG2`: an MCP client registration with less than a minute to live is left out of the KV put rather than refused.
- `MIG3`: of two share codes equal but for case, the older keeps it.
