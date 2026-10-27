# @liveworkspace/migrate

The one-off move from the historical livediagram.app onto liveworkspace (`docs/migration.md` at the repository
root, "Tooling"). It runs from a laptop on Node 22.13 or later and is never deployed. Four commands, each reading
what the one before wrote:

```sh
cd liveworkspace/apps/migrate
corepack pnpm migrate snapshot <export.sql> <snapshot.sqlite>
corepack pnpm migrate plan <snapshot.sqlite> --clerk <users.csv> --accounts <existing-accounts.json> \
  [--ledger <ledger.sqlite>] [--oauth-kv <oauth-kv.json>] [--no-pictures] --out <bundle-dir>
corepack pnpm migrate apply <bundle-dir> --env staging|production --ledger <ledger.sqlite> [--dry-run] [--concurrency 8]
corepack pnpm migrate verify <bundle-dir> --env staging|production [--out verify.json]
```

`snapshot` and `plan` only ever read local files. `apply` is the only command that writes anywhere, and `verify` only
runs single `SELECT`s.

## Before you start

You need these files, all exported by hand and kept together in one folder outside the repository:

| File                     | How to get it                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export.sql`             | `wrangler d1 export livediagram --remote --output export.sql` on the old account. Note the Time Travel bookmark too.                                                                                                                              |
| `users.csv`              | Clerk Dashboard → Users → Export (needs `id` and `primary_email_address`).                                                                                                                                                                        |
| `existing-accounts.json` | `wrangler d1 execute liveworkspace-accounts --remote --json --command 'SELECT id, email FROM "user"'`, taken **right before** `plan`. A stale list can make an imported Clerk row clash with an account made since, and that SQL file then fails. |
| `oauth-kv.json`          | The old MCP's `OAUTH_KV`: a JSON array of `{ "name", "value", "expiration"? }` for every `client:` key (`kv key list`, then each value). Optional.                                                                                                |
| `ledger.sqlite`          | Made by the first `apply`. Keep it with the bundles; every later `plan` and `apply` needs the same file.                                                                                                                                          |

## The bundle

`plan` writes one folder, once (it refuses a folder that isn't empty). Planning the same snapshot with the same
files and ledger gives the same bundle, byte for byte.

```
manifest.json            the steps apply runs, in order, with the bundle id and the ledger generation it was planned at
owner-map.json           every old owner and the id it has now (Clerk matches, aliases, guests, unknown ids)
sql/<db>/NNNN.sql        accounts, index, media, community: numbered chunks of batched statements
ledger/<db>/NNNN.jsonl   the ledger rows each chunk writes, recorded once the chunk has run
r2/images.json           every object to put in the media bucket (old images by key, drawn pictures by file)
r2/pictures/<id>.png     the pictures drawn for frozen cross-product references
rooms/<app>/<id>.json    one MigrationRoomPayload per part, for each app's migration door
rooms/rooms.jsonl        the rooms in the order apply sends them
people/<app>/<owner>.json  one MigrationPersonPayload per person with shape libraries, for livediagram's person door
people/people.jsonl      the people in the order apply sends them
kv/mcp-clients.json      the MCP's client registrations, as `kv bulk put` takes them
moved-parts.json         where each split document's parts went
report.json              counts per table, cross-product references, dropped history, collisions, skipped rows
```

Read `report.json` before any apply. The lists worth checking every time: `shareCodeCaseCollisions` (two old codes
equal but for case: the older keeps it, the other is not carried), `imageCollisions` (two images that become one
owner's with the same bytes), `droppedHistory` (Timeline kinds with no new equivalent), `picturesMissing`,
`skipped`, and `ownerMap.unknownAccounts` (old account ids with no Clerk row: their documents go in under the old id,
their tokens and settings don't).

## Writing without overwriting

Every row is keyed by its old id. The first run inserts with `INSERT OR IGNORE`, so a row already on the new side is
left alone. A catch-up run (a new snapshot planned with `--ledger`) writes only what changed on the old side since
the ledger's last apply, and rewrites a row only while it still holds the value the last run wrote
(`ON CONFLICT … DO UPDATE … WHERE <table>.updated_at = <ledger value>`). A row someone has changed on the new side
since is left alone; the report's `tables` counts say how many of each. Nothing is ever deleted. A row with no time
of its own (a favourite, a refs row) is only ever inserted; a change to one is counted as `changedNotWritten`.

Rooms work the same way at the door: each app's door replaces a tab only while it still holds the revision it last
wrote, and `apply` prints the parts whose tabs were edited on the new side and left alone.

## Credentials

`apply` and `verify` never pass your shell's `CLOUDFLARE_*` variables through. Each command gets only what it needs:

| Variable                                                                             | Used for                                                                                                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MIGRATE_TARGET_API_TOKEN`                                                           | Every write on the liveworkspace account (D1, the media bucket, KV), and verify's reads. The account id comes from each service's `wrangler.toml`. |
| `MIGRATE_SOURCE_ACCOUNT_ID`, `MIGRATE_SOURCE_API_TOKEN`                              | Reading the old `livediagram-images` bucket. A read-only R2 token is enough.                                                                       |
| `MIGRATE_ORIGIN_<APP>` (`LIVEDIAGRAM`, `LIVEPLANNER`, `LIVEDOCUMENTS`, `LIVEDESIGN`) | Each app api's origin for `PUT /api/internal/items/:id/migration` (and livediagram's for `PUT /api/internal/people/:id/migration`).                |
| `MIGRATION_KEY_<APP>`                                                                | The `MIGRATION_KEY` secret set on that api for the migration.                                                                                      |
| `MIGRATE_WRANGLER` (optional)                                                        | Another wrangler command; the default is the repository's own.                                                                                     |

## Runbook

1. **Snapshot.** `migrate snapshot export.sql snapshot.sqlite`. It refuses an export whose last `d1_migrations`
   row isn't `OLD_SCHEMA_LEVEL` (`0099_workbench_workspace.sql`).
2. **Plan.** `migrate plan snapshot.sqlite --clerk users.csv --accounts existing-accounts.json --oauth-kv oauth-kv.json --out bundles/001`.
   The first plan has no `--ledger`. Read `report.json`.
3. **Rehearse on staging.** `migrate apply bundles/001 --env staging --ledger staging-ledger.sqlite --dry-run`
   prints every command and request. Then run it without `--dry-run`. Staging has its own ledger file.
4. **Verify.** `migrate verify bundles/001 --env staging`. It exits 1 when any row the bundle wrote is missing.
5. **Production.** Plan again from a fresh export (and a fresh accounts list), then apply with
   `--env production --ledger production-ledger.sqlite`.
6. **Catch-up.** Up to the switch, each new export is planned with `--ledger production-ledger.sqlite` into a new
   bundle folder, then applied with the same ledger. A bundle applies only on the ledger generation it was planned
   at, so plan again if another bundle was applied in between.

A stopped `apply` (a failed file, a door down) resumes where it stopped when run again with the same bundle and
ledger. It never repeats a finished file, object or room. It won't start another bundle until that one has
finished.

## What the apps' doors must accept

- A `MigrationRoomPayload` (`packages/migration/src/contract.ts`) at `PUT /api/internal/items/:id/migration`, with
  `Bearer MIGRATION_KEY`, answering a `MigrationDoorAnswer`. That includes a liveplanner project with zero tabs (cards
  only), and `imageOwners` naming images whose rows are already in the media service (apply runs media before rooms).
- livediagram only: a `MigrationPersonPayload` at `PUT /api/internal/people/:id/migration`, with `Bearer MIGRATION_KEY`,
  answering `{ moved, renamed }`: the person's shape libraries, added to their store once.
- Each item is already in the index, with the summary `{"imported":"1"}`, so the index's empty-item sweep leaves it
  alone. The door's first summary push should send `savedAt` as the change time, because the index keeps the later
  of the two.
- Card and sheet people ids that matched nobody in `input.people` keep their old hash (the report notes how many).
  Changeset author ids are old owner ids.

## Performance

These numbers were measured on a laptop (`test/plan.perf.test.ts`):

- **Plan:** 10,000 generated documents took 10.4 s, about 1 ms each. 1,000 of them were split and had pictures; the
  heap grew by about 31 MB. Every reader streams, and one document's rows are in memory at a time. Expect about
  2 minutes for 100,000 documents, plus pictures.
- **Pictures:** drawing one took 58 ms for a 20-element tab and 320 ms for a 200-element tab, one at a time. 10,000
  pictures would take roughly 10 to 50 minutes. Use `--no-pictures` for a quick look at a plan.
- **Apply:** R2 copies run one `wrangler r2 object get` and one `put` process per image (eight at a time by
  default). At 50,000 images that could be hours. If the rehearsal is too slow, copy with an S3 client (rclone)
  between the two buckets under the same keys instead.
- **Verify:** verify runs one `wrangler d1 execute` for every 500 keys.

## Tests

`corepack pnpm test` builds a hand-made old database from the old site's 100 migrations
(`test/fixtures/old-migrations.sql`), plans it, and runs the bundle's SQL into the new side's schemas, which are
built from this repository's own migrations. `apply` is tested with a fake runner and a fake door only. Nothing in
the tests calls wrangler or reaches a network.
