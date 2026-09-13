# Insert-between becomes an Alt-held gesture, for any sticky

**Status:** shipped.
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

- [x] Verified by hand in the browser (headless), both paths, with screenshots
      read by eye: `/tmp/lvd-alt/shots/11-drag-no-alt.png` (dragging a note
      with no modifier — the board is untouched and the hint offers the
      gesture), `12-alt-slot-open.png` (Alt pressed with the hand HELD STILL:
      slot open, marker drawn, note in the slot), `14-dropped.png` (committed;
      the minimap, which reads the model, finally shows the new order) and
      `15-undone.png` (one undo restores everything and greys out Undo).
      Measured positions at each step: `266.1 / 538.1 / 810.1` before and
      during a plain drag, `266.1 / 538.1 / 810.1` → ripple `810.1 / 1082.1`
      with Alt, and back again on release.
- [x] Scratch diagrams only, never the operator's board; the seven created
      under the operator's owner id were deleted through
      `DELETE /api/diagrams/:id` (all 204) and their board confirmed present
      afterwards.
- [x] E2E smoke updated: the palette case now asserts the no-modifier
      regression FIRST (the gap hovered, nothing moves) and then presses Alt
      mid-drag. A second case covers the existing-note path end to end,
      including Alt with the hand held still, the mid-drag unwind on release,
      the single-undo round trip and a reload.
  - [x] Found and fixed a latent harness bug while doing it: the quick-tour
        modal lands a beat after the canvas and silently swallows drags, and
        `if (await x.count())` raced it. Now a shared `dismissQuickTour`
        fixture that waits for it.
- [x] Full gate green: `pnpm test` (3,820), `pnpm typecheck`, `pnpm lint`
      (0 errors), `pnpm format:check`, `pnpm build`, plus all 7 Playwright
      smoke tests (run three times for the new ones; stable).

---

## 8. Phase E — docs, telemetry, fold-back

- [x] **spec/139**: the insertion section rewritten — the Alt gesture, both
      entry points, the leave-the-hole rule, the single-sticky rule, the
      precedence table, and WHY Alt (Ctrl and Shift are taken), plus why the
      copy says "press" rather than "hold". "Still ahead" no longer promises
      the existing-note path; it names vertical insertion instead.
- [x] **spec/58** and **spec/09**: both said a palette drag resolves a slot on
      its own. Corrected, including the new note-vs-shape rule and the `note`
      flag the ghost's preview now carries.
- [x] **spec/60**: records the Alt/Ctrl precedence — insertion wins, and why.
- [x] **spec/09** also renamed its "Shift hint banner" section to "Modifier
      hint banner" and describes the offer.
- [x] **Help**: `canvas/event-storming-boards` rewritten for the gesture —
      both entry points, the press-not-hold tip with its reason, the no-Alt
      guarantee, and the leave-the-hole rule. Registry keywords extended
      (`alt`, `option`, `modifier`, `move a note`, `resequence`, ...). Still a
      section rather than an article, so no registry count and no card art.
- [x] **Telemetry**: one `Canvas / Used / InsertBetween` at the commit, from
      either entry point, now pinned by a test (fires once, and only when an
      insertion actually happened). The entry points are deliberately not told
      apart — reasoning in `DECISIONS.md`. The dashboard's plain-English
      explanation mentions Alt.
- [x] Nine one-liners appended to spec/139's **Domain learnings** log.
- [x] Fold-back: nothing is named for automatic arming;
      `canInsertBetweenOn(gate, altHeld)` reads as the question it answers;
      the preview channel moved to `lib/insertion-preview.ts` now it has two
      publishers (its old home was named for the palette); `ShiftHintBanner`
      became `ModifierHintBanner`; `setInsertionDragInHand` says what it
      means. No plan coordinates in comments. Scratch scripts live in `/tmp`,
      outside the workspace. `LESSONS_LEARNED.md` gained the WM grab, the
      XTEST-vs-CDP point, the no-key-events-during-native-drag finding, the
      DOM-event-spread trap, the racing modal and the RTL cleanup rule.

---

## 9. Definition of done

- [x] Without Alt, both drag paths behave exactly as they did before the
      insertion feature existed — no slot, no ripple, no surprise. Asserted
      on both paths in unit tests AND in both E2E cases; measured in the
      browser as byte-identical note positions through a full hover.
- [x] With Alt on an ES board, dragging a palette note OR a note already on
      the board over a gap opens the slot live, and dropping commits in one
      undoable step (exactly one checkpoint per gesture; one Undo verified in
      the browser to restore the moved note's original position).
- [x] Releasing Alt mid-drag unwinds the preview immediately, and hands
      placement back to the ordinary snap.
- [x] A moved note leaves its original position empty — nothing closes up
      behind it.
- [x] Nothing changes on non-ES boards, for any modifier.
- [x] Specs, help and the E2E smoke reflect the new gesture; all gates green;
      verified by hand with screenshots.

## 10. Deviations from the plan (all deliberate, all recorded)

- **Alt with no mouse movement is not deliverable on the palette path.**
  Chromium sends no key events to the document during a native HTML5 drag, so
  the planned keydown/keyup listeners would have been dead code there. Measured
  in the spike; the pointer path has them and is fully live.
- **"Press Alt while dragging", not "hold Alt and drag"**, because the
  operator's window manager claims Alt+button-press. Reported before
  implementing; the operator chose to keep Alt and change the wording.
- **Q2 was extended to the palette path.** The plan scoped "non-stickies don't
  insert" to the existing-element path, but leaving the palette path able to
  insert a SHAPE would have made the two entry points answer the same question
  differently. Both now require a note.
- **Q4 reused the hint banner by generalising it** (`ShiftHintBanner` →
  `ModifierHintBanner`) rather than adding a surface, and the offer shows
  BEFORE Alt is pressed — a hint that only appears once you are already
  holding the key teaches nobody.
