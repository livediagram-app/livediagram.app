# Empty diagram clean-up: blueprint

Derived from [Empty diagram clean-up](../empty-diagram-cleanup.md), on top of the
[Trash blueprint](trash.md), whose states, guards and purge it reuses unchanged. The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                      | Role                                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/api-schema/src/trash.ts`                                        | `TrashReason`, `TrashedDiagram.reason`, `EMPTY_DIAGRAM_STALE_DAYS` / `_MS`  |
| `apps/api/migrations/0054_diagram_trash_reason.sql`                       | `diagrams.trash_reason`                                                     |
| `apps/api/src/db/empty-diagram-sweep.ts`                                  | `trashEmptyDiagrams`: the set-based move, capped                            |
| `apps/api/src/db/trash.ts`                                                | `listTrash` reads the reason; `restoreDiagram` clears it and restarts stale |
| `apps/api/src/index.ts`                                                   | The 03:00 cron calls the sweep beside the purge                             |
| `apps/api/src/openapi/schemas.generated.ts`                               | Regenerated: `TrashedDiagram.reason`                                        |
| `apps/mcp/src/{tools,output-schema}.ts`                                   | `list_trash` rows carry `reason`                                            |
| `apps/live/lib/offline/offline-trash.ts`                                  | Local rows are `reason: 'deleted'`                                          |
| `apps/live/lib/trash-groups.ts`                                           | `trashedOnLabel(row)`: the row's "Deleted" / "Moved here ... empty" lead    |
| `apps/live/components/{panels/TrashPane,chrome/DiagramTrashedCard}.tsx`   | The row and the deleted card copy                                           |
| `apps/help/app/account-and-data/trash/page.mdx`, `packages/help-registry` | The help article's section and keywords                                     |

## Domain and naming

| Term             | Identifier                                            | Meaning                                              |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Empty            | SQL predicate in `empty-diagram-sweep.ts`             | No tab linked to the diagram holds an element        |
| Stale            | `saved_at <= now - EMPTY_DIAGRAM_STALE_MS`            | Not saved for 30 days (so also created 30+ days ago) |
| Clean-up / sweep | `trashEmptyDiagrams`, log `empty sweep`               | The daily move of empty, stale diagrams to the Trash |
| Trash reason     | `diagrams.trash_reason`, `TrashReason`, `reason`      | Why a diagram is in the Trash: `deleted` or `empty`  |
| Stale window     | `EMPTY_DIAGRAM_STALE_DAYS` / `EMPTY_DIAGRAM_STALE_MS` | 30 days                                              |

`trash_reason` is NULL for a delete and `'empty'` for the sweep in the database; the wire maps NULL to
`'deleted'` so a client never sees a null (D8). Banned: "auto-delete", "expired", "abandoned", "inactive"
(that word belongs to share links).

## Behaviour and state

The Trash's three states are unchanged. One transition is added and one is refined:

| From    | Event                                        | To      | Guard / effect                                              |
| ------- | -------------------------------------------- | ------- | ----------------------------------------------------------- |
| live    | daily cron, empty and stale                  | trashed | none; `trashed_at = now`, `trash_reason = 'empty'`          |
| trashed | restore (any door), `trash_reason = 'empty'` | live    | `mayDeleteDiagram`; `trash_reason = NULL`, `saved_at = now` |
| trashed | restore (any door), `trash_reason IS NULL`   | live    | unchanged: `saved_at` untouched                             |

Invariants:

- **C1** The sweep stamps `trashed_at` with the sweep's `now`, never `created_at` or `saved_at`, so
  `purgeExpiredTrash` cannot purge a diagram in the run that moved it: the purge needs
  `trashed_at <= now - TRASH_RETENTION_MS`.
- **C2** Selection and move are one `UPDATE ... WHERE id IN (SELECT ... LIMIT ?)`: the empty and stale
  predicate is evaluated inside the write, so a save committed before the statement keeps the diagram.
- **C3** Only live rows are selected (`trashed_at IS NULL`); a diagram already in the Trash keeps its
  first time and reason.
- **C4** A tab row whose `data` is not valid JSON counts as content (D9): the sweep fails safe.
- **C5** The sweep writes nothing else: no child row, no Timeline event, no room broadcast, no email.
- **C6** Offline Mode records never reach the server, so the sweep cannot see them.

## Interfaces and contracts

```ts
// packages/api-schema/src/trash.ts
export const EMPTY_DIAGRAM_STALE_DAYS = 30;
export const EMPTY_DIAGRAM_STALE_MS = EMPTY_DIAGRAM_STALE_DAYS * DAY_MS;
export const TRASH_REASONS = ['deleted', 'empty'] as const;
export type TrashReason = (typeof TRASH_REASONS)[number];
export type TrashedDiagram = { ...; reason: TrashReason };

// apps/api/src/db/empty-diagram-sweep.ts
export const EMPTY_SWEEP_BATCH = 500;
export const EMPTY_SWEEP_MAX_BATCHES = 4;
export function trashEmptyDiagrams(env: Env, now: number,
  opts?: { batch?: number; maxBatches?: number }): Promise<number>; // rows moved

// apps/api/src/db/trash.ts
export function restoreDiagram(env: Env, id: string, now?: number): Promise<boolean>; // now defaults to Date.now()
```

The statement, bound `(now, cutoff, batch)` with `cutoff = now - EMPTY_DIAGRAM_STALE_MS`:

```sql
UPDATE diagrams SET trashed_at = ?1, trash_reason = 'empty'
 WHERE id IN (
   SELECT d.id FROM diagrams d
    WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
      AND NOT EXISTS (
        SELECT 1 FROM diagram_tabs dt JOIN tabs t ON t.id = dt.tab_id
         WHERE dt.diagram_id = d.id
           AND (NOT json_valid(t.data)
                OR COALESCE(json_array_length(t.data, '$.elements'), 0) > 0))
    ORDER BY d.saved_at ASC, d.id ASC
    LIMIT ?3)
```

`GET /api/trash` rows: `reason` is `'empty'` when `trash_reason = 'empty'`, else `'deleted'`. MCP
`list_trash` rows: `{ id, name, library, reason, deletedAt, purgeAt }`, `reason` described as "Why it is
in the Trash: \"deleted\" by someone, or \"empty\" (moved automatically after 30 days with no content)".
No new route, no new error.

## Data and persistence

| Field                   | Class | Notes                                                      |
| ----------------------- | ----- | ---------------------------------------------------------- |
| `diagrams.trash_reason` | state | TEXT NULL; NULL or `'empty'`; meaningful only in the Trash |
| `TrashedDiagram.reason` | wire  | `'deleted' \| 'empty'`, derived                            |

Migration 0054 adds the nullable column with no backfill: every row already in the Trash was deleted by a
person, which NULL means (D7). No index: the sweep reads live rows by `saved_at` over the whole table, and
the table is small (Performance). Account deletion and purges remove the row with the rest; guest-to-account
migration moves `owner_id` only. Restore clears the column, so a live row's value is always NULL.

## Errors and edge cases

- **X1** A diagram with no tabs: empty (the `NOT EXISTS` holds).
- **X2** A tab shared with another diagram that has elements: neither diagram is empty.
- **X3** A tab whose `data` lacks `elements`: `json_array_length` is NULL, coalesced to 0: empty.
- **X4** Invalid JSON in a tab: content (C4).
- **X5** Saved between the cron's start and the statement: kept (C2).
- **X6** An editor open on the diagram when it is moved: its next save answers 410 `diagram_trashed` and
  the editor shows the deleted card (Trash I5); restorable from there.
- **X7** The first run on a deployment with a backlog: at most `EMPTY_SWEEP_BATCH x EMPTY_SWEEP_MAX_BATCHES`
  moves, oldest last-save first; the rest follow on later days.
- **X8** Restored and still empty: stale again only 30 days after the restore (the `saved_at` bump).
- **X9** A plain `DELETE` on a diagram the sweep moved: 410, reason
  and time unchanged (Trash E1).
- **X10** The sweep throws: `empty sweep failed <err>`; the purge and the other sweeps are independent
  `waitUntil`s and still run.

## Security and trust

- No caller input reaches the sweep: it runs only from the cron with bound constants.
- It moves to the Trash only, never purges; every moved diagram stays restorable by exactly the authority
  that could delete it.
- `trash_reason` names no person, so account deletion has nothing new to erase.

## Performance and limits

Measured on production, 2026-09-29: 601 diagrams, 707 tabs (3.4 MB of tab JSON, largest 727 KB); the
candidate query found 109 diagrams in 9.6 ms reading 1,472 rows. Per run: at most 4 statements, each
scanning live diagrams plus a probe of their tabs (the `EXISTS` stops at the first tab with an element).
At 100x today's size (~60k diagrams) a statement reads on the order of 150k rows, well inside D1's per-query
limits; the cap bounds the writes at 2,000 per run, the same order as the Trash purge.

## Observability

| Fingerprint                                    | Where     |
| ---------------------------------------------- | --------- |
| `empty sweep: moved <n> diagrams to the Trash` | api, cron |
| `empty sweep failed <err>`                     | api, cron |
| `[trash] restored <id>` (existing)             | api       |

## Presentation and UX

- Trash row lead: `row.reason === 'empty'` → "Moved here {d MMM} because it was empty"; else
  "Deleted {d MMM}"; then " · {days left}" as today.
- Deleted card, restorable and `reason === 'empty'`: "It was empty for 30 days, so it moved to the Trash
  ({n} days left). Restore it to put it back where it was." Otherwise unchanged.
- Help article, section "Empty diagrams": a diagram with nothing on any of its tabs, not changed for 30
  days, moves to the Trash on its own and says so there; it can be restored like any other for 30 days; a
  restore gives it another 30 days; offline diagrams are never moved. Keywords gain "empty",
  "automatic", "clean up", "cleanup".

## Accessibility

- The row lead is plain text inside the existing row; the card copy stays inside its `role="alert"`. No
  new control.

## Testing

| Rule                                                         | Test                                          |
| ------------------------------------------------------------ | --------------------------------------------- |
| Empty / not empty (X1 to X4), stale boundary, live only, cap | `apps/api/src/db/empty-diagram-sweep.test.ts` |
| Reason on the list; restore clears it and restarts stale     | `apps/api/src/db/empty-diagram-sweep.test.ts` |
| Cron: moves, logs, never purges what it moved (C1)           | `apps/api/src/scheduled-trash.test.ts`        |
| MCP `list_trash` carries `reason`                            | `apps/mcp/src/tools.test.ts`                  |
| Local rows are `deleted`                                     | `apps/live/lib/offline/offline-trash.test.ts` |
| Row lead copy                                                | `apps/live/lib/trash-groups.test.ts`          |
| OpenAPI parity                                               | `apps/api/src/openapi/*.test.ts`              |
| Help registry keywords                                       | `apps/help` registry tests                    |

## Constants and configuration

| Constant                   | Value | Provenance                                        | Safe range |
| -------------------------- | ----- | ------------------------------------------------- | ---------- |
| `EMPTY_DIAGRAM_STALE_DAYS` | 30    | Operator decision                                 | 7 to 90    |
| `EMPTY_SWEEP_BATCH`        | 500   | One bounded UPDATE; measured scan cost (D10)      | 50 to 1000 |
| `EMPTY_SWEEP_MAX_BATCHES`  | 4     | 2,000 moves a run, the purge's order of magnitude | 1 to 20    |

No new environment variable or binding; self-hosting needs only the migration.

## Defaults ledger

D7 to D10 in [DEFAULTS.md](DEFAULTS.md).
