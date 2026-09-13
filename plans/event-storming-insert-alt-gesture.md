# Insert-between becomes an Alt-held gesture, for any sticky

**Status:** planned, not started.
**Supersedes the interaction half of** [`plans/event-storming-insert-between.md`](event-storming-insert-between.md)
(shipped). The geometry, the preview channel and the commit path from that
plan stay; **how the gesture is armed changes, and it grows a second entry
point.**

---

## 1. What changes, and why

Insertion currently arms **automatically** whenever a palette note is dragged
over a gap on an event-storming board. That is wrong for two reasons the
operator named:

1. It is **surprising for ordinary use** — someone dragging a note near a row
   gets the whole board rearranging under them when they only wanted to drop a
   note nearby.
2. It is **unavailable where it is most useful** — the drag people do most is
   moving a note they already placed, and today that can't insert at all.

So:

- **Arm on a held Alt / Option key**, never automatically. No Alt, no slot, no
  ripple — today's plain behaviour, on every board.
- **Any sticky**, not just a new one: a palette drag AND a drag of an existing
  sticky already on the board both offer insertion while Alt is held.
- Still **event-storming boards only**. Alt on any other board keeps whatever
  meaning it has there (today: none).

### Settled decisions (operator-chosen; do not re-litigate)

- **Alt / Option is the modifier.** Chosen over Ctrl deliberately: Ctrl/Cmd
  already means **free placement** during a drag (snap override, spec/60) and
  Shift already means **drag-duplicate** (spec/80). Alt is unclaimed in canvas
  gestures, so insertion displaces nothing and works the same on every board.
- **A moved note leaves its hole behind.** When an existing note is inserted
  elsewhere, the notes after its ORIGINAL position do **not** close up. The
  board makes room at the destination; the source gap is the author's to tidy.
  Predictable beats clever.
- Everything the shipped plan settled still holds: the preview never touches
  the document, the drop is one undoable step, "everything on the right" means
  the whole board, and no schema changes.

---

## 2. Open questions (defaults to implement)

- [x] **Q1 — Multi-selection drags.** Shipped as the default: insertion is
      offered only for a single sticky, and a multi-selection drag behaves as
      it does today. Pinned in both the resolver's tests and the drag's.
- [x] **Q2 — Non-sticky elements.** Shipped as the default, and extended to
      the palette path for symmetry: a shape dragged IN from the palette no
      longer inserts either, which it did before this change. The two entry
      points now answer the same question the same way. (A palette note drag
      publishes a square footprint because the ghost draws by shape kind, so
      the preview grew a `note` flag saying what it will actually become.)
- [x] **Q3 — Alt pressed mid-drag.** Fully live on both paths. On the pointer
      path it is live even with the hand held still (keydown / keyup replay
      the last pointer position). On the palette path Chromium delivers no key
      events during a native drag at all, so it lands on the next movement —
      measured in the spike, recorded in spec/139, and the reason the copy
      says "press Alt while dragging".
- [x] **Q4 — Discoverability.** Done by generalising the existing banner rather
      than adding a surface: `ShiftHintBanner` → `ModifierHintBanner`, whose
      job was always "name what a modifier does right now" (the old name
      described its trigger, not its work). It now also OFFERS the gesture —
      "Alt · Press to insert it between two notes" — while a note is on the
      move from either entry point, which is the only moment the offer is
      useful and the only way anyone finds a held modifier. Suppressed while
      Shift is down, since drag-duplicate owns that gesture.

---

## 3. Platform risk — read this before estimating

**Alt+drag is grabbed by the window manager on many Linux desktops** (it moves
the window), and on some it is Super rather than Alt. The operator develops on
Linux Mint, so **verify early, in a real browser, that the page receives
`altKey` during a drag**:

- [x] Spiked with REAL X11 input (a compiled XTEST injector — CDP-synthesised
      input bypasses the WM and would have told a comforting lie). Results on
      the operator's Cinnamon desktop (`mouse-button-modifier = '<Alt>'`):
  - [x] Alt held BEFORE the press: **Muffin steals it** — the window moved,
        the page saw no `pointerdown` at all.
  - [x] Press first, THEN Alt: works on both paths. `pointermove` carries
        `altKey=true`; a native drag's `dragover` / `drop` carry it too.
  - [x] Ctrl+Alt is **also** swallowed (press eaten, `buttons=0`); right Alt
        is `ISO_Level3_Shift` on a us-intl layout so it sets `AltGraph`, never
        `altKey`. Neither is a usable fallback.
- [x] Reported and the operator chose: **ship Alt unchanged**, taught as
      "press Alt while dragging" rather than "hold Alt and drag".
- [x] Alt does NOT steal focus to a menu bar: a bare Alt tap produced no
      `blur` and no menu in Chrome on Linux, so no `preventDefault` is needed.
- [x] Measured, and it changes the design: **during a native HTML5 drag
      Chromium delivers no key events to the document at all** — only
      `dragover.altKey`. So on the palette path Alt registers on the next
      pointer movement, and keydown/keyup listeners would be dead code. On the
      pointer path (phase B) key events DO fire, so Q3 is fully live there.

---

## 4. Phase A — arm on Alt (palette drag)

- [x] Read the shipped implementation first: `apps/live/lib/insert-between.ts`
      (`canInsertBetweenOn`, `findInsertionSlot`, `applyInsertionShift`),
      `apps/live/lib/palette-drag-preview.ts` (the preview channel),
      `apps/live/hooks/canvas/usePaletteDragGuides.ts` (the resolver),
      `apps/live/hooks/canvas/usePaletteDrop.ts` (the commit).
- [x] `canInsertBetweenOn(gate, altHeld)` is still ONE predicate; it now takes
      the modifier as its second argument. The board/session half is a named
      `InsertionGate` the caller settles once per render, so the drag can ask
      about the hand on every move without re-deriving the rest.
- [x] Track Alt live during a palette drag:
  - [x] `DragEvent.altKey` on `dragover` gives it for free on every move.
  - [x] Alt with no mouse movement: **not deliverable on this path** — see the
        spike above. Chromium sends no key events during a native drag, so a
        keydown listener could never fire and is not added. The next movement
        (even a pixel) picks it up. Recorded in spec/139 and the help copy.
- [x] Releasing Alt closes the slot and restores the ordinary alignment snap
      for the rest of the drag. Pinned: "unwinds the moment Alt comes up".
- [x] Existing tests re-read one by one: the slot-opening ones now hold Alt
      (`altDragOver`), and the old "automatic" case became the regression
      guard "offers nothing without Alt, however inviting the gap".
- [x] Commit: `feat(canvas): arm insertion on a held Alt`.

---

## 5. Phase B — the same gesture for an existing sticky

This is the new capability, and the riskier half: element drags run through
`useEditorDrag`, which commits **live** on every pointer tick.

- [x] Read `apps/live/hooks/canvas/useEditorDrag.ts` end to end, especially:
      the `boxed` / `move` branch, the drag-engage threshold, how `noSnap`
      (Cmd/Ctrl, spec/60) already reads a modifier off the pointer event, and
      the checkpoint machinery (`markCheckpoint`, `cancelToCheckpoint`) that
      makes a whole drag one undo step.
- [x] Resolve a slot on each pointer move while Alt is held and the dragged
      element is a single sticky on an ES board. The whole question is ONE
      pure answer in `hooks/canvas/note-insertion-drag.ts`
      (`resolveNoteInsertion`), so the pointer-move handler grew a dozen lines
      rather than a pile of conditions — `useEditorDrag.ts` was already past
      the line target.
  - [x] The dragged element is excluded via `findInsertionSlot`'s new
        `excludeId`: it defines no row and joins no ripple, because it is the
        thing being inserted rather than something being pushed.
  - [x] The dragged note follows the pointer (a real, live tick, as any move
        does); the OTHER notes only stand aside at render time. Pinned in
        `useEditorDrag.insert-between.test.tsx` — the dragged note's x moves
        while `b` and `c` are still at 272 / 544.
  - [x] Alt is read from the pointer event (like `noSnap`), plus keydown /
        keyup listeners that REPLAY the last pointer position so the
        no-movement case works. Unlike the palette path, a pointer drag does
        receive key events — measured in the spike.
- [x] The dragged note sits IN the slot (`landNoteInSlot`). It cannot fight
      the hand: the slot only stays open while the note's centre is inside
      the gap plus the 32px hysteresis, so the note is never far from where
      it snaps. Recorded in `DECISIONS.md`.
- [x] On release with a slot open, the ripple is applied through the SAME
      gesture checkpoint the live ticks opened, so the drop is one history
      entry covering the ripple and the note's final position. Pinned by
      asserting exactly one checkpoint across the whole gesture.
- [x] The vacated position leaves a hole: nothing moves LEFT, anywhere — a
      note behind the source travels right with the rest of the board's
      right-hand side rather than closing up. Pinned.
- [x] Cancel paths: Escape mid-drag restores the pre-drag state exactly and
      unwinds the preview. Pinned.
- [x] Commit: `feat(canvas): insert an existing note between two others`.

---

## 6. Phase C — hostile paths (tests, not thought experiments)

- [x] Alt held on a **non-ES board**: nothing happens, on both drag paths.
- [x] Alt held while dragging a **non-sticky** on an ES board: nothing (Q2),
      on both paths.
- [x] Alt held while dragging a **multi-selection**: nothing (Q1), and the
      selection still drags together exactly as before.
- [x] Alt + **Cmd/Ctrl**: **insertion wins.** An open slot IS the placement,
      and snapping is irrelevant while one is open — two placement rules at
      once would put the note, the marker and the drop in three places.
      Recorded in `DECISIONS.md` and spec/60; pinned.
- [x] Alt + **Shift**: **drag-duplicate wins**, on both the slot and the hint.
      The gesture is already spoken for (spec/80). Pinned.
- [x] **Read-only / locked tab / blocked active layer**: no slot, both paths —
      one predicate, so neither path can disagree.
- [x] A **locked element** cannot be dragged at all: the gesture never starts,
      so no slot can open. Pinned.
- [x] **Undo/redo** round trip for the existing-note path: one checkpoint for
      the whole gesture is pinned in the unit test; the full round trip
      against stored state is phase D.
- [x] Dragging a note **within the row it is already in**: the slot is one
      note plus one gap, not two notes' worth, because the dragged note is
      excluded from the row it is measuring. Pinned.
- [x] Alt held, drag ending away from any gap: no insertion, no stranded
      preview — and every teardown path (drop, Escape, unmount) clears the
      channel.
- [x] **Zoom** 25% / 400% for both paths: the pointer delta is inverted
      through the zoom before it reaches the geometry. Pinned on both.

---

## 7. Phase D — proof

- [ ] Verify by hand in the browser with Playwright, both paths, with
      screenshots you actually look at: slot open mid-drag (palette), slot open
      mid-drag (existing note), and the committed result for each.
- [ ] **Do not test on the operator's board**
      (`da3af5be-b501-4ca8-92f3-2ec2a03aec75`). Create your own scratch
      diagrams and **delete them via the API when done**.
- [ ] Update the E2E smoke case: the current one drags a palette note into a
      gap with no modifier and expects insertion — it must become an Alt-held
      drag. Add the "no Alt, no insertion" assertion alongside it; that is the
      regression this whole change is about.
- [ ] Full gate green: `pnpm test`, `pnpm typecheck`, `pnpm lint`,
      `pnpm format:check`, `pnpm build`, plus the Playwright suite.

---

## 8. Phase E — docs, telemetry, fold-back

- [ ] **spec/139**: rewrite the insertion section — it currently describes
      automatic arming. State the Alt gesture, both entry points, the
      leave-the-hole rule, and WHY Alt (Ctrl and Shift are taken; record the
      reasoning so nobody "simplifies" it back later).
- [ ] **spec/58** and **spec/09**: correct anything that says a palette drag
      inserts on its own.
- [ ] **spec/60** (snap override): note the Alt/Ctrl precedence decided in
      phase C.
- [ ] **Help**: update `apps/help/app/canvas/event-storming-boards/page.mdx` —
      the gesture is now a named power feature, so it deserves a clear
      "Hold Alt to insert between two notes" passage covering both paths.
      Follow the help rules in `CLAUDE.md` if this grows into its own article.
- [ ] **Telemetry**: keep one event at the insertion commit; if the two entry
      points are worth telling apart, use the existing enums' `type` field
      rather than inventing a second action.
- [ ] Append one-liners to spec/139's **Domain learnings (session log)**.
- [ ] Fold-back: names match reality (nothing called `autoInsert`), module
      headers state what they ARE, no plan coordinates in comments, scratch
      files deleted, `LESSONS_LEARNED.md` updated if anything cost real time.

---

## 9. Definition of done

- [ ] Without Alt, both drag paths behave exactly as they did before the
      insertion feature existed — no slot, no ripple, no surprise.
- [ ] With Alt held on an ES board, dragging a palette note OR an existing
      sticky over a gap opens the slot live, and dropping commits in one
      undoable step.
- [ ] Releasing Alt mid-drag unwinds the preview immediately.
- [ ] A moved note leaves its original position empty.
- [ ] Nothing changes on non-ES boards, for any modifier.
- [ ] Specs, help and the E2E smoke reflect the new gesture; all gates green;
      verified by hand with screenshots.
