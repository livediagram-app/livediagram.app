# Activity and audit log

A persistent, per-diagram record of every editorial change, with author
attribution and per-entry surgical revert. Surfaced in the editor as
the **Activity Panel**.

## Goals

- Trust: every visible change is attributable to a participant and
  reversible.
- Collaboration safety: reverting one person's edit must not blow
  away other people's unrelated edits.
- Persistence: the log survives reload, sign-out, and re-share. It is
  the audit of who did what to a diagram across its whole life.

## Non-goals (V1)

- Full version-control branching / "rewind to here". Reverting an
  entry is surgical, not a tab-wide time machine.
- Inverse arithmetic for arbitrary fields. We store full element
  before / after snapshots — replay, don't derive.
- Per-keystroke logging. The unit is **one undoable commit** (a drag,
  a colour pick, a shape add).
- A panel-level "review changes since I left" inbox. The log lists
  everything; filtering is V2.

## Definitions

- **Change**: one undoable commit on a tab. Multiple elements can be
  touched in a single change (e.g. a multi-drag).
- **Entry**: one row in the audit log corresponding to one change.
- **Affected elements**: the element ids whose state changed in the
  commit (added, removed, or edited).

## Data model

New D1 table, migration `0004_change_log.sql`. Two follow-up migrations narrowed the shape:

- **`0012`** — dropped `diagram_id` (item #14 / spec/17). Every entry is tab-scoped; per-diagram reads join through `diagram_tabs`.
- **`0013`** — dropped the denormalised `participant_name` + `participant_color` (item #15). Reads `LEFT JOIN participants` on `participant_id`; rows whose author has been deleted fall back to "Unknown" / slate-400 client-side.

A daily cron (item #16) runs at 03:00 UTC and deletes `change_log` rows older than 90 days. The Activity Panel only ever surfaces the most recent N entries (`CHANGE_LOG_LIST_LIMIT = 30` server-side, paged by `created_at DESC`), so anything past the retention window has been invisible since the day it landed — the sweep just stops the table growing unboundedly under busy collab.

Post-migration shape:

```sql
CREATE TABLE change_log (
  id           TEXT PRIMARY KEY,             -- UUID
  tab_id       TEXT,                         -- the tab this entry belongs to (post #14)
  participant_id   TEXT NOT NULL,            -- joined to participants on read (post #15)
  kind         TEXT NOT NULL,                -- 'add' | 'edit' | 'delete' | 'revert'
  summary      TEXT NOT NULL,                -- short display string ("Edited 'API'")
  element_ids  TEXT NOT NULL,                -- JSON array of affected element ids
  before_state TEXT NOT NULL,                -- JSON: { [elementId]: Element | null }
  after_state  TEXT NOT NULL,                -- JSON: { [elementId]: Element | null }
  created_at   INTEGER NOT NULL,             -- epoch ms
  FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- "Most recent N entries for this diagram" walks tab_id (post #14 the
-- diagram filter is an outer JOIN through diagram_tabs), then orders
-- by created_at. Tab-scoped reads pick up the same index.
CREATE INDEX change_log_tab_created_at_idx ON change_log(tab_id, created_at DESC);
```

- `before_state[id] = null` ⇒ the element didn't exist before (added).
- `after_state[id]  = null` ⇒ the element doesn't exist after (deleted).
- A regular edit has the full element shape on both sides.

The participant name + colour are **frozen at the moment of the
commit**. A later rename doesn't retroactively rewrite the log.

## Cascade on tab delete

Tabs got their own table in migration 0005 (see [13-per-tab-storage.md](13-per-tab-storage.md)). Migration 0012 added `FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE` to `change_log`, so deleting a `tabs` row drops the matching log entries automatically: no per-tab cascade call from the client is needed (the historical `useTabActions.deleteTab` cascade has been removed).

- `DELETE /api/diagrams/:id/log/tab/:tabId` still exists: the editor's Activity Panel surfaces it as the per-tab "Clear" button so a user can wipe one tab's audit trail intentionally without deleting the tab itself.

Diagram delete no longer cascades to `change_log` rows directly: post #14 there's no `diagram_id` column to hang the cascade off, only `tab_id`. Deleting a diagram drops the `diagrams` row + cascades to `diagram_tabs` link rows, but tabs that were only linked to the deleted diagram survive as orphans in the `tabs` table (no explicit sweep, intentional under the many-to-many model in spec/17), and their `change_log` entries survive with them. The 90-day retention cron (item #16) sweeps the latter eventually.

## API surface

All endpoints require `X-Owner-Id`. They additionally accept an
optional `X-Share-Code` header so an edit-role visitor (someone who
followed a `?s=<code>` share URL) can write to the log — when the
code resolves to an active edit-role share link for this diagram,
the request is authorised. Owners pass the header empty.
View-role visitors fail the auth check.

The bulk tab-cascade DELETE stays owner-only — destructive bulk
ops shouldn't ride a visitor's share code.

- `GET    /api/diagrams/:id/log` → `{ entries: ChangeLogEntry[] }` newest-first, capped at 30 (`CHANGE_LOG_LIST_LIMIT`, defined in `@livediagram/api-schema` and applied server-side in `apps/api/src/db/change-log.ts`). (owner or edit visitor)
- `POST   /api/diagrams/:id/log` → append. Body: the new entry. (owner or edit visitor)
- `DELETE /api/diagrams/:id/log/:entryId` → drop one entry (revert / undo). (owner or edit visitor)
- `DELETE /api/diagrams/:id/log/tab/:tabId` → drop entries for one tab. (owner only)

## Client behaviour

1. On every undoable commit, the live app:
   - Computes a diff between the pre-commit and post-commit elements
     of the active tab.
   - Builds a `ChangeLogEntry` (`kind`, `summary`, `element_ids`,
     `before_state`, `after_state`).
   - Posts it to `POST /log`.
   - Optimistically appends it to the in-memory log so the panel
     updates immediately.

   **Continuous gestures coalesce into one entry.** A pointer drag
   (move / resize / rotate a box, drag an arrow endpoint / curve /
   elbow / label) and a keyboard-nudge burst (a run of arrow-key
   presses) each produce a single entry, not one per frame or per
   keystroke — matching the non-goal "the unit is one undoable
   commit". The mechanism is the per-key debounce in
   `useActivityLogDebounce` (`scheduleElementChangeLog`, 500ms
   window): the first tick of the gesture snapshots the pre-gesture
   elements as `before`, every subsequent tick resets the window, and
   the single flush after the gesture settles diffs `before` against
   the final state. So a drag yields one `Moved a Square` and a held
   arrow-key yields one `Moved 'API'`. The same debounce already backs
   the colour / opacity sliders. These entries are revertable like any
   other element diff.

   One exception: drawing an arrow by pulling from a shape anchor
   (`beginAnchorDrag`) logs only the `Added an Arrow` entry from its
   creation `commit`; the endpoint drag that immediately follows is
   suppressed (the gesture never arms a history checkpoint, which is
   what gates the drag-log), so a freshly drawn arrow is one entry,
   not an add + a move.

2. `useDiagramHistory.undo` / `redo` are paired with the activity log:
   - **Undo** removes the most recently emitted entry from the panel
     and DELETEs it from D1. The popped entry is held in a redo stack
     in memory so a subsequent Redo can reinstate it.
   - **Redo** takes the top of the redo stack and re-POSTs the entry
     verbatim (same id, summary, before/after). The Activity panel
     ends up showing exactly what was visible before the undo.
   - The pair-stacks are bounded by the same limit as
     `useDiagramHistory` (3 steps) so they can't drift out of sync.
     A fresh commit clears the redo stack — same semantics as the
     state-snapshot history's `future`.

3. On a `Revert` click for entry E:
   - For each `elementId` in E, apply E's `before_state` to the
     active tab: `null` ⇒ remove that element; otherwise replace it.
   - Drop E from the log (local state first, then a `DELETE
/api/diagrams/:id/log/:entryId` call). The revert is treated as
     a cancellation of E, not its own event, so the panel stays
     compact instead of pairing every revert with a `reverted` twin.

4. On `deleteTab(tabId)`:
   - Call `DELETE /log/tab/:tabId` _before_ the PUT that drops the tab
     from the diagram. (Ordering doesn't matter for correctness but
     reads more clearly in network logs.)

## Activity Panel UI

- Same shape language as Explorer / Palette: floating
  `MovablePanel`, default bottom-left, minimisable to a dock button.
- **Scoped to the active tab.** The panel only renders entries whose
  `tab_id` matches the currently visible tab; switching tabs swaps
  the log. The server still stores every entry under the diagram
  (so cross-tab history isn't lost), but the user only ever sees the
  current tab's slice. Filtering is client-side.
- Header row inside the panel hosts Undo / Redo buttons (moved out of
  the bottom-right HistoryControls).
- Body: a fixed-height (~8 rows) vertical list of entries, newest
  first; overflow scrolls. Each entry shows:
  - Author avatar dot (using `participant_color`)
  - Author name
  - Verb / summary ("Edited 'API'")
  - Relative timestamp ("2 minutes ago")
  - A small Revert button on hover
- Empty state: "No edits yet — start drawing."

## Performance

- Append is fire-and-forget — UI doesn't await it.
- List fetch is debounced into hydration; subsequent appends update
  the in-memory list. We do not poll the server.
- Server caps the list response at 30 entries (`CHANGE_LOG_LIST_LIMIT`). Older entries are still in D1; V1 doesn't expose pagination UI.

## Realtime mirroring

New entries (and their removals on Undo / Revert) propagate through the per-diagram Durable Object room as `log` / `log-remove` ops — see [11-api.md → Realtime model](11-api.md). Peers append / drop from their local Activity Panel without re-fetching, so collaborators see each other's edits land in real time.

## Out of scope for V1

- Pagination / search / filter UI.
- Diagram-level entries (rename, share toggle, theme change). All V1 entries are tab-scoped.
- Selective revert UI ("revert just the fill, not the stroke").
