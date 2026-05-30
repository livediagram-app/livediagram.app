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

New D1 table, migration `0004_change_log.sql`:

```sql
CREATE TABLE change_log (
  id           TEXT PRIMARY KEY,             -- UUID
  diagram_id   TEXT NOT NULL,                -- diagram this entry belongs to
  tab_id       TEXT,                         -- nullable for diagram-level entries
  participant_id   TEXT NOT NULL,            -- author at commit time
  participant_name TEXT NOT NULL,            -- snapshot at commit time
  participant_color TEXT NOT NULL,           -- snapshot for the dot
  kind         TEXT NOT NULL,                -- 'add' | 'edit' | 'delete' | 'revert'
  summary      TEXT NOT NULL,                -- short display string ("Edited 'API'")
  element_ids  TEXT NOT NULL,                -- JSON array of affected element ids
  before_state TEXT NOT NULL,                -- JSON: { [elementId]: Element | null }
  after_state  TEXT NOT NULL,                -- JSON: { [elementId]: Element | null }
  created_at   INTEGER NOT NULL,             -- epoch ms
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX change_log_diagram_idx ON change_log(diagram_id, created_at DESC);
CREATE INDEX change_log_tab_idx     ON change_log(tab_id);
```

- `before_state[id] = null` ⇒ the element didn't exist before (added).
- `after_state[id]  = null` ⇒ the element doesn't exist after (deleted).
- A regular edit has the full element shape on both sides.

The participant name + colour are **frozen at the moment of the
commit**. A later rename doesn't retroactively rewrite the log.

## Cascade on tab delete

`diagrams` is one row of JSON; tabs are not their own table, so the
FK on `tab_id` can't cascade. The client must explicitly delete log
entries for a tab when it deletes the tab:

- `DELETE /api/diagrams/:id/log/tab/:tabId` drops every row whose
  `tab_id` matches.
- The live app calls this from `deleteTab` before persisting the new
  tabs list.

Diagram delete still cascades through the FK above.

## API surface

All endpoints require `X-Owner-Id`. They additionally accept an
optional `X-Share-Code` header so an edit-role visitor (someone who
followed a `?s=<code>` share URL) can write to the log — when the
code resolves to an active edit-role share link for this diagram,
the request is authorised. Owners pass the header empty.
View-role visitors fail the auth check.

The bulk tab-cascade DELETE stays owner-only — destructive bulk
ops shouldn't ride a visitor's share code.

- `GET    /api/diagrams/:id/log` → `{ entries: ChangeLogEntry[] }` newest-first, capped at 200. (owner or edit visitor)
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
- Cap the in-memory list at 200 entries. Older entries are still in
  D1 and load on a future `GET /log`; V1 doesn't expose pagination
  UI.

## Out of scope for V1

- Realtime broadcast of new entries between collaborators (V2 — wire
  through the existing Durable Object room).
- Pagination / search / filter UI.
- Diagram-level entries (rename, share toggle, theme change). All V1
  entries are tab-scoped.
- Selective revert UI ("revert just the fill, not the stroke").
