# Insert a note between two notes (event-storming boards)

**Status:** planned, not started.
**Spec home:** [`specs/139-event-storming.md`](../specs/139-event-storming.md) (add a
new phase section); touches [`specs/09-canvas-and-palette.md`](../specs/09-canvas-and-palette.md)
and [`specs/58-palette-drag-ghost.md`](../specs/58-palette-drag-ghost.md) (the
drag-to-add ghost this feature extends).

---

## 1. What we are building

On an **event-storming board only**, dragging a note from the palette over the
gap between two existing notes offers to **insert** it there: while the cursor
hovers the gap, every note to the right slides further right to open a slot,
live, as a preview. Dropping commits the insertion — the new note lands in the
slot and the shifted notes keep their new positions, as **one undoable step**.
Dragging away from the gap closes the slot again.

Why this belongs on this board type and no other: an event-storming wall is a
**left-to-right timeline of domain events**. "This happened before that" is the
entire information content of the x axis, so inserting a step in the middle is
the most common edit in a session, and today it costs the author a manual
re-shuffle of everything downstream — the one operation the board's
low-threshold-capture premise cannot afford to be slow. On an ordinary diagram
x means nothing in particular, so the same gesture would be a surprise.

### The shape of the interaction

1. **Drag** a note from the Event Storming palette category (the existing
   drag-to-add gesture, spec/58 + spec/139).
2. **Hover** the cursor over the gap between two notes on the board.
3. **Preview**: the notes at and to the right of that gap translate right by
   the slot width. Nothing is committed; no peer sees it; the document is not
   dirtied.
4. **Drop**: the new note lands in the slot; the shifted notes' positions are
   written for real; one history entry.
5. **Leave the gap** (or press Escape, or drop outside): the preview unwinds
   and nothing changed.

---

## 2. Decisions already made (do not re-litigate)

These are settled. Implement them as stated.

- **Event-storming boards only.** Gate on `isEventStormingTab(tab)` /
  `tabKindOf(tab) === 'event-storming'`. Every other board keeps today's
  behaviour exactly.
- **"Everything on the right" means everything on the right.** The operator
  asked for the whole board to make room, not just one row. Shift every
  element whose insertion-axis position is at or after the insertion point —
  so vertical columns of related notes (a command above its event, a policy
  below) stay lined up with the event they annotate. Do NOT limit the ripple to
  a single row.
- **The preview never touches the document.** No `commit`, no `tick`, no
  realtime broadcast, no autosave. It is a render-time offset only. This is the
  central constraint of the whole feature: a preview that writes would sync
  half-finished states to peers and pollute the undo stack.
- **One undoable step on drop.** The insert and the ripple are a single history
  entry, so one Undo returns the board to exactly the pre-drop state.
- **No new element type, no schema change.** Notes are plain stickies; this
  feature only moves `x` values and adds one element.

---

## 3. Open questions (decide before the phase that needs them)

Each has a **recommended default**. Implement the default unless the operator
says otherwise; escalate only if implementation reveals the default is wrong.
**All five shipped as their default** — the answers are recorded inline below.

- [x] **Q1 — Does it also apply to moving an EXISTING note?** Dragging a note
      already on the board into a gap could insert it the same way.
      _Default: **not in v1.** Palette-drag only. The engine must be built so
      the existing-note case can reuse it (phase 9 records what that would
      take)._
- [x] **Q2 — Vertical insertion too?** Some boards run top-to-bottom.
      _Default: **horizontal only** in v1; keep the geometry axis-parameterised
      so vertical is a later flag, not a rewrite._
- [x] **Q3 — Slot width.** How far does everything move?
      _Default: **incoming note width + the row's prevailing gap**, where the
      prevailing gap is the median horizontal gap between adjacent notes in the
      affected row; fall back to the template's 72px when there is no measurable
      gap (fewer than two neighbours)._
- [x] **Q4 — Does the ripple include arrows, frames, text?** A free arrow's
      absolute points do not move when its neighbours do.
      _Default: **yes, everything moves** — boxed elements by `x`, free arrows
      by translating every point whose x is at/after the insertion point,
      pinned arrows follow their endpoints for free. An arrow that straddles
      the insertion point stretches (both endpoints keep their notes)._
- [x] **Q5 — Animation.** Should the slot open with a transition?
      _Default: **yes, a short CSS transform transition (~120ms, ease-out)**,
      disabled entirely under `prefers-reduced-motion`. Never animate the
      committed positions — the drop must land instantly where the preview
      promised._

---

## 4. Discovery (do this first, tick as you learn)

- [x] Read `specs/139-event-storming.md` end to end, including the **Domain
      learnings (session log)** section at the bottom — it records why the
      board works the way it does.
- [x] Read `specs/58-palette-drag-ghost.md` and
      `specs/09-canvas-and-palette.md`'s palette + guides prose.
- [x] Read the existing palette-drag machinery, which this feature extends
      rather than replaces:
  - [x] `apps/live/lib/palette-drag-preview.ts` — the module-level store that
        publishes what is being dragged (`usePaletteDragPreview`) and the live
        snap offset (`usePaletteDragSnap` / `setPaletteDragSnap`). Note the
        `useSyncExternalStore` pattern and WHY it is module-level.
  - [x] `apps/live/lib/palette-drag-snap.ts` — pure snap geometry shared by the
        ghost, the guides and the drop.
  - [x] `apps/live/hooks/canvas/usePaletteDragGuides.ts` — the single owner of
        the in-flight snap; listens to `document` `dragover`.
  - [x] `apps/live/components/canvas/PaletteDragGhost.tsx` — the footprint that
        follows the cursor.
  - [x] `apps/live/hooks/canvas/usePaletteDrop.ts` — `onDragOver` / `onDrop`,
        including how the snap offset is consumed and cleared.
  - [x] `apps/live/app/diagram/[id]/useElementCreation.ts` →
        `dropPaletteItem`, and `useElementHelpers.ts` → `addBoxedAt` /
        `placeBoxed` (note the `{ edit: true }` option that opens the label
        editor on drop).
- [x] Read how elements render, to find where a render-time offset can be
      applied without touching state: `apps/live/components/canvas/Canvas.tsx`,
      `BoxedElementView.tsx`, `ArrowView.tsx`.
- [x] Confirm the commit choke point and history semantics:
      `apps/live/app/diagram/[id]/useEditorState.ts` (`commitTabs`, `commit`,
      `tickTabs`, `markCheckpoint`) — and confirm which of these creates an
      undo entry.
- [x] Write down (in `AMBIGUITIES.md`) anything the above contradicts in this
      plan, before writing code.

---

## 5. Phase A — the geometry, as a pure module

Everything here is pure, fully unit-tested, and has no React in it. **TDD: test
first, red, then green.**

- [x] Create `apps/live/lib/insert-between.ts` (new module; keep it under ~200
      lines — if it grows past that, split the detection from the ripple).
- [x] Create `apps/live/lib/insert-between.test.ts` alongside it.
- [x] **Type: `InsertionSlot`** — the resolved insertion the UI is offering:
      `{ atX: number; shiftDx: number; shiftedIds: string[]; leftId: string | null; rightId: string | null }`.
      `leftId`/`rightId` are the notes either side (either may be null at the
      ends of the timeline), used for the marker and for tests to assert
      intent.
- [x] **`findInsertionSlot({ cursorX, cursorY, incomingWidth, elements, ... })`**
      returning `InsertionSlot | null`:
  - [x] Returns `null` when the cursor is not in a gap (over a note, or far
        from any row) — the ordinary drop path then applies unchanged.
  - [x] Considers only elements that are **candidates**: visible, unlocked,
        not the element being dragged (there isn't one yet for palette drags).
  - [x] Identifies the **row** the cursor is in: notes whose vertical span
        overlaps the cursor's y (plus a tolerance — decide and pin a constant,
        e.g. half a note height).
  - [x] Finds the adjacent pair in that row whose horizontal gap contains the
        cursor; the insertion point is the gap's midpoint (or the left edge of
        the right-hand note — pick one, document why, pin it in a test).
  - [x] Computes `shiftDx` per **Q3**.
  - [x] Computes `shiftedIds` per **decision 2**: every element on the board
        (not just the row) at or right of the insertion point.
- [x] **Hysteresis**: once a slot is active, it stays active until the cursor
      leaves the gap by a margin (pin the constant). Without this the preview
      flickers on and off at the boundary as the hand shakes. Test it
      explicitly: a cursor moving 1px back and forth across the threshold must
      not toggle.
- [x] **`applyInsertionShift(elements, slot)`** — pure: returns the elements
      with the ripple applied. Used by the DROP path, and by tests as the
      oracle for what the preview promised.
  - [x] Boxed elements: `x + shiftDx`.
  - [x] Free arrows: translate points at/after the insertion point (Q4).
  - [x] Pinned arrows: left alone (they follow their endpoints).
  - [x] Grouped elements: the whole group moves if any member does — a group
        that straddles the insertion point must not be torn in half. Decide and
        test: recommend moving the whole group when its **centre** is at/after
        the point.
- [x] Tests for the empty / degenerate cases:
  - [x] No elements at all → `null`.
  - [x] One element → `null` (no gap between two things), unless you decide
        leading/trailing insertion is in scope (recommend: not in v1).
  - [x] Cursor over a note, not a gap → `null`.
  - [x] Cursor in a gap that is narrower than the incoming note → still a valid
        slot (that is the whole point: it makes room).
  - [x] Two rows at different heights → only the hovered row decides the
        insertion point, but the ripple still takes the whole board.
  - [x] Locked / hidden elements are not candidates for the ROW, but confirm
        and pin whether they still SHIFT (recommend: hidden ones shift so the
        board stays consistent when unhidden; locked ones do NOT shift and the
        slot still opens around them — flag this to the operator if it looks
        wrong in practice).
- [x] Commit: `feat(canvas): insertion-slot geometry` (tests + module).

---

## 6. Phase B — the preview channel (render-time only)

- [x] Extend `apps/live/lib/palette-drag-preview.ts` (or add a sibling module
      if that file would exceed its cohesion — judge it) with an **insertion
      preview** channel: the active `InsertionSlot | null`, published with the
      same `useSyncExternalStore` pattern.
  - [x] `setInsertionSlot(slot)` / `useInsertionSlot()` / `takeInsertionSlot()`
        (named for the thing they carry, beside the existing snap channel).
  - [x] Cleared on drag end, drop, Escape, and drag-leave — every exit path.
        Write the test that proves no exit path leaks a stale slot.
- [x] Apply the offset at render time in the canvas:
  - [x] Decide the mechanism and record why in a comment: a CSS
        `transform: translateX()` on the element wrapper is preferred over
        recomputing `x`, because it is GPU-composited, cannot desync from the
        model, and unwinds by removing a style.
  - [x] Read the slot where it is needed rather than threading it: the
        elements layer subscribes to the drag store exactly as the ghost does
        (a drag is global + transient), and passes each view one number
        (`insertShiftX`) plus one boolean (`insertShiftAnimates`).
  - [x] Under `prefers-reduced-motion: reduce`, no transition (Q5).
  - [x] Make sure the offset applies to element views AND anything anchored to
        them that is NOT part of the element's own DOM node (selection popover,
        comment pins, action badges) — or confirm those are not visible during
        a palette drag and say so in a comment.
- [x] **Insertion marker**: draw a vertical line (or a slot outline) at the
      insertion point while a slot is active, in the same visual language as
      the existing alignment guides. Reuse the guide overlay's styling; do not
      invent a second visual vocabulary. _(Produced by the drag owner — lands
      with phase C.)_
- [x] The **ghost** (`PaletteDragGhost`) must sit in the slot while one is
      active, not under the raw cursor — the ghost, the marker and the eventual
      drop must agree, exactly as the existing snap keeps them agreeing.
      _(Falls out of the snap channel — lands with phase C.)_
- [x] Commit: `feat(canvas): live insertion preview`.

---

## 7. Phase C — wiring the drag

- [x] In `usePaletteDragGuides` (the existing single owner of the in-flight
      snap), resolve the insertion slot on each `dragover` **for ES boards
      only**, and publish it.
  - [x] When a slot is active, the **alignment snap yields**: do not also
        snap-align the ghost, or two placement rules fight. Pin this in a test.
  - [x] When no slot is active, behaviour is exactly today's.
- [x] Escape during a drag clears the preview (and, if the browser allows,
      cancels the drag). Test that the board is unchanged afterwards.
- [x] Dragging over a floating panel clears the preview (mirror the existing
      over-panel guards in the ghost / guides / drop).
- [x] Commit: `feat(canvas): resolve insertion slots during a palette drag`.

---

## 8. Phase D — the drop

- [ ] In `usePaletteDrop.onDrop`, when a slot is active: pass the slot through
      to the creation path instead of the plain snapped point.
- [ ] In `dropPaletteItem` / `addBoxedAt` (or a new sibling that takes a slot),
      commit **one** change containing both the ripple and the new note:
  - [ ] Use the existing commit choke point so layer stamping, board-kind
        stamping, activity-log emission and autosave all happen as usual.
  - [ ] Confirm with a test that it is ONE history entry: Undo once restores
        both the positions and removes the note.
  - [ ] The new note still opens for typing (`{ edit: true }`), as every
        palette drop does since the drop-to-type change.
- [ ] The dropped note lands exactly where the preview showed it — assert this
      by comparing the committed `x` against `applyInsertionShift`'s oracle.
- [ ] Activity log / change-log entry reads sensibly (check what
      `emitChange` produces for a multi-element move + add; if it says
      something unhelpful like "Moved 6 elements", consider a dedicated
      summary — but only if the existing machinery supports it without a
      schema change).
- [ ] Commit: `feat(canvas): insert a note between two notes`.

---

## 9. Phase E — edge cases and hostile paths

Each of these is a test, not a thought experiment.

- [ ] **Read-only / view-role session**: no preview, no insertion.
- [ ] **Locked tab**: no preview, no insertion.
- [ ] **Hidden or locked active layer**: creation is blocked; the preview must
      not offer a slot that cannot be committed.
- [ ] **Concurrent edit**: a peer moves one of the shifted notes mid-drag. The
      drop must not resurrect a stale position — commit from the LIVE elements
      (the `tabsRef` pattern in `commit`), not the snapshot the drag started
      with.
- [ ] **Offline mode** board: identical behaviour (the persistence dispatch
      makes this free, but prove it once).
- [ ] **Zoom**: slots resolve correctly at 25% and 400% (the cursor→canvas
      inversion through the transformed wrapper is the trap; reuse
      `pointerToCanvas`, never hand-roll).
- [ ] **Pan mid-drag** (middle-mouse pan while dragging, if possible) does not
      strand a preview.
- [ ] **Drag out of the window and back** does not leave a stale offset.
- [ ] **A group straddling the insertion point** behaves per phase A's rule.
- [ ] **An arrow spanning the insertion point** stretches, and its endpoints
      stay attached (pinned) — screenshot this one during manual verification.
- [ ] **Undo/redo** round trip: insert, undo, redo — positions are identical
      each time (pin with a test comparing serialised elements).
- [ ] **Rapid re-drags**: dragging, dropping, and immediately dragging again
      does not inherit the previous slot.

---

## 10. Phase F — proof it works (not optional)

- [ ] Run the dev stack under PM2 and verify **by hand in the browser**, with
      Playwright driving where it helps. The operator's board:
      `http://localhost:3000/diagram/da3af5be-b501-4ca8-92f3-2ec2a03aec75`
      (owner id `18faa96f-6217-4cae-9242-047d627d3603`, set
      `localStorage['livediagram:v2:self-id']` + `'livediagram:v2:name-confirmed'='1'`
      in an init script). **Do not leave test notes behind on that board** —
      snapshot the tab via the API before you start and restore it after.
      Prefer creating your OWN scratch diagram for destructive testing.
- [ ] Screenshot the preview mid-drag (slot open, marker drawn, ghost in the
      slot) and after the drop; check them yourself, and attach them to the
      final report.
- [ ] Add an **E2E smoke case** in `apps/live/e2e/smoke.spec.ts` using the
      existing `startTemplateDiagram` fixture: create an ES board, drag a note
      into a gap, drop, reload, and assert the order survived. Keep it in the
      spirit of spec/72 — a smoke alarm, not an exhaustive suite.
- [ ] Full gate: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm build` — all green before the final commit.

---

## 11. Phase G — telemetry, docs, specs

- [ ] **Telemetry** (spec/22): one `track(...)` at the insertion commit. Reuse
      the closed `TELEMETRY_CATEGORIES` / `TELEMETRY_ACTIONS` enums in
      `@livediagram/api-schema`; extend only if no existing pair fits, and say
      so in the commit message if you do. The `type` is a preset enum value,
      never user content.
- [ ] **spec/139**: a new phase section describing the feature, the
      board-only gating, the preview-never-writes rule, and the decisions in
      §2 above with their reasons. Append one-liners to the **Domain learnings
      (session log)** section for anything genuinely learned.
- [ ] **spec/09** and **spec/58**: note that palette drags on an ES
      board can resolve an insertion slot, and that the alignment snap yields
      to it.
- [ ] **Help**: update `apps/help/app/canvas/event-storming-boards/page.mdx`
      (the board-type article) with a short section on inserting between notes.
      If it deserves its own article instead, follow the help rules in
      `CLAUDE.md` exactly: registry entry with keywords, `articleCount` bump,
      and card art in BOTH `FEATURE_ICONS` and `FEATURE_ENTITY_HEX`.
      `registry-counts.test.ts` will catch a missed count.
- [ ] Check whether `README.md` / `docs/` need a line (probably not — this is a
      behaviour inside an existing feature — but check rather than assume).

---

## 12. Phase H — fold-back

- [ ] Names match post-plan reality: no `TODO`, no `phase N` references, no
      "new" in a symbol name that will not age well.
- [ ] Module headers state what each module IS today, not what it was added
      for.
- [ ] Every file touched is still under the ~400-line soft target, or is a
      documented exception (pure data / a fully decomposed orchestration root).
- [ ] Delete any scratch scripts (`*.tmp.mjs`, `/tmp/*.mjs`) before the final
      lint — a stray file in the workspace fails ESLint.
- [ ] Record in `LESSONS_LEARNED.md` anything that cost real debugging time.
- [ ] Re-read this plan top to bottom and confirm every box is ticked or
      explicitly deferred with a reason.

---

## 13. Definition of done

- [ ] Dragging a palette note over a gap on an ES board opens a slot live; the
      board unwinds when the cursor leaves; dropping commits in one undoable
      step and the new note is ready to type into.
- [ ] Nothing changes on any non-ES board.
- [ ] No preview state ever reaches the document, the wire, or a peer.
- [ ] All gates green, E2E smoke passes, and the feature is verified by hand
      with screenshots.
- [ ] Specs, help and telemetry updated in the same branch.
