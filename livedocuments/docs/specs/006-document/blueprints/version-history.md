# Version history blueprint

Derived from [Version history](../version-history.md). Rules are numbered `VH<n>`; each maps to a test.

## Domain and naming

| Spec term         | Identifier                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| version           | a `tab_versions` row, or a `tab_named_versions` row with its `snapshots` row; `VersionSummary` on the wire (`@livedocuments/api-schema` `versions.ts`) |
| kind              | `VersionKind` = `'idle' \| 'agent' \| 'restore' \| 'manual'`                                                                                           |
| named version     | a `tab_versions` row whose `name` is not NULL, or a version in the snapshots' store (always named)                                                     |
| the two stores    | `tab_versions` (the old store) and the snapshots' store (`db/named-versions.ts` over `@liveworkspace/snapshots/server`)                                |
| automatic version | a row whose `name` is NULL                                                                                                                             |
| restore           | `restoreVersion` (`apps/api/src/versions/restore.ts`)                                                                                                  |
| make a copy       | `copyVersion` (`apps/api/src/versions/copy.ts`)                                                                                                        |
| what changed      | `versionChanges(version, now)` (`@livedocuments/document` `version-changes.ts`)                                                                        |
| Version History   | `VersionHistoryPanel` (`apps/editor/components/versions/`)                                                                                             |

## Data and persistence

Schema step 8 (`document-room/document-schema.ts` `V8`, from `versions/version-schema.ts`):

```sql
CREATE TABLE IF NOT EXISTS tab_versions (
  id           TEXT    PRIMARY KEY,            -- 'v_' + 16 hex
  tab_id       TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev          INTEGER NOT NULL,               -- the tab revision it holds
  kind         TEXT    NOT NULL CHECK (kind IN ('idle', 'agent', 'restore', 'manual')),
  name         TEXT    NULL,                   -- named when not NULL
  author_id    TEXT    NULL,                   -- for anonymising; never on the wire
  author_name  TEXT    NULL,
  author_color TEXT    NULL,
  tab_name     TEXT    NOT NULL,               -- the tab's name then
  data         TEXT    NOT NULL,               -- tabs.data as it was (the body minus id and name)
  bytes        INTEGER NOT NULL,               -- length(CAST(data AS BLOB))
  element_count INTEGER NOT NULL,
  saved_at     INTEGER NOT NULL,               -- tabs.updated_at as it was
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tab_versions_by_tab ON tab_versions (tab_id, saved_at);
CREATE INDEX IF NOT EXISTS tab_versions_by_rev ON tab_versions (tab_id, rev);
```

- **VH1 idle trigger.** `tab_versions_idle BEFORE UPDATE OF data ON tabs WHEN NEW.data IS NOT OLD.data AND
OLD.updated_at <= NEW.updated_at - VERSION_IDLE_MS` inserts OLD as kind `idle` unless a row for `(OLD.id,
OLD.rev)` exists. A statement the revision trigger aborts takes the insert with it.
- **VH2 prune trigger.** `tab_versions_prune AFTER INSERT ON tab_versions` deletes, for `NEW.tab_id`, unnamed rows
  past the newest `VERSION_AUTO_MAX` (by `created_at DESC, rowid DESC`), unnamed rows with `created_at < NEW.created_at -
VERSION_AUTO_MAX_DAYS`, and unnamed rows whose running byte total from the newest passes
  `VERSION_AUTO_MAX_BYTES` (a window `SUM`). The newest row is never pruned by bytes.
- **VH25 retention row (Pro).** Schema step 24 (`versions/version-retention-schema.ts`, after the Automations steps): `version_retention`, one row
  (`id = 1`, `max_age_ms` nullable, `max_count`, `max_bytes`), inserted with the spec's Bounds, and
  `tab_versions_prune` dropped and made again to read it: age only where `max_age_ms IS NOT NULL`, count by a window
  `ROW_NUMBER`, bytes by the window `SUM`. An existing room runs the step once and prunes exactly as before.
  `versionRetentionOf(historyDays)` (`versions/version-retention.ts`) maps a tier to the row: 7 days / 50 / 16 MiB,
  or null / `VERSION_AUTO_MAX_PAID` (500) / `VERSION_AUTO_MAX_BYTES_PAID` (64 MiB). `learnVersionRetention(ctx)` runs
  as each request reaches the room (`answerDocumentRequest`): nothing with Pro off, nothing without a grant that names
  the owner, at most once an hour per room, through `waitUntil`; it reads `confirmedEntitlement` and writes the row
  only for a confirmed tier. The list route awaits the same write (`applyVersionRetention`) and answers `retention`.
  `maintain` deletes by the row's age (VH6) and, with Pro off, first sets the row back to the Bounds.
- **VH3 one per revision.** Every insert guards `NOT EXISTS (… tab_id = ? AND rev = ?)`; no UNIQUE index, so no
  conflict can abort the write that fired it.
- **VH4 agent capture.** `agentVersionStatement` inserts the stored row as kind `agent` before a changeset's tab
  write in the same batch (`writeChangeset`'s `preStatements`), when a token writes, the tab exists, and no
  `agent_changesets` row of that token on that tab has `created_at > now - VERSION_AGENT_BURST_MS`. The page route's
  page-only write runs it first, as its own statement.
- **VH5 restore capture.** The restore reads the version for the stored revision, or inserts one (kind `restore`)
  in the restore's batch with an id minted in the api; that id is `undoVersionId`.
- **VH6 upkeep.** `maintain` deletes unnamed rows older than the retention row's `max_age_ms` (VH25; none where it
  is null) beside the changeset retention. With Pro off the row holds `VERSION_AUTO_MAX_DAYS`.
- **VH7 anonymise.** `anonymiseDocument` rewrites `tab_versions.data` through `anonymiseJsonText` where
  `instr(data, person)`, and sets `author_id`/`author_name` to the anonymised person.
- **VH8 copies.** A document copy (`exportCopy`) reads `tabs` only: no versions travel.

Schema step 11 (`document-schema.ts` `V11`, from `versions/named-store-schema.ts`), additive and idempotent: the
platform's `SNAPSHOT_SCHEMA` (SN3, `CREATE ... IF NOT EXISTS`, the same SQL its store runs on first use), then

```sql
CREATE TABLE IF NOT EXISTS tab_named_versions (
  snapshot_id   TEXT    PRIMARY KEY,          -- the snapshots row ('s_' + 16 hex), item_id 'tab:' || tab_id
  tab_id        TEXT    NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL,             -- the tab revision it holds
  tab_name      TEXT    NOT NULL,             -- the tab's name then
  element_count INTEGER NOT NULL,
  saved_at      INTEGER NOT NULL              -- tabs.updated_at as it was
);
CREATE INDEX IF NOT EXISTS tab_named_versions_by_tab ON tab_named_versions (tab_id, rev);
CREATE TRIGGER IF NOT EXISTS tab_named_versions_gone AFTER DELETE ON tab_named_versions
BEGIN
  DELETE FROM snapshot_chunks WHERE snapshot_id = OLD.snapshot_id;
  DELETE FROM snapshots WHERE id = OLD.snapshot_id;
END;
```

- **VH20 Name This Version through the snapshots' store.** `keepNamedVersion` reads the tab row once (`rev`, `name`,
  `data`, `element_count`, `updated_at`) and calls `takeSnapshot` (SN31) with item id `tab:<tabId>`, kind `manual`,
  `keep: null`, and `alongside` the `tab_named_versions` insert guarded `NOT EXISTS` for `(tab_id, rev)` followed by a
  delete of the snapshot row when no revision row names it (a lost race keeps nothing; the route names what holds the
  revision on the next try). A throw falls back to `copyTabStatement` (kind `manual`), logged `[versions] refused`
  `store`.
- **VH21 read both.** `listVersions` runs one query per store (`tab_versions` by `(tab_id, saved_at)`; `tab_named_versions`
  joined to `snapshots` by `tab_id`), merges by `saved_at DESC, rev DESC`, and drops an unnamed `tab_versions` row whose
  revision a snapshots' store version holds. `getVersion`, `versionAtRev` (the snapshots' store first) and
  `namedVersionCount` (the sum) read both. A throw from the snapshots' store reads as empty, logged `[versions] refused`
  `store`; `tab_versions` is always read on its own.
- **VH22 names in the snapshots' store.** A rename is `renameSnapshot` (SN32). Removing the name inserts the version
  into `tab_versions` (its id, kind `manual`, name NULL, its author, tab name, body, bytes, element count, saved and
  created times) guarded `NOT EXISTS` for `(tab_id, rev)`, and deletes its `tab_named_versions` row, in one batch; the
  trigger drops its snapshot rows. The answer is the `tab_versions` row now holding the revision.
- **VH23 gone with the tab.** Deleting a tab cascades to `tab_named_versions`, whose trigger deletes the snapshot and
  its chunks; the document's own snapshots (item id the document's) are never touched.
- **VH24 anonymise both.** `anonymiseDocument` also clears the author of every snapshots row they took, the named
  versions and the document's own snapshots alike (`clearSnapshotAuthors`, SN34, Work Tracker 1310), and rewrites
  each named version's text through `anonymiseJsonText` with `rewriteSnapshotText` (SN33) where it mentions the
  person. The document's own snapshots keep their text: it is the owner's file.

## Interfaces and contracts

`@livedocuments/api-schema` `versions.ts`: the constants of the spec's table, `VERSION_NAME_MAX` (= the name cap),
`VersionKind`, `VersionSummary`, `VersionListResponse`, `VersionReadResponse`, `VersionRestoreResponse`,
`VersionCopyResponse`.

Routes (`apps/api/src/routes/versions.ts`, `handleVersionRoutes`, dispatched first among the tab subresources):

- **VH9 list / read** gate `gateGrant`; a Community grant, or a tab link on another tab, reads 404. Read answers the
  body through `rowToTab` (migrated) with the tab's id and the version's tab name, comment author ids redacted for a
  non-owner as the tab read does.
- **VH10 name current** gate `gateEdit`; body `{ name }` trimmed and capped (`truncateName`); empty is `400
invalid_name`. Renames the named version holding the stored revision (either store), or keeps a new one in the
  snapshots' store (VH20); `409 too_many_names` when 25 named versions exist across both stores and none holds the
  revision.
- **VH11 rename** gate `gateEdit`; `{ name: string | null }`; null or blank unnames. In `tab_versions` it sets
  `name` in place; in the snapshots' store see VH22. The editor replaces the row it renamed with the answer, by the id
  it sent, so an answer of another id (VH22's automatic version standing) replaces it too.
- **VH12 restore** gate `gateEdit`; see Behaviour.
- **VH13 copy** gate `gateEdit`, refused 403 for a tab link; `{ name? }`.
- Every route answers 404 for a tab the document lacks or a version of another tab.

## Behaviour and state

- **VH14 restored tab.** `restoredTab(stored, body)`: the version's body with the stored tab's `id`, `name`,
  `locked`, and, for each element present in both by id, the stored element's `LIVE_ELEMENT_FIELDS`. Migrated with
  `migrateIncomingTab`. Comment authors are not rewritten: the body came from the store.
- **VH15 restore.** Up to `SUBMIT_ATTEMPTS`: read the stored tab and `lastChangesetRev`; build the restored tab; when
  its JSON equals the stored body, answer `{ restored: null }`; an agent's restore checks held targets
  (`heldTargets` over the element ops) and answers `409 elements_held`; with element changes, `writeChangeset`
  (summary `Restored a version` or `Restored “<name>”`, cut to 80, `preStatements` the restore capture); with none,
  the capture then `upsertTabAtRev`. A stale write retries; past the attempts `409 tab_busy`. Then
  `relayPages(restoreRoomOps(stored, restored))`.
- **VH16 room ops.** `restoreRoomOps(before, after)`: one `tab-meta` patch of every body field other than
  `elements`, `articles`, `id`, `name`, `locked`, `folder`, `connection` that differs (`clear` for the absent ones,
  `pageSteps` when `pages` differ), then `tabArticleOps(before, after, { grow: true })`.
- **VH17 copy.** A new tab id (`crypto.randomUUID()`), the version's body under it without `locked` or the live element fields, named the request's name or `<tab name>
(copy)`, capped; written by `writeChangeset` with no stored tab at `nextOrderIndex(document.tabs)`.
- **VH18 editor restore.** The panel marks the tab as its own restore (`own-restores.ts`) for the request, so the
  relayed changeset raises no changeset toast on the restorer's screen; it then shows "Restored the version kept
  <when>" with Undo, which restores `undoVersionId` the same way and reads "Restore undone".
- **VH19 editor gate.** Name, Restore and Make a Copy render only when `can.edit` (Make a Copy also needs no tab
  scope); History renders when the document is server-stored, hydrated, not offline, not embedded and not in a
  workbench frame, no welcome is open and no Community visitor holds the session. It is the footer's
  (`useVersionHistoryInTools` in `ChromeControls`, from the tab bar's `onOpenHistory`, offering it to the Tools
  History row through `usePublishItemVersions`; footer-tools-menu blueprint FM9),
  never the header's: `EditorHeader` gets no `leadAction`.

## Errors and edge cases

| Case                                 | Handling                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Version of another tab, or gone      | 404 `not_found`                                                        |
| Tab deleted while the panel is open  | The list read 404s: the panel says "This tab is gone."                 |
| Restore of content equal to now      | 200 `{ restored: null }`; the panel says "Already the current version" |
| Tab changes during a restore         | Retry from the read; 409 `tab_busy` after the attempts                 |
| Copy past the tab cap                | 413 `tab_too_large`                                                    |
| A version body that no longer parses | 404 on read and restore, logged `[versions] refused` `unreadable`      |
| 26th name                            | 409 `too_many_names`                                                   |

## Security and trust

- Every route asks the grant first; writes ask `gateEdit` on the tab. A Community pass reads nothing.
- Comment author ids in a version are redacted for a non-owner, as in a tab read.
- A name is user text: capped to `VERSION_NAME_MAX`, whitespace collapsed, shown as text only.

## Performance and limits

- The idle trigger's WHEN is two integer reads on the hot autosave path; the copy is a row copy in SQLite.
- The list reads summaries only (no `data`): one query per store, `tab_versions` by its `(tab_id, saved_at)` index and
  the snapshots' store by `tab_named_versions (tab_id, rev)` joined on the snapshot's primary key: at most 75 rows
  between them (50 automatic, 25 named), merged in memory.
- Name This Version reads the tab body into the api once (at most the 2 MB tab cap) to write it as chunks; the old store
  copied it inside SQLite. Measured on node:sqlite with a 1.9 MB tab: 5.8 ms to keep a named version (2.2 ms for the old copy), 0.8 ms to open one (0.5 ms), and 0.4 ms to list 60 versions from both stores.
- Storage per tab is bounded by VH2 plus 25 named versions (spec "What it costs").
- The editor reads one version body per selection, keeps 8, and renders its pages once per version (memoised); the
  change summary is one pass over each side's elements by id.

## Presentation and UX

As the spec's "In the editor". The panel is `fixed` over the whole editor (`inset-0`) at `--z-modal`, with its own bar; its rail is a `<nav>` with an
ordered list per day; each row is a button with `aria-current` when selected. Restore confirms in place (the
action bar swaps to "Restore this version? … Restore / Cancel").

## Accessibility

- The panel is a `role="dialog"` with `aria-modal="true"` labelled by its bar's heading; focus is trapped in it,
  Escape closes and focus returns to History.
- Outline colours are never the only signal: the summary line says the counts in words, and the legend names them.

## Observability

`[versions] kept`, `[versions] pruned`, `[versions] restored`, `[versions] copied`, `[versions] refused`; the
idle and agent captures inside SQL are logged by the restore and copy that read them, never on the save path.

## Testing

| Rule         | Test                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| VH1-VH3      | `apps/api/src/db/versions.test.ts`                                                                                |
| VH4          | `apps/api/src/db/versions.test.ts`, `apps/api/src/routes/versions.test.ts` (agent burst)                          |
| VH5, VH15    | `apps/api/src/routes/versions.test.ts` (restore)                                                                  |
| VH6          | `apps/api/src/db/versions.test.ts` (upkeep)                                                                       |
| VH7          | `apps/api/src/document-room/document-room-store.test.ts`                                                          |
| VH9-VH13     | `apps/api/src/routes/versions.test.ts` (roles: Viewer, Participant, Editor, tab link, Community)                  |
| VH14, VH16   | `apps/api/src/versions/restore-tab.test.ts`                                                                       |
| VH17         | `apps/api/src/routes/versions.test.ts` (copy)                                                                     |
| VH18, VH19   | `apps/editor/components/versions/*.test.tsx`                                                                      |
| VH20-VH23    | `apps/api/src/db/named-versions.test.ts`, `apps/api/src/routes/versions.test.ts` (old store only, new only, both) |
| VH24         | `apps/api/src/document-room/document-room-store.test.ts`                                                          |
| what changed | `packages/document/src/version-changes.test.ts`                                                                   |
| storage      | `apps/api/src/versions/version-storage.test.ts` (typical and large tab bytes)                                     |

## Constants and configuration

The spec's Bounds table, in `@livedocuments/api-schema` `versions.ts`, each with its safe range: idle 5 to 120
minutes, burst 1 to 60 minutes, auto max 10 to 200, days 7 to 90, bytes 4 to 64 MiB, named 5 to 100.
