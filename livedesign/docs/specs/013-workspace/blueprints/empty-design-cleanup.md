# Empty design clean-up: blueprint

Derived from [Empty design clean-up](../empty-design-cleanup.md), on top of the
[Trash blueprint](trash.md), whose states, guards and purge it reuses unchanged. The spec decides; this
file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                      | Role                                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/api-schema/src/trash.ts`                                        | `TrashReason`, `TrashedDesign.reason`, `EMPTY_DESIGN_STALE_DAYS` / `_MS`                                 |
| `apps/api/migrations/0001_livedesign_baseline.sql`                        | `designs.trash_reason`                                                                                     |
| `apps/api/src/db/empty-design-sweep.ts`                                 | `trashEmptyDesigns`: the set-based move, capped                                                            |
| `apps/api/src/db/trash.ts`                                                | `listTrash` reads the reason; `restoreDesign` clears it and restarts stale                                 |
| `apps/api/src/index.ts`                                                   | The 03:00 cron calls the sweep beside the purge                                                              |
| `apps/api/src/openapi/schemas.generated.ts`                               | Regenerated: `TrashedDesign.reason`                                                                        |
| `apps/mcp/src/{tools,output-schema}.ts`                                   | `list_trash` rows carry `reason`                                                                             |
| `apps/live/lib/offline/offline-trash.ts`                                  | Local rows are `reason: 'deleted'`                                                                           |
| `apps/live/lib/trash-groups.ts`                                           | `trashedOnLabel(row)`, `trashedCardHeading(row)`, `trashedCardLead(row, now)`: the reason copy, in one place |
| `apps/live/components/{panels/TrashPane,chrome/DesignTrashedCard}.tsx`  | The row and the deleted card copy                                                                            |
| `apps/help/app/account-and-data/trash/page.mdx`, `packages/help-registry` | The help article's section and keywords                                                                      |

## Domain and naming

| Term             | Identifier                                              | Meaning                                               |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Empty            | SQL predicate in `empty-design-sweep.ts`              | No tab linked to the design holds an element        |
| Stale            | `saved_at <= now - EMPTY_DESIGN_STALE_MS`             | Not saved for 30 days (so also created 30+ days ago)  |
| Clean-up / sweep | `trashEmptyDesigns`, log `empty sweep`                | The daily move of empty, stale designs to the Trash |
| Trash reason     | `designs.trash_reason`, `TrashReason`, `reason`       | Why a design is in the Trash: `deleted` or `empty`  |
| Stale window     | `EMPTY_DESIGN_STALE_DAYS` / `EMPTY_DESIGN_STALE_MS` | 30 days                                               |

`trash_reason` is NULL for a delete and `'empty'` for the sweep in the database; the wire maps NULL to
`'deleted'` so a client never sees a null (D142). Banned: "auto-delete", "expired", "abandoned", "inactive"
(that word belongs to share links).

## Behaviour and state

The Trash's three states are unchanged. One transition is added and one is refined:

| From    | Event                                        | To      | Guard / effect                                               |
| ------- | -------------------------------------------- | ------- | ------------------------------------------------------------ |
| live    | daily cron, empty and stale                  | trashed | none; `trashed_at = now`, `trash_reason = 'empty'`           |
| trashed | restore (any door), `trash_reason = 'empty'` | live    | `mayDeleteDesign`; `trash_reason = NULL`, `saved_at = now` |
| trashed | restore (any door), `trash_reason IS NULL`   | live    | unchanged: `saved_at` untouched                              |

Invariants:

- **C1** The sweep stamps `trashed_at` with the sweep's `now`, never `created_at` or `saved_at`, so
  `purgeExpiredTrash` cannot purge a design in the run that moved it: the purge needs
  `trashed_at <= now - TRASH_RETENTION_MS`.
- **C2** Selection and move are one `UPDATE ... WHERE id IN (SELECT ... LIMIT ?)`: the empty and stale
  predicate is evaluated inside the write, so a save committed before the statement keeps the design.
- **C3** Only live rows are selected (`trashed_at IS NULL`); a design already in the Trash keeps its
  first time and reason.
- **C4** A tab row whose `data` is not valid JSON counts as content (D143): the sweep fails safe.
- **C5** The sweep writes nothing else: no child row, no Timeline event, no room broadcast, no email.
- **C6** Offline Mode records never reach the server, so the sweep cannot see them.

## Interfaces and contracts

```ts
// packages/api-schema/src/trash.ts
export const EMPTY_DESIGN_STALE_DAYS = 30;
export const EMPTY_DESIGN_STALE_MS = EMPTY_DESIGN_STALE_DAYS * DAY_MS;
export const TRASH_REASONS = ['deleted', 'empty'] as const;
export type TrashReason = (typeof TRASH_REASONS)[number];
export type TrashedDesign = { ...; reason: TrashReason };

// apps/api/src/db/empty-design-sweep.ts
export const EMPTY_SWEEP_BATCH = 500;
export const EMPTY_SWEEP_MAX_BATCHES = 4;
export function trashEmptyDesigns(env: Env, now: number,
  opts?: { batch?: number; maxBatches?: number }): Promise<number>; // rows moved

// apps/api/src/db/trash.ts
export function restoreDesign(env: Env, id: string, now: number): Promise<boolean>; // the route passes Date.now()
```

The statement, bound `(now, cutoff, batch)` with `cutoff = now - EMPTY_DESIGN_STALE_MS`:

```sql
UPDATE designs SET trashed_at = ?1, trash_reason = 'empty'
 WHERE id IN (
   SELECT d.id FROM designs d
    WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
      AND NOT EXISTS (
        SELECT 1 FROM design_tabs dt JOIN tabs t ON t.id = dt.tab_id
         WHERE dt.design_id = d.id
           AND CASE
                 WHEN NOT json_valid(t.data) THEN 1
                 WHEN COALESCE(json_array_length(t.data, '$.elements'), 0) > 0 THEN 1
                 ELSE 0
               END = 1)
    ORDER BY d.saved_at ASC, d.id ASC
    LIMIT ?3)
```

`GET /api/trash` rows: `reason` is `'empty'` when `trash_reason = 'empty'`, else `'deleted'`. MCP
`list_trash` rows: `{ id, name, library, reason, deletedAt, purgeAt }`, `reason` described as "Why it is
in the Trash: \"deleted\" by someone, or \"empty\" (moved automatically after 30 days with no content)".
No new route, no new error.

## Data and persistence

| Field                    | Class | Notes                                                      |
| ------------------------ | ----- | ---------------------------------------------------------- |
| `designs.trash_reason` | state | TEXT NULL; NULL or `'empty'`; meaningful only in the Trash |
| `TrashedDesign.reason` | wire  | `'deleted' \| 'empty'`, derived                            |

The baseline migration adds the nullable column: NULL means a person deleted it (D141). No index: nothing filters on it. The sweep scans live rows; an index ordering them by `saved_at` would
cost every autosave a write to save a once-a-day scan (Performance). Account deletion and purges remove the row with the rest; guest-to-account
migration moves `owner_id` only. Restore clears the column, so a live row's value is always NULL.

## Errors and edge cases

- **X1** A design with no tabs: empty (the `NOT EXISTS` holds).
- **X2** A tab shared with another design that has elements: neither design is empty.
- **X3** A tab whose `data` lacks `elements`: `json_array_length` is NULL, coalesced to 0: empty.
- **X4** Invalid JSON in a tab: content (C4).
- **X5b** The checks are one `CASE`, evaluated in order and stopped at the first match (an `OR` chain SQLite may
  evaluate whole), so a body that is not JSON never reaches `json_array_length`.
- **X5** Saved between the cron's start and the statement: kept (C2).
- **X6** An editor open on the design when it is moved: its next save answers 410 `design_trashed` and
  the editor shows the deleted card (Trash I5); restorable from there.
- **X7** The first run on a deployment with a backlog: at most `EMPTY_SWEEP_BATCH x EMPTY_SWEEP_MAX_BATCHES`
  moves, oldest last-save first; the rest follow on later days.
- **X8** Restored and still empty: stale again only 30 days after the restore (the `saved_at` bump).
- **X9** A plain `DELETE` on a design the sweep moved: 410, reason
  and time unchanged (Trash E1).
- **X10** The sweep throws: `empty sweep failed <err>`; the purge and the other sweeps are independent
  `waitUntil`s and still run.

## Security and trust

- No caller input reaches the sweep: it runs only from the cron with bound constants.
- It moves to the Trash only, never purges; every moved design stays restorable by exactly the authority
  that could delete it.
- `trash_reason` names no person, so account deletion has nothing new to erase.

## Performance and limits

Measured on production, 2026-09-29: 601 designs, 707 tabs (3.4 MB of tab JSON, largest 727 KB); the
candidate query found 109 designs in 9.6 ms reading 1,472 rows. Per run: at most 4 statements, each
scanning live designs plus a probe of their tabs (the `EXISTS` stops at the first tab with an element).
At 100x today's size (~60k designs) a statement reads on the order of 150k rows, well inside D1's per-query
limits; the cap bounds the writes at 2,000 per run, the same order as the Trash purge.

## Observability

| Fingerprint                                     | Where     |
| ----------------------------------------------- | --------- |
| `empty sweep: moved <n> designs to the Trash` | api, cron |
| `empty sweep failed <err>`                      | api, cron |
| `[trash] restored <id>` (existing)              | api       |

## Presentation and UX

- Trash row lead: `row.reason === 'empty'` → "Moved here {d MMM} because it was empty"; else
  "Deleted {d MMM}"; then " · {days left}" as today.
- Deleted card, restorable and `reason === 'empty'`: label "In the Trash", heading "This design is in
  the Trash" (`trashedCardHeading`), then "It was empty for 30 days, so it moved to the Trash ({n} days
  left). Restore it to put it back where it was." Otherwise unchanged ("Deleted", "This design was
  deleted").
- Help article, section "Empty designs": a design with nothing on any of its tabs, not changed for 30
  days, moves to the Trash on its own and says so there; it can be restored like any other for 30 days; a
  restore gives it another 30 days; offline designs are never moved. Keywords gain "empty",
  "automatic", "clean up", "cleanup".

## Accessibility

- The row lead is plain text inside the existing row; the card copy stays inside its `role="alert"`. No
  new control.

## Testing

| Rule                                                         | Test                                           |
| ------------------------------------------------------------ | ---------------------------------------------- |
| Empty / not empty (X1 to X4), stale boundary, live only, cap | `apps/api/src/db/empty-design-sweep.test.ts` |
| Reason on the list; restore clears it and restarts stale     | `apps/api/src/db/empty-design-sweep.test.ts` |
| Cron: moves, logs, never purges what it moved (C1)           | `apps/api/src/scheduled-trash.test.ts`         |
| MCP `list_trash` carries `reason`                            | `apps/mcp/src/tools.test.ts`                   |
| Local rows are `deleted`                                     | `apps/live/lib/offline/offline-trash.test.ts`  |
| Row lead and card lead copy                                  | `apps/live/lib/trash-groups.test.ts`           |
| OpenAPI parity                                               | `apps/api/src/openapi/*.test.ts`               |
| Help registry keywords                                       | `apps/help` registry tests                     |

## Constants and configuration

| Constant                    | Value | Provenance                                        | Safe range |
| --------------------------- | ----- | ------------------------------------------------- | ---------- |
| `EMPTY_DESIGN_STALE_DAYS` | 30    | Operator decision                                 | 7 to 90    |
| `EMPTY_SWEEP_BATCH`         | 500   | One bounded UPDATE; measured scan cost (D144)     | 50 to 1000 |
| `EMPTY_SWEEP_MAX_BATCHES`   | 4     | 2,000 moves a run, the purge's order of magnitude | 1 to 20    |

No new environment variable or binding; self-hosting needs only the migration.

## Defaults ledger

D141 to D144 in [DEFAULTS.md](DEFAULTS.md).
