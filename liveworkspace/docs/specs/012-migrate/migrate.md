# The move from the historical livediagram.app

The historical livediagram.app runs on the previous Cloudflare account, signs people in with Clerk, and keeps
everything in one D1 database, one R2 bucket and its `DocumentRoom` objects. The move copies its people and
documents onto the liveworkspace platform, splits each mixed document by product (Pages to livedocuments, logo and
wireframe pages to livedesign, Plan tabs to liveplanner), tells everyone once, and then switches the
`livediagram.app` zone over. livediagram is the only source: the other apps have no data from before accounts moved.

The full design, its rules (the old account is the source and stays untouched; nothing made on either side is lost;
ids stay; every step can re-run), each step and the decisions taken are in [docs/migration.md](../../../../docs/migration.md)
at the repository root. The runbook is [apps/migrate/README.md](../../../apps/migrate/README.md). What it means for
sign-in is [migrating-from-clerk.md](migrating-from-clerk.md).

## The parts

- **`@liveworkspace/migration`** (`packages/migration`): the contract every part shares (`MigrationRoomPayload`,
  `MovedParts`, `OLD_SCHEMA_LEVEL`) and the splitter (`splitOldDocument`, `splitLocalDocument`). Pure TypeScript with
  no product imports, so the tool, the Workers and the editor share it.
- **`@liveworkspace/migrate`** (`apps/migrate`): the Node command run from a laptop, never deployed, in four steps:
  `snapshot` (a D1 export into a local SQLite file), `plan` (the whole migration as a deterministic bundle on disk),
  `apply` (each step with only that side's credentials, recorded in a local ledger) and `verify` (row counts read
  back).
- **The apps' migration door** (`@liveworkspace/index-app` `migration-door.ts`, wired in each app's api):
  `PUT /api/internal/items/:id/migration`, behind `MIGRATION_KEY` or the app's `INDEX_KEY`.
- **Accounts and the index**: the `legacy_guest` rows and their claim, and the index's legacy guest merge and
  migration handoff, for returning guests and their Local only documents.

## Why this shape

- **Split from the raw rows.** The new livediagram drops Pages and Plan on read; reading old tabs through it would
  lose them. The splitter reads the stored JSON and the Plan tables itself.
- **A bundle on disk, then apply.** Planning is pure and repeatable (the same snapshot and ledger make a
  byte-identical bundle), so it can be read and checked before anything is written.
- **Write without overwriting.** Every row is keyed by its old id; a catch-up run updates a row only while it still
  holds what the last run wrote, so work done on the new side is never written over.
