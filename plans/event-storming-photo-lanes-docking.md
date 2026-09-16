# Event storming: timeline lanes, anchor docking, photo import

**Status:** planned, not started.
**Branch / worktree:** `es-photo-lanes-docking` in `~/Repositories/livediagram-eswall`
(a worktree off `origin/main`; the main checkout carries another agent's open PR,
leave it alone).
**Spec home:** [`specs/139-event-storming.md`](../specs/139-event-storming.md) — three
new phase sections (Phase 6 lanes, Phase 7 docking, Phase 8 photo import) plus new
domain learnings. Also touches [`specs/25-ai-assistance.md`](../specs/25-ai-assistance.md)
(a second AI route), [`specs/22-telemetry.md`](../specs/22-telemetry.md) (new event
types), [`specs/05-diagram-structure.md`](../specs/05-diagram-structure.md) (two new
optional fields), [`specs/11-api.md`](../specs/11-api.md) (route list),
[`specs/09-canvas-and-palette.md`](../specs/09-canvas-and-palette.md) +
[`specs/58-palette-drag-ghost.md`](../specs/58-palette-drag-ghost.md) (the snap ladder a
drag now walks), [`specs/06-secrets-policy.md`](../specs/06-secrets-policy.md) (photo
bytes never persist).

Everything below extends the shipped board kind. Read spec/139 END TO END first,
including the **Domain learnings (session log)** — every one of those one-liners was
paid for, and several of them (previews never write, one builder per note, one snap
computation per gesture, chrome must earn its place, a proxy identity always drifts)
are load-bearing for this plan.

---

## 1. What we are building

Three additions to the event-storming board kind, each gated on
`isEventStormingTab(activeTab)` so no other board's behaviour changes at all:

**A. Timeline lanes** ("timeline mode"). A board-level switch. When on, the board
carries an infinite stack of horizontal lanes (one note tall, evenly pitched, in
both directions). They are invisible until a note is being dragged — palette drag
or a note already on the board — and then only the lane the note would land on
lights up (plus its two neighbours, fainter). The note's **y snaps onto the lane**
and its **x snaps to a half-note grid**, so a note on one lane sits either
**exactly above** a note on the next lane or **staggered by half a note** — the
two arrangements the operator asked for, and nothing in between.

**B. Anchor docking.** The notation's own adjacencies become first-class. A
**Command** can be added standalone, **docked to the Domain Event it triggers**, or
**docked to the Policy that issues it**. A **Policy** can be standalone or **docked
to the Domain Event it reacts to**. A docked pair sits with a small seam between
the two notes and **two visual anchor points** (one dot on each facing edge) in
that seam. Hosts (events, policies) show a small anchor affordance on each
dockable face; clicking it adds the compatible note already docked and opens it
for typing. Dragging a note near a compatible face docks it magnetically; dragging
it away undocks it. Moving a host carries its docked notes.

**C. Photo import.** Photograph a piece of the wall — stickies, possibly
overlapping, possibly a region already partly on the board — and the board reads
the notes out of it: the **kind from the paper colour**, the **text from the
handwriting**, the **layout from the photo**. It then **reconciles** against what
the board already holds: notes that are already on the board are matched and
**left exactly as they are** (never moved, resized, re-kinded or re-worded), and
only the **new** notes are added, placed relative to the matched neighbours they
sat beside in the photo. On an empty board everything is added in the photo's
layout. A review step shows what was found and what will be added; the commit is
one undoable step. Repeating with the next photo of the next piece of wall adds
only what is new — that is what "incremental" means here.

### Why these three, on this board only

The x axis of an event-storming wall IS the domain content (spec/139, Phase 5).
Lanes give the y axis a grammar too (each lane is a row of the story, each column
a moment), docking makes the notation's adjacencies something the board KNOWS
rather than something the eye infers from two notes being close, and photo import
is how a real workshop — which always happens on a physical wall first — gets
onto the board without a transcription afternoon. On an ordinary diagram none of
these mean anything.

---

## 2. Order, and why

**Lanes → Docking → Photo import.** Lanes and docking are independent, small
geometry features. Photo import's placement engine COMPOSES both: new notes land
on lanes when lanes are on, and adjacent pairs in the photo land docked. Building
photo import first would mean building its placement twice. Within each phase the
order is spec → pure model → editor wiring → surfaces → verification → fold-back.

---

## 3. Settled decisions (do not re-litigate)

- **Event-storming boards only.** Gate everything on `isEventStormingTab(tab)`.
- **No new element type, no migration.** Two new OPTIONAL fields:
  `Tab.esTimeline` and `StickyElement.esDock` (shapes in §5). The tab body is
  stored as one JSON blob (`apps/api/src/tab-row.ts`), realtime element ops carry
  whole elements, the offline store keeps the tab as-is, JSON export/import round
  trips — so both fields travel everywhere for free. Verify that, don't assume it
  (tasks below).
- **Previews never touch the document.** Lane highlight, dock candidate, anchor
  hover, the insertion ripple: all render-time, published on module-level
  `useSyncExternalStore` stores exactly like `apps/live/lib/insertion-preview.ts`.
  No commit, no tick, no broadcast, no autosave, no dirty flag until the drop /
  click / "Add" that commits.
- **One builder per note.** Palette tap, palette drag, anchor-add and photo import
  all mint a note through the same construction (`draw-commit.ts`'s
  `eventStormingBoardStickyExtras` + `esBoardLayerStamp` + `esKind` + silhouette
  from `eventStormingNoteSize`). Extract it into one exported
  `buildEventStormingNote(...)` if it is not already callable from outside the
  draw gesture. Fill, silhouette, tilt, fixed size, auto-fit, caps, layer routing
  may never drift between entry points (spec/139 learning).
- **One snap computation per gesture.** Ghost, guides / lane highlight / dock
  dots, and the drop share ONE resolver each for the palette path
  (`palette-drag-snap.ts` + `usePaletteDragGuides.ts` + `usePaletteDrop.ts`) and
  the note-drag path (`boxed-drag-resolve.ts` + `useEditorDrag.ts`). A preview
  that disagrees with the drop is a lie (spec/58).
- **Drag precedence ladder** (top wins):
  1. an OPEN insertion slot (Alt) — it IS the placement (spec/139);
  2. Ctrl/Cmd free placement (spec/60) — skips dock, lanes, alignment;
  3. dock candidate (a compatible face within `ES_DOCK_SNAP_PX`);
  4. lane + half-note grid (when `esTimeline` is on);
  5. alignment + distribution snap (today's behaviour).
     Shift (drag-duplicate, spec/80) suppresses slot and dock, and lanes still
     apply to the clone.
- **Vision provider: OpenAI, already wired.** `OPENAI_API_KEY` gates the whole
  feature exactly as spec/25 does; when absent there is no photo UI at all. Chat
  Completions with an `image_url` data URL and **structured outputs**
  (`response_format: { type: 'json_schema', strict: true }`), **non-streaming**.
  Optional `OPENAI_VISION_MODEL` var, default `OPENAI_MODEL ?? 'gpt-4o'`. No new
  provider, no Workers AI.
- **The photo is never stored.** Not R2, not D1, not IndexedDB, not the change
  log. The client downscales it (longest edge ≤ 2048px, JPEG q0.85 via a canvas
  re-encode, honouring EXIF orientation with
  `createImageBitmap(file, { imageOrientation: 'from-image' })`) — which also
  drops EXIF — and sends the bytes to the api route, which forwards them to the
  model and discards them. The dialog says so in one line.
- **Perception is the model's job; reconciliation is ours.** The model returns
  what it SEES (text, colour → kind, silhouette, normalised box, row and order).
  Matching against the board and placement are pure, deterministic,
  unit-tested TypeScript in `@livediagram/diagram`. Never ask the model "which of
  these are already on the board".
- **Existing notes are untouchable by an import.** Additions only. Text
  differences on matched notes are SHOWN in review, never applied.
- **One undoable step** per commit (lane toggle, anchor-add, dock/undock on drop,
  photo import), through the ordinary `commit()` choke point so layer stamping,
  kind stamping, the activity log, autosave and realtime all happen as usual.
- **Feature visibility.** Photo import shows only when `capabilities.aiEnabled`
  (NOT gated on the AI-panel preference `aiAssistanceEnabled` — it is not the
  assistant). Every one of the three stands down in a read-only / view-role
  session, on a locked tab, and when the active layer is hidden or locked
  (`insertGate` / `createBlocked` already model this — reuse it).
- **Telemetry** goes through the closed enums in `@livediagram/api-schema`; types
  are preset tokens, never content.
- **Worktree + PM2.** Work in `~/Repositories/livediagram-eswall`. Run the dev
  stack under PM2 with names prefixed `livediagram-eswall-`. The main checkout's
  `livediagram-dev` holds the same ports (3000 router, 3001–3004 apps, 8787
  api): if they collide, `pm2 stop livediagram-dev` (ONLY that name; never
  `all`), note it in the final report, and never touch any other process.

---

## 4. Open questions — defaults to implement

Implement the default unless the parent session relays a different operator
answer BEFORE the phase that needs it. Escalate (ask, in a `question` block) only
if implementation reveals a default is wrong, or where marked **ASK FIRST**.

- [ ] **Q1 — Docking sides (ASK FIRST, before Phase 2 wiring).** The operator wrote
      "in front" for all three pairings. Brandolini's notation places a Command to
      the LEFT of its Event (command → event), a Command to the RIGHT of the Policy
      that issues it (policy → command), and a Policy to the RIGHT of the Event it
      reacts to (event → policy). _Default: the standard notation, as a
      catalogue (`ES_DOCKINGS`) with one row per pairing so a side is a one-line
      change._ The parent has asked the operator; if no answer has arrived when
      Phase 2 wiring starts, ask in a `question` block and continue with the
      pure model (which is side-agnostic) meanwhile.
- [ ] **Q2 — "Two visual anchor points".** _Default: a 16px seam between the docked
      notes, one small filled dot on each facing edge at mid-height, joined by
      nothing (two magnets, not a connector). Neutral ink, slightly stronger in
      dark mode._ Alternative if it reads wrong on the dev server: dots at the
      seam's top and bottom.
- [ ] **Q3 — Where the lanes switch lives.** _Default: a switch row at the top of the
      Event Storming palette category ("Timeline lanes"), a command-palette entry
      ("Turn timeline lanes on / off"), and the empty-canvas context menu on ES
      boards. No keyboard shortcut in v1. Stored on the tab (shared, synced)._
- [ ] **Q4 — Aligned vs staggered.** _Default: no mode toggle. The x grid is half a
      standard note (100px); a note can land exactly above the one on the lane
      above (same grid cell) or one cell (half a note) across. That is the whole
      of "either exactly above each other or staggered"._ Do not add a
      `stagger` setting unless the operator asks.
- [ ] **Q5 — Lane origin.** _Default: set ONCE when lanes are switched on — the
      top-left of the board's top-most, then left-most, note (`(0, 0)` on an empty
      board) — and stored (`esTimeline.originX / originY`). Existing notes are
      NOT re-snapped when lanes come on (no rearranging, ever); switching off
      keeps the origin so on/off is stable._ A "Snap all notes to lanes" verb is
      NOT in v1.
- [ ] **Q6 — Lane pitch.** _Default: `ES_LANE_PITCH = 200 + ES_LANE_GAP`, gap 40px,
      notes centred vertically on the lane (so the 180-tall wide kinds and the
      140-tall actor sit centred, like on a wall). Calibrate by eye on the dev
      server the way the tilt was; record the number and why in spec/139._
- [ ] **Q7 — Photo entry points.** _Default: (a) an "Add from photo" row at the top
      of the Event Storming palette category (camera glyph; on a phone the file
      input carries `capture="environment"` so the camera opens straight away);
      (b) a command-palette entry; (c) dropping or pasting an IMAGE FILE onto an
      ES board opens the same dialog with the file preloaded and a "Place as
      image instead" secondary action (on an ES board a photo is far more likely
      a wall than a picture element)._ (c) is the fork most likely to surprise:
      verify the existing image-drop path is only intercepted for `image/*`
      files on ES boards and everything else drops exactly as today.
- [ ] **Q8 — Zero notes found.** _Default: the dialog shows "No stickies found in
      this photo" with a one-line retake hint (fill the frame, straight on, good
      light); nothing is committed; "Try another photo" stays available._
- [ ] **Q9 — Where the photo lands when nothing matches on a non-empty board.**
      _Default: to the RIGHT of the board's bounding box, one note width away,
      its top row aligned to the board's top row (to the nearest lane when lanes
      are on). The x axis is time; a new piece of wall is most likely a
      continuation._
- [ ] **Q10 — Several photos.** _Default: one photo per run; after committing, the
      dialog offers "Add another photo" which starts the next run against the
      board as it now is (so overlap between photos is deduplicated by the
      ordinary matcher). Multi-file selection is a stretch task at the end._
- [ ] **Q11 — Matched notes whose text differs in the photo.** _Default: shown as
      "on the board as …" in the review list; never applied._
- [ ] **Q12 — Anchor affordance visibility.** _Default: hollow dot on each FREE
      dockable face of a host, shown while the host is hovered or selected, with
      a tooltip naming the act ("Add a command before this event"). Spec/139
      retired the four quick-connect pluses on this board as chrome; these are
      at most two per host, appear only on hover / selection, and each carries
      notation meaning — they earn their place. If they read as clutter on the
      dev server, escalate with a screenshot rather than removing them._
- [ ] **Q13 — Anchor-add placement when the spot is taken.** _Default: the new
      note lands at the docked position. If that footprint overlaps a visible
      boxed element, the board makes room with the shipped insertion ripple
      (`applyInsertionShift` from the seam's x, by note width + seam) in the SAME
      commit — the board opens only when there is no room, and the author sees
      the same ripple the Alt gesture taught them._
- [ ] **Q14 — Exports.** _Default: the SVG / PNG export draws the seam dots
      (notation paints wherever a note paints — the caps precedent). Lanes are
      never exported (they are a drag-time aid). Mermaid / Excalidraw / Markdown
      ignore both._
- [ ] **Q15 — Docked clusters and the insertion ripple.** _Default: a docked
      cluster moves WHOLE when the HOST's left edge is at or after the insertion
      point (the group precedent), and the seam is never offered as a gap (it is
      not one)._
- [ ] **Q16 — Live model calibration needs a key.** There is no
      `apps/api/.dev.vars` in this checkout, so `OPENAI_API_KEY` is absent
      locally. Build and prove the pipeline against a stubbed model (unit + e2e
      with a routed `/api/ai/photo-notes`), then **ASK** the operator for a key
      (they drop it into `apps/api/.dev.vars`; never print it, never commit it)
      and for two or three real wall photos to calibrate the prompt and the
      matcher thresholds against. Record the calibration in spec/139.

---

## 5. Model (the two fields, the catalogue, the pure modules)

All in `@livediagram/diagram` (`packages/diagram/src/`), pure, React-free, 100%
unit-tested, exported through `index.ts`.

```ts
// Tab (index.ts) — timeline lanes (spec/139 Phase 6). Present = on.
esTimeline?: {
  originX: number; // canvas x of grid cell 0
  originY: number; // canvas y of lane 0's TOP edge
};

// StickyElement (element-types.ts) — anchor docking (spec/139 Phase 7).
// Stored on the DOCKED note (the command / policy), pointing at its host.
esDock?: {
  hostId: ElementId;
  side: 'before' | 'after'; // where the docked note sits relative to the host, on the x axis
};
```

`packages/diagram/src/event-storming-lanes.ts`

- `ES_LANE_GAP`, `ES_LANE_PITCH`, `ES_GRID_CELL` (= `ES_NOTE_SIZE_PX.square.width / 2`).
- `laneIndexAt(y, timeline)`, `laneTop(index, timeline)`, `laneCentre(index, timeline)`.
- `snapToLanes(bounds, timeline, threshold)` → `{ x, y, laneIndex, cellIndex, snappedX, snappedY }`
  — centre-on-lane for y, left-edge-on-cell for x, each independently subject to
  the threshold (a note far from any lane is left alone: lanes are an aid, not a
  cage). Returns `null` when neither axis snapped.
- `initialTimelineOrigin(elements)` — Q5's rule.
- `visibleLaneIndices(viewport, timeline)` — the lanes to draw for a viewport.

`packages/diagram/src/event-storming-dock.ts`

- `ES_DOCKINGS: EsDocking[]` — `{ kind, hostKind, side }` × 3 (Q1).
- `ES_DOCK_SEAM_PX = 16`, `ES_DOCK_SNAP_PX = 40`, `ES_DOCK_DOT_R = 4`.
- `dockingFor(kind, hostKind)`, `dockableFaces(hostKind)` → `[{ side, kind }]`.
- `dockedBounds(host, side, kind)` — the docked note's x/y/w/h (x from the seam,
  y centred on the host's vertical centre).
- `findDockCandidate(candidate: bounds+kind, elements, excludeId)` → `{ hostId, side, bounds }`
  or `null`: nearest host with a FREE compatible face whose docked bounds are
  within `ES_DOCK_SNAP_PX` (both axes), excluding the dragged note, hidden /
  locked-layer elements and locked elements.
- `dockedNotesOf(hostId, elements)`, `dockClusterOf(id, elements)` (host + all its
  docked notes, either way in), `isFaceFree(hostId, side, elements)`.
- `seamDots(host, docked, side)` → the two dot centres, for the canvas and the
  SVG export to share.
- `stripDanglingDocks(before, after)` (the `freezeDanglingGroupEnds` precedent):
  a docked note whose host is gone becomes standalone.
- `undock(elements, id)`, `dock(elements, id, hostId, side)` — both return new
  arrays; `dock` also moves the note into `dockedBounds`.

`packages/diagram/src/event-storming-photo.ts`

- `DetectedNote` (the api DTO, re-exported from `@livediagram/api-schema`) and
  `BoardNote` (id, text, kind, x, y, width, height).
- `normaliseNoteText(s)` — uppercase, collapse whitespace, strip punctuation,
  trim.
- `noteTextSimilarity(a, b)` → 0..1 — normalised Levenshtein ratio with a
  prefix / containment floor (an occluded sticky yields a truncated read).
- `matchDetectedNotes(detected, existing, { threshold })` → greedy one-to-one
  best-first assignment with a kind bonus / penalty; second pass breaks ties
  between duplicate texts by geometric consistency with the fitted transform.
- `fitPhotoTransform(matches, detected, existing, defaultScale)` → uniform
  scale + translation (least squares on centres when ≥ 2 matches; translation
  only when 1; default when 0), scale clamped to `[0.5, 2] × defaultScale`.
- `defaultPhotoScale(detected)` — `200 / median(square-note width in the photo)`.
- `placeNewNotes(additions, transform, existing, { timeline, seedGap })` → canvas
  bounds per addition: transform the photo centre, snap to the nearest existing
  row (or lane when lanes are on) when within half a note height, then
  de-overlap ROW BY ROW pushing only NEW notes right (existing notes are
  immovable), with the row's prevailing gap (`insert-between.ts` already
  measures it — reuse, don't re-derive) or 24px, or the seam when the pair is a
  docking adjacency.
- `detectDockings(additions, existing, detected)` — a command immediately left
  of / overlapping an event, a command immediately right of a policy, a policy
  immediately right of an event, in PHOTO space → `esDock` on the addition
  (against an existing host or another addition).
- `reconcilePhoto(detected, existing, options)` → `{ matches, additions,
  transform, differences }` — the one entry point the dialog calls.

`@livediagram/api-schema` (`packages/api-schema/src/index.ts`)

- `PhotoNotesRequest = { image: string /* data URL, jpeg|png|webp */, tabName?: string }`
- `DetectedNote = { id: number; text: string; kind: EventStormingNoteKind | 'unknown';
  colour: string; size: 'square' | 'wide' | 'small'; cx: number; cy: number; w: number;
  h: number; row: number; order: number; confidence: number }` (all box fields
  normalised 0..1 to the image)
- `PhotoNotesResponse = { notes: DetectedNote[]; wall: boolean; hint?: string }`
  (`wall: false` = the model judged the photo is not a sticky wall).
- `PHOTO_MAX_BYTES`, `PHOTO_MAX_EDGE_PX`, `PHOTO_MAX_NOTES` (say 120) — shared
  by the client (pre-flight) and the route (hard cap).

---

## 6. Phase 0 — Setup and discovery

- [x] `cd ~/Repositories/livediagram-eswall && git fetch && git status` — confirm branch
      `es-photo-lanes-docking` tracking `origin/main`, clean tree.
- [x] `pnpm install`; then `pnpm lint && pnpm typecheck && pnpm test` for the
      baseline (start the test run under PM2 as `livediagram-eswall-tests` and tail
      its log; never pipe live output). Fix nothing yet; note any pre-existing
      failure in `DECISIONS.md` and fix it as the FIRST task if it is real.
- [x] Read end to end: `specs/139-event-storming.md`, `specs/25-ai-assistance.md`,
      `specs/58-palette-drag-ghost.md`, `specs/60` (free placement), `specs/80`
      (drag-duplicate), `specs/74-layers.md` (the creation gate), `specs/22-telemetry.md`,
      `specs/19-images.md` (accepted formats + the HEIC hint wording), `specs/06`.
- [x] Read the plans this extends: `plans/event-storming.md`,
      `plans/event-storming-insert-between.md`, `plans/event-storming-insert-alt-gesture.md`
      (their discovery sections list every file the drag machinery lives in).
- [x] Read the code the three features hook into, in this order:
  - [x] `packages/diagram/src/event-storming.ts` (+ test), `tab-kind.ts`,
        `element-types.ts` (StickyElement), `index.ts` (Tab), `duplicate.ts`,
        `groups.ts` (`freezeDanglingGroupEnds`), `layer-operations.ts`,
        `svg-render.ts` (how a sticky paints in export).
  - [x] `apps/live/lib/draw-commit.ts` (`eventStormingBoardStickyExtras`,
        `esBoardLayerStamp`, `buildDrawnBoxed`),
        `apps/live/app/diagram/[id]/useElementCreation.ts` (`addSticky`, the palette
        drop path), `apps/live/lib/insert-between.ts`, `apps/live/lib/insertion-preview.ts`,
        `apps/live/hooks/canvas/note-insertion-drag.ts`, `useInsertShift.ts`,
        `useEditorDrag.ts` (the move branch, `onAltChange`, the drop), `boxed-drag-resolve.ts`,
        `useSnapGuideState.ts`, `usePaletteDragGuides.ts`, `usePaletteDrop.ts`,
        `apps/live/lib/palette-drag-snap.ts`, `palette-drag-preview.ts`,
        `apps/live/components/canvas/PaletteDragGhost.tsx`, `CanvasChrome.tsx`,
        `CanvasGuideOverlay.tsx`, `CanvasElementsLayer.tsx`, `CanvasSelectionToolbars.tsx`,
        `apps/live/components/chrome/ModifierHintBanner.tsx`.
  - [x] `apps/live/app/diagram/[id]/useEditorState.ts` — find `insertGate`, the
        `commit` choke point, `activeTab`, how `tabLocked` / read-only are exposed;
        note the file is an orchestration root (exempt from the line target) —
        add a HOOK per feature and wire it with the smallest edit.
  - [x] `apps/live/components/palette/palette-categories.tsx`, `PaletteToolRows.tsx`,
        `palette-tile-defs.tsx` (+ test), `EditorContextMenu.tsx` (+ `.types.ts`,
        the ES verb list), `CommandPalette.tsx`, `context-menu-icons.tsx`.
  - [x] `apps/live/hooks/canvas/useClipboard.ts` + `apps/live/components/canvas/ImageDropZone.tsx`
        + wherever the canvas accepts a dropped image file (grep `dataTransfer.files`
        in `apps/live`), `apps/live/lib/upload-image.ts` (`UPLOAD_ACCEPT_ATTR`).
  - [x] `apps/api/src/routes/ai.ts` (+ test, how fetch is stubbed), `ai-prompt.ts`,
        `capabilities.ts`, `index.ts` (the `case 'ai'` dispatch), `types.ts` (Env),
        `apps/api/wrangler.toml` (AI_RATE_LIMITER + the OPENAI comment block),
        `apps/api/.env.example`, `apps/api/src/openapi/manifest.ts` (the `/ai` entry),
        `apps/live/lib/api/ai.ts` (`apiGetCapabilities`, `apiAiStream`),
        `apps/live/hooks/persistence/useCapabilities.ts`.
  - [x] `apps/live/e2e/smoke.spec.ts` + `fixtures.ts` (`startTemplateDiagram`),
        `apps/live/playwright.config.ts`, `scripts/e2e-stack.mjs`.
  - [x] `packages/help-registry/src/index.ts` (both ES entries),
        `apps/help/app/canvas/event-storming-boards/page.mdx`,
        `apps/help/lib/featureIcons.tsx`, `featureColours.ts`.
  - [x] `packages/api-schema/src/telemetry-schema.ts` (the closed enums),
        `apps/live/lib/telemetry.ts`.
- [x] Start the dev stack under PM2 from the worktree (`livediagram-eswall-dev`),
      confirm `http://localhost:3000/new` → Technical → Event storming opens a board,
      and that `GET /api/capabilities` reports `aiEnabled: false` (no key yet).
- [x] Write the three spec/139 phase section STUBS (headings + the one-paragraph
      "what" from §1 + the settled decisions that apply) so each phase below can
      fill its section as it lands (spec-first).
- [x] Commit: `docs(specs): stub event-storming phases 6-8`.

---

## 7. Phase 1 — Timeline lanes

### 1.1 Spec

- [x] Spec/139 Phase 6 section: the switch, the field, the origin rule (Q5), the
      pitch + grid (Q4, Q6), visibility (only during a drag; the lane under the
      note + two fainter neighbours; viewport-spanning because the lanes are
      infinite), the precedence ladder (§3), what happens on existing boards
      (nothing moves), export (never), telemetry, and the "not in v1" list (no
      shortcut, no snap-all, no vertical lanes).
- [x] Spec/05: `Tab.esTimeline` documented beside `kind`.
- [x] Commit.

### 1.2 Pure model (`event-storming-lanes.ts`)

- [x] RED: `event-storming-lanes.test.ts` — lane index / top / centre round trips;
      `snapToLanes` snaps y to the lane centre-line within threshold and leaves it
      alone beyond; snaps x to the half-note grid for square (2 cells), wide (3
      cells), small (left edge only) silhouettes; both axes independent; `null` when
      neither snaps; negative lanes and cells (the stack is infinite both ways);
      `initialTimelineOrigin` picks top-most then left-most, `(0,0)` when empty,
      ignores non-sticky elements and hidden-layer elements; `visibleLaneIndices`
      covers a viewport exactly (inclusive at both edges) at any zoom.
- [x] GREEN: implement. Export from `index.ts`.
- [x] Add `esTimeline?` to `Tab` with the comment explaining WHAT it is (present =
      on, origin = where lanes are anchored, pitch is a constant not a field, and
      why: one rhythm per board is the point).
- [x] Verify the field survives the two stores: extend `apps/live/lib/api/core.test.ts`
      (`tabForWire` keeps it) and `apps/live/lib/offline/offline-store.test.ts`
      (`upsertTab` keeps it); the api's `rowToTab` spread test in
      `apps/api/src/tab-row.test.ts` if it enumerates fields.
- [x] Commit: `feat(diagram): timeline lane geometry for event-storming boards`.

### 1.3 The switch (state + surfaces)

- [x] `apps/live/hooks/canvas/useTimelineLanes.ts` — reads `activeTab.esTimeline`,
      exposes `lanesOn`, `toggleLanes()` (commits `esTimeline` set from
      `initialTimelineOrigin(activeTab.elements)` or removed, one undo step,
      activity-log entry "Turned timeline lanes on/off"), gated: no-op + disabled
      when read-only / tab locked. Wired into `useEditorState` with the smallest
      edit; exposed on `EditorContextValue`.
- [x] Telemetry: add `'TimelineLanesOn' | 'TimelineLanesOff'` as `Canvas / Used`
      types; `track` in `toggleLanes` BEFORE the commit (the settings-flip
      precedent). Spec/22 table row.
- [x] Palette: a switch row at the top of the Event Storming category
      (`PaletteToolRows.tsx` / a small `EventStormingBoardRow` component if the row
      shape does not exist yet — a labelled row with a toggle, keyboard operable,
      `aria-pressed`, WCAG AA contrast in both schemes). Hidden when the active tab
      is not an ES board (the category still renders elsewhere for favourites).
- [x] Command palette (`CommandPalette.tsx`): "Turn timeline lanes on" / "… off",
      ES boards only, with the same gate.
- [x] Empty-canvas context menu on ES boards: the same verb (check
      `EditorContextMenu` has a canvas-level menu; if not, skip and note it in the
      spec rather than inventing one).
- [x] Tests: hook test (toggle on sets origin from notes; off removes the field;
      on again keeps the STORED origin — Q5; disabled paths), palette row test
      (renders only on ES boards, toggles, a11y name), command palette entry test.
- [x] Commit: `feat(live): timeline lanes switch on event-storming boards`.

### 1.4 Snapping — note drag

- [ ] `apps/live/lib/lane-preview.ts` — a module-level store (the
      `insertion-preview.ts` pattern) publishing `{ laneIndex, cellIndex } | null`
      for the lane / cell currently lit, with `useLanePreview()`. Value-equal
      short-circuit so pointer-rate moves don't re-render the overlay.
- [ ] `boxed-drag-resolve.ts` `resolveBoxedMove`: after the precedence ladder's
      earlier rungs, when `timeline` is passed and the drag is a SINGLE sticky (the
      note grammar again — a multi-selection or a shape drags as today), snap via
      `snapToLanes` and return `{ tx, ty, lane }`; alignment snap stands down on any
      axis the lane took. Threshold: the lane wins within half the lane gap on y and
      half a cell on x (tests pin the numbers).
- [ ] `useEditorDrag.ts`: thread `activeTab.esTimeline` through `EditorDragDeps`,
      publish the lit lane to `lane-preview` on every move, clear it on up / cancel
      / Escape. Free placement (Ctrl/Cmd) skips it; an open insertion slot wins
      over it; Shift-duplicate clones still snap.
- [ ] RED/GREEN tests: `boxed-drag-resolve.test.ts` (existing? extend) for each
      ladder rung; `useEditorDrag.lanes.test.tsx` mirroring
      `useEditorDrag.insert-between.test.tsx`: a note drag lights the lane, drops
      on it, clears the store; Ctrl skips; Alt slot wins; multi-select does not snap.
- [ ] Commit: `feat(live): notes snap to timeline lanes while dragged`.

### 1.5 Snapping — palette drag

- [ ] `palette-drag-snap.ts`: extend the pure snap with the lane rung (same
      function as 1.4 — if the two paths' snap helpers differ in shape, extract the
      lane rung into ONE helper both call; do not implement it twice).
- [ ] `usePaletteDragGuides.ts`: publish the lit lane; `usePaletteDrop.ts` consumes
      the same offset for the drop; `PaletteDragGhost.tsx` lands the ghost on the
      lane (the footprint already knows its silhouette).
- [ ] Tests extend `palette-drag-snap.test.ts` and `usePaletteDragGuides.test.tsx`.
- [ ] Commit: `feat(live): palette notes snap to timeline lanes`.

### 1.6 Rendering the lanes

- [ ] `apps/live/components/canvas/TimelineLanesOverlay.tsx` — rendered from
      `CanvasChrome` (beside `CanvasGuideOverlay`), only while a drag is in hand on
      an ES board with lanes on (`useLanePreview() !== null`). Draws the lit lane as
      a faint band (lane top → bottom, viewport-wide, in the guides' visual language:
      the tab accent at low alpha) with a 1px centre-line, the two neighbouring
      lanes at half that alpha, and a short vertical tick at the snapped cell on the
      lit lane. Pure SVG converting canvas → client via wrapper rect + zoom exactly
      as `CanvasGuideOverlay` does. `pointer-events: none`. Reduced motion: no
      fade; otherwise a 120ms opacity ease in / out, mounted for the whole drag so
      the unmount never snaps (the `useInsertShift` lesson).
- [ ] Zero CLS: the overlay is absolutely positioned inside the wrapper and never
      affects layout.
- [ ] Dark scheme: verify the band reads on the dark dot-grid (spec/139's
      "recessed dot" lesson — go darker than the backdrop if a lighter band washes
      out).
- [ ] Component test: renders nothing without a lit lane; renders three bands +
      tick with a lit lane; converts coords at zoom 0.5 / 2.
- [ ] Commit: `feat(live): light the timeline lane under a dragged note`.

### 1.7 Interplay

- [ ] Insert-between on a lanes-on board: `findInsertionSlot`'s `shiftDx` rounds UP
      to a whole number of grid cells (so a rippled row stays on the grid); test.
- [ ] Shift-duplicate clone lands on the lane; test.
- [ ] Undo of the lanes toggle restores the field; redo re-applies; realtime peer
      receives the tab-field change (verify in two browser tabs on the dev
      server).
- [ ] The tour (spec/79) does not point at the new palette row; the modifier hint
      banner is unchanged.
- [ ] Commit.

### 1.8 Verification (proof, not tests)

- [ ] Dev server, playwright-cli: create an ES board, add three events, switch
      lanes on, drag a fourth note — the lane lights, the note lands centred on it
      and on a grid cell; drag a fifth onto the next lane exactly above; a sixth
      staggered by half a note; Ctrl-drag places freely; Alt over a gap still
      inserts. Screenshot both colour schemes into `/tmp` and eyeball them.
- [ ] Reload: lanes still on, origin unchanged, nothing moved.
- [ ] Non-ES board: nothing in the palette, no lanes, no store activity.
- [ ] Spec/139 Phase 6 filled in with what SHIPPED (numbers, wording); domain
      learnings appended (at least: "lanes are an aid, not a cage").
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; commit.

---

## 8. Phase 2 — Anchor docking

### 2.1 Spec

- [ ] Resolve Q1 (ask if unanswered). Spec/139 Phase 7 section: the catalogue
      (three pairings, with sides and WHY those sides — the notation), the field,
      the seam + dots (Q2), the three ways a command is added / two ways a policy is
      (§1 B), affordances (Q12), magnetic docking on drag, undocking, host moves
      carry docked notes, deletion strips, copy rules (a copy of a docked note alone
      is standalone — a new piece of paper; host + docked copied together keep the
      relation with fresh ids), the ripple rule (Q13, Q15), exports (Q14),
      telemetry, and "not in v1" (the further pairings in §11).
- [ ] Spec/05: `StickyElement.esDock`.
- [ ] Commit.

### 2.2 Pure model (`event-storming-dock.ts`)

- [ ] RED: `event-storming-dock.test.ts` — catalogue is total over the three
      pairings and nothing else; `dockableFaces` per host kind; `dockedBounds` for
      both sides and mixed heights (policy 180 after event 200 → centred);
      `findDockCandidate` picks the nearest FREE compatible face within the snap
      distance, ignores occupied faces, locked elements, hidden / locked layers,
      the dragged note itself, and non-hosts; `isFaceFree`; `dockClusterOf`
      symmetric (asking from host or from docked note returns the same set);
      `seamDots` positions for both sides; `stripDanglingDocks` drops the field
      when the host disappears and leaves everything else untouched; `dock`
      moves the note into place and stamps the field; `undock` removes the field
      and nothing else.
- [ ] GREEN: implement. Export from `index.ts`.
- [ ] Add `esDock?` to `StickyElement` with the WHAT comment (stored on the docked
      note; the host has no back-reference so a host can be deleted without a
      write to its neighbours; readers derive the cluster).
- [ ] Wire `stripDanglingDocks` next to every `freezeDanglingGroupEnds` call site
      (`useElementSelectionActions.ts` ×2, `layer-operations.ts`) — extract ONE
      `afterElementsRemoved(before, after)` helper if that is the third caller of
      the same pair; tests.
- [ ] `duplicate.ts`: remap `esDock.hostId` when both ends are in the copied set
      (the `groupId` remap precedent), strip it when only the docked note is copied;
      tests.
- [ ] Import / merge (`import-merge.ts`) and cross-tab paste: a dangling `hostId`
      is stripped on the way in; test.
- [ ] Commit: `feat(diagram): anchor docking model for event-storming notes`.

### 2.3 Rendering — seam dots + affordances

- [ ] `apps/live/components/canvas/DockSeams.tsx` — for the active tab's docked
      pairs, draws the two dots per seam (`seamDots`), in the elements layer so they
      z-order with the notes (under the notes' shadows, above the backdrop), tab
      accent-neutral ink (`deriveTextColorForBg` of the backdrop at ~55% alpha; a
      touch stronger in dark). Follows the insertion ripple's `translateX` for the
      cluster (both notes shift, so the dots must too — read `useInsertShift`).
- [ ] `apps/live/components/canvas/DockAnchors.tsx` — the hollow affordance dots on
      a HOVERED or SELECTED host's free faces (Q12). Each is a real `<button>` with
      an accessible name ("Add a command before this event"), keyboard reachable
      when the host is selected (Tab cycles them), 24px hit target around a 8px
      dot, tooltip via the shared `Tooltip`. Stand down while any drag is in hand,
      in read-only, on a locked tab / element, when the creation gate is blocked.
      Hover on the affordance shows the ghost silhouette of the note that would be
      added (the palette ghost's footprint styling) — stretch, do the tooltip first.
- [ ] Dock CANDIDATE during a drag: `apps/live/lib/dock-preview.ts` module store
      publishing `{ hostId, side, bounds } | null`; `DockSeams` draws the two dots in
      the guides' accent while a candidate is live (the "magnets" lighting up).
- [ ] SVG export (`svg-render.ts`): draw the seam dots for docked pairs (Q14), same
      geometry via `seamDots`; test extends `svg-render.test.ts`.
- [ ] Component tests for all three; export test.
- [ ] Commit: `feat(live): anchor dots for docked event-storming notes`.

### 2.4 Anchor-add (click an affordance)

- [ ] `apps/live/hooks/canvas/useDockActions.ts` — `addDockedNote(hostId, side)`:
      builds the note through the ONE builder (§3) at `dockedBounds`, stamps
      `esDock`, applies Q13's ripple when the footprint collides, commits as one
      step (activity log: "Added a Command before Order placed"), selects it and
      opens the label editor (the drop-then-type rule), tracks
      `Element / Added / Sticky` + `Canvas / Used / DockAdd`. Also `undock(id)` and
      `dockTo(id, hostId, side)` for the menu + drop.
- [ ] Wire `DockAnchors` → `addDockedNote`; keyboard: Enter / Space on the focused
      affordance.
- [ ] Context-menu verb on a docked note: "Undock" (ES verb list,
      `EditorContextMenu.types.ts`); selection caption "Selected Command · docked
      to ORDER PLACED" if the caption helper can take a suffix cheaply — otherwise
      skip and note it.
- [ ] Tests: hook (all three pairings; occupied face refuses; ripple only on
      collision; one undo step; gate paths); menu verb test.
- [ ] Commit: `feat(live): add a docked note from a host's anchor`.

### 2.5 Magnetic docking on drag (note drag + palette drag)

- [ ] Precedence rung 3 in BOTH resolvers (1.4 / 1.5): when the dragged thing is a
      single sticky of a dockable kind and `findDockCandidate` returns one, the
      candidate's bounds ARE the placement; publish to `dock-preview`; lanes and
      alignment stand down. Ctrl skips; Alt slot wins; Shift suppresses.
- [ ] Drop: stamp `esDock` (`dock`), in the same checkpoint as the move (one undo
      step); track `Canvas / Used / Dock`. Dragging a DOCKED note beyond
      `ES_DOCK_SNAP_PX` of its docked position and dropping → `undock` in the same
      step; track `Canvas / Used / Undock`. Dragging it back within range re-docks.
- [ ] Host drag carries its cluster: when the primary is a host with docked notes
      and the selection is just the host, the move translates the cluster (extend
      `startBounds` to the cluster — the group precedent in `selectionMembers`);
      a docked note is NOT carried when the host is moved as part of a
      multi-selection that already contains it (no double move); tests.
- [ ] Modifier hint banner: while a dockable note is on the move near nothing,
      no hint; a candidate live → the banner is not needed (the dots say it).
      Confirm nothing regresses in `ModifierHintBanner` tests.
- [ ] Tests mirror 1.4 / 1.5 for the dock rung, plus the undock-on-drag path and
      the cluster move.
- [ ] Commit: `feat(live): notes dock magnetically to a compatible face`.

### 2.6 Interplay

- [ ] Insert-between: `findInsertionSlot` never offers a seam as a gap; the cluster
      shifts whole by the host's left edge (Q15); a dragged HOST excludes its whole
      cluster from the reckoning (`excludeId` → `excludeIds`); tests in
      `insert-between.test.ts` + `note-insertion-drag.test.ts`.
- [ ] Lanes: a docked note follows its host's y (centred on the host), not its own
      lane; the host snaps to lanes as usual; test.
- [ ] Bring to front / send to back on a docked pair: unchanged (the dots are drawn
      under both).
- [ ] Delete host → docked note stays, standalone; delete docked note → nothing
      else changes; undo restores the relation (it is on the element).
- [ ] Realtime: two browser tabs — dock in one, the other shows the dots; undock;
      delete host in one while the other drags the docked note (the drop must not
      resurrect the field: `stripDanglingDocks` runs on the live tab at drop).
- [ ] Offline board round trip; JSON export → import keeps the relation.
- [ ] Commit.

### 2.7 Verification

- [ ] Dev server, playwright-cli: hover an event → two hollow dots (west, east);
      click west → a docked command opens for typing, dots in the seam; click east
      → docked policy; hover the policy → east dot → docked command; drag a
      standalone command near an event's west face → magnets light → drop docks;
      drag it away → undocks; drag the event → the cluster moves; Alt-insert
      elsewhere ripples the cluster whole; export SVG shows the dots; both colour
      schemes screenshotted.
- [ ] Spec/139 Phase 7 filled in; learnings appended (at least: "the docked note
      holds the relation, the host holds nothing", "magnets, not connectors").
- [ ] Quality gate green; commit.

---

## 9. Phase 3 — Photo import

### 3.1 Spec

- [ ] Spec/139 Phase 8 section: the entry points (Q7), the flow (pick → read →
      review → add), what the model is asked for and what it is NOT asked (§3),
      the reconciliation rules (matched notes untouchable; additions placed by the
      fitted transform; rows / lanes; de-overlap pushes only new notes; docking
      adjacencies), the empty-board case, the no-match case (Q9), review dialog
      contents, privacy (photo never stored, downscaled client-side, one line in the
      dialog), gates, errors, telemetry, "not in v1" (multi-file, applying text
      differences, arrows / hotspot links from the photo).
- [ ] Spec/25: `POST /api/ai/photo-notes` documented beside `/api/ai` (auth, gates,
      caps, request / response, error tokens, `OPENAI_VISION_MODEL`); the env-var
      table row; "Out of scope" line about image generation stays true.
- [ ] Spec/11 route list; `apps/api/src/openapi/manifest.ts` entry (+ its test);
      spec/06 one line (photo bytes are transient).
- [ ] Commit.

### 3.2 API route

- [ ] Extract the shared AI gate out of `handleAi` into `apps/api/src/routes/ai-gate.ts`
      (`aiGate(ctx)` → `Response | null`: key present, origin allow-list, Clerk-only
      flag, owner, method, rate limiter) and make `handleAi` use it — its tests must
      stay green unchanged (they pin the gate order).
- [ ] `apps/api/src/routes/ai-photo-notes.ts` — `handleAiPhotoNotes(ctx)`: gate;
      JSON body `{ image, tabName? }`; validate the data URL prefix against the
      spec/19 whitelist minus GIF (`image/jpeg|png|webp`), decoded size ≤
      `PHOTO_MAX_BYTES`; build the prompt (`ai-photo-prompt.ts`: the legend from
      `EVENT_STORMING_NOTES` — never a hand-copied colour table — silhouettes,
      "read every sticky, including partially covered ones, text verbatim, do not
      invent", row / order semantics, normalised boxes, `wall: false` when this
      is not a sticky wall); call OpenAI non-streaming with `detail: 'high'`,
      `max_tokens` sized for `PHOTO_MAX_NOTES`, strict JSON schema; parse, clamp
      (drop notes with empty text or boxes outside 0..1, cap count), respond
      `PhotoNotesResponse`. Errors: the four spec/25 tokens plus `photo_invalid`
      (400) and `photo_too_large` (413). Log the model's status + note count (no
      image bytes, no text) so a failure is diagnosable.
- [ ] `index.ts`: `case 'ai'` dispatches on `segments[2]` (`undefined` → `handleAi`,
      `'photo-notes'` → new handler, else 404).
- [ ] `types.ts` Env: `OPENAI_VISION_MODEL?`; `wrangler.toml` comment block +
      `.env.example` + `docs/self-hosting.md` + `docs/local-development.md` env var
      notes updated in the same commit.
- [ ] RED/GREEN tests `ai-photo-notes.test.ts`: every gate path (503 no key, 403
      origin, 401 clerk, 401 no owner, 405, 429), 400 bad JSON / bad prefix / GIF /
      SVG, 413 too large, 502 model failure, 200 happy path with a stubbed fetch
      returning a schema-shaped body, clamping of out-of-range boxes and over-cap
      counts, `wall: false` passthrough; `ai-photo-prompt.test.ts` pins that the
      legend is derived from the catalogue (the spec/25 "read the prompt's own
      source" precedent).
- [ ] Commit: `feat(api): read sticky notes out of a wall photo`.

### 3.3 Pure reconciliation (`event-storming-photo.ts`)

- [ ] RED: `event-storming-photo.test.ts` — text normalisation; similarity (exact
      1, case / punctuation-insensitive, truncated read ≥ floor, unrelated ≈ 0);
      matching (one-to-one; threshold; kind bonus / penalty; `unknown` kind matches
      on text alone; duplicate board texts resolved by geometry; nothing matches on
      an empty board); transform (≥ 2 matches recovers a known scale + offset; 1
      match → default scale; 0 → default scale + Q9 offset; scale clamp);
      `defaultPhotoScale` from the median square width; placement (additions land
      at the transformed centre, snap to an existing row within half a height,
      snap to a lane when lanes are on, de-overlap pushes only NEW notes, existing
      bounds are byte-identical before and after, prevailing gap reused, seam gap
      for docked pairs); `detectDockings` for all three pairings from photo
      adjacency (overlap or gap < a quarter note), never against an occupied face;
      `reconcilePhoto` end to end on three fixtures: empty board, partial overlap
      with an earlier photo, a photo of a region entirely already on the board
      (zero additions).
- [ ] GREEN: implement. Keep each helper small and named; no god module — if the
      file passes ~400 lines split matching / transform / placement into siblings.
- [ ] Commit: `feat(diagram): reconcile a wall photo against the board`.

### 3.4 Client: capability, request, pre-processing

- [ ] `apps/live/lib/api/ai.ts`: `apiAiPhotoNotes(image: string, tabName)` →
      `PhotoNotesResponse`, mapping error tokens to typed errors (the existing
      `off_topic` mapping precedent); test.
- [ ] `apps/live/lib/photo-prepare.ts`: `preparePhoto(file)` → data URL —
      `createImageBitmap` with `imageOrientation: 'from-image'`, downscale to
      `PHOTO_MAX_EDGE_PX`, `toBlob('image/jpeg', 0.85)`, reject unsupported types
      with the spec/19 hint wording (HEIC → "save as JPEG"), reject > `PHOTO_MAX_BYTES`
      after encode; unit-tested with a stubbed bitmap / canvas (jsdom) and a real
      small PNG fixture.
- [ ] `useCapabilities` already exposes `aiEnabled`; add nothing unless the route
      needs its own flag (it does not — same key).
- [ ] Commit.

### 3.5 The dialog

- [ ] `apps/live/components/dialogs/PhotoImportDialog.tsx` (+ `usePhotoImport.ts`
      state machine: `idle → preparing → reading → review → committing → done`, plus
      `error` with retry; every transition logged at debug level). Contents:
  - [ ] **Pick**: `ImageDropZone` (reuse; `capture="environment"` on the input via a
        prop — extend the component, don't copy it), paste support, the privacy
        line, and the "Place as image instead" secondary action when the dialog
        was opened by an image drop (Q7c).
  - [ ] **Reading**: the photo with a progress state; cancellable (abort the fetch).
  - [ ] **Review**: the photo with each detected note outlined in its kind colour
        and badged NEW / ON BOARD / SKIP; a list with per-note include checkbox,
        editable text, kind select (the catalogue's eight), the "on the board as …"
        line for matched notes (Q11), a "Dock to …" chip where a docking was
        detected (can be unticked); header counts ("14 read · 9 new · 5 already on
        the board"); primary button "Add 9 notes" (disabled at 0), secondary
        "Try another photo". `wall: false` → the Q8 empty state.
  - [ ] **Commit**: `reconcilePhoto` re-runs against the LIVE tab at click time (a
        peer may have edited; the insert-between precedent), then ONE `commit()`
        adding every included note through the one builder (fill, silhouette, tilt,
        fixed, auto-fit, layer stamp, `esKind`, `esDock`), selects them, activity
        log "Added 9 notes from a photo", `track('AI', 'Used', 'PhotoNotes')` once +
        `Element / Added / Sticky` per note, then the Q10 "Add another photo" state.
  - [ ] Dark mode, WCAG AA (labels, focus order, `aria-live` for the count line,
        Escape closes, focus returns to the opener), zero CLS (reserve the photo
        area's height; no inline banners — errors are toasts).
- [ ] Entry points (Q7): palette row "Add from photo" at the top of the ES category
      (camera glyph; hidden without `aiEnabled` or when the gate blocks); command
      palette entry; image-file drop / paste on an ES board routes to the dialog
      (find the existing handler, branch on `isEventStormingTab && aiEnabled &&
      file.type startsWith image/`, everything else untouched).
- [ ] Tests: state machine (every transition incl. abort + error + retry), review
      list editing changes what is committed, commit uses the one builder (assert
      `fixedSize`, `esKind`, `textSize: 'scale'`, layer id, tilt within ±1.1), one
      undo step, gate paths (read-only hides the row and refuses the drop route),
      drop routing on ES vs non-ES boards.
- [ ] Commit: `feat(live): import sticky notes from a wall photo`.

### 3.6 E2E (mocked model)

- [ ] `apps/live/e2e/photo-import.spec.ts`: route `**/api/capabilities` →
      `{ aiEnabled: true, … }` and `**/api/ai/photo-notes` → a fixture response
      (`e2e/fixtures/wall-photo.json`, hand-written against a fixture image
      `e2e/fixtures/wall-photo.jpg` you GENERATE by exporting an ES board with six
      notes to PNG and re-encoding — no real photo needed). Cases: empty board →
      six notes added at the photo's layout; import the same photo again → zero
      additions; a second fixture overlapping three of the six → three added to the
      right of the matched ones; reload keeps everything; Undo removes the batch.
      Dark scheme per the testing rule.
- [ ] Run it against the real stack (`livediagram-eswall-e2e` under PM2), green.
- [ ] Commit.

### 3.7 Live calibration (needs the operator — Q16)

- [ ] Ask for `OPENAI_API_KEY` in `apps/api/.dev.vars` and 2–3 real wall photos
      (`question` block). Never print, log or commit the key; never commit the
      photos (put them in `/tmp` or a gitignored folder).
- [ ] Run each photo through the dialog on the dev server; read the api log for the
      model status + counts; tune the prompt (legend wording, "verbatim", occlusion
      guidance) and the matcher threshold until: every legible sticky is read, kinds
      are right, a re-import adds nothing, and an overlapping second photo adds only
      the new notes in the right places. Record the numbers + one paragraph of what
      needed tuning in spec/139.
- [ ] If no key is available, record that the live calibration is OUTSTANDING in
      spec/139 (explicitly, not as "verified") and in the final report.

### 3.8 Verification

- [ ] Dev server walkthrough of every path in §10 C (with the mocked route via
      playwright-cli where the real model is unavailable).
- [ ] Spec/139 Phase 8 filled in; learnings appended (at least: "perception is the
      model's, reconciliation is ours", "existing notes are immovable").
- [ ] Quality gate green; commit.

---

## 10. Every path (the test matrix each phase must cover)

**A. Lanes** — on/off; on with an empty board (origin 0,0); on with notes (origin
from the top-left note; nothing moves); off then on (stored origin kept); note
drag lit / snapped / cleared on drop, on Escape, on pointer cancel, on tab switch
mid-drag; palette drag the same; Ctrl skips; Alt slot wins; Shift clone snaps;
multi-select does not snap; shapes / arrows / images never snap; negative lanes;
zoom 0.25 and 4; read-only hides the switch; locked tab disables it; hidden /
locked active layer disables it; realtime peer sees the toggle; undo / redo;
offline board; JSON round trip; non-ES board untouched; dark scheme legible;
reduced motion.

**B. Docking** — each of the three pairings by anchor click and by drag, both
sides free / occupied; palette-drag docking; undock by drag, by menu; host move
carries cluster; multi-selection containing both does not double-move; delete
host / delete docked / undo each; duplicate docked alone / with host / with host
and two docked; copy-paste across tabs; import with a dangling host; locked host
refuses docking; hidden-layer host invisible to the candidate search; insertion
ripple with a cluster on both sides of the point; seam never a gap; lanes + dock
(docked follows host); exports (SVG dots present; PNG via SVG); realtime dock /
undock / host deleted under a drag; read-only shows dots but no affordances; a11y
names + keyboard on affordances; dark scheme.

**C. Photo import** — no key (no UI anywhere); key + read-only (no UI); key +
locked tab / blocked layer (row disabled with reason); pick via row / command
palette / drop / paste; non-image drop on ES board unchanged; image drop on
non-ES board unchanged (still an image element); HEIC / SVG / GIF rejected with
hints; too large after encode; EXIF-rotated JPEG lands upright; abort mid-read;
model 502 / 429 / 403 / 401 / 503 each surfaced as a toast with retry; `wall:
false`; zero notes; notes with `unknown` kind default to Domain Event in the list
and are flagged; review edits (text, kind, include, dock chip) respected; empty
board → all added in layout; partial overlap → only new added, positioned by the
fitted transform; full overlap → zero additions and the button disabled;
duplicate texts on the board; peer edits between review and commit; one undo
step; realtime peer receives the batch; offline board (works — the route needs
no diagram id); lanes on → additions on lanes; docking adjacencies detected and
tickable; "Add another photo" chains; dark scheme; keyboard-only run through the
dialog.

---

## 11. Suggested later dockings (NOT in scope — record in spec/139 "Still ahead")

Each is one more `ES_DOCKINGS` row plus, where the face is not west / east, a
`side` value the geometry does not know yet:

- **Actor → Command**: the small yellow note tucked at the command's bottom-left
  corner (a `'below-start'` side).
- **Read model → Command**: green note before / below the command (the
  information the actor decided on).
- **Aggregate ↔ Command + Event**: the pale-yellow wide note ABOVE a docked
  command–event pair (a two-host docking — new shape of relation).
- **External system → Event**: pink wide note before the event, like a command.
- **Hotspot → any note**: red note overlapping a corner (a `'corner'` side).
- **Event → Event (pivotal)**: not a docking — a vertical divider (spec/139
  "board structure"), listed here only so nobody models it as one.

---

## 12. Phase 4 — Integration, the on-par tail, fold-back

- [ ] Photo import × lanes × docking walkthrough on the dev server: lanes on, a
      board with two docked pairs, import a photo overlapping one pair and adding
      a new command-event pair → additions on lanes, the new pair docked, nothing
      existing moved (compare element JSON before / after, byte-identical for
      matched ids).
- [ ] Help: `apps/help/app/canvas/event-storming-boards/page.mdx` gains three
      sections (lanes, anchors, from a photo); registry `description` unchanged
      unless it no longer summarises, `keywords` gain `lane lanes timeline grid
      stagger anchor dock docked magnet photo camera wall picture ocr scan
      import`; `apps/help/app/palette/event-storming/page.mdx` mentions the two new
      rows. No new article, so no icon / count changes — verify the registry tests
      still pass.
- [ ] `README.md` / `docs/*`: env var `OPENAI_VISION_MODEL` in `docs/self-hosting.md`
      + `docs/local-development.md`; `docs/architecture.md` if it lists AI routes.
- [ ] MCP (`apps/mcp`): verify the new fields pass through untouched when a tool
      writes a tab (no whitelist drops them); if `list_templates` / a tool describes
      ES notes, mention `esDock`; tests.
- [ ] Telemetry dashboard (`apps/telemetry`): nothing to do unless it enumerates
      types — check `metrics.ts`.
- [ ] `specs/README.md` index rows if any new spec file was created (none planned).
- [ ] `plans/event-storming.md`: link this plan under a "Phase 6–8" line.
- [ ] E2E smoke: add the lanes toggle + one docking to `smoke.spec.ts` if it stays
      under the suite's time budget; otherwise a `event-storming.spec.ts` beside the
      photo spec.
- [ ] `~/PR_RESULTS.md` (outside the repo): the before / after deltas for the PR
      (elements added per import vs manual, notes snapped, tests added, bundle
      delta of the live app) — max 8 lines.
- [ ] Fold-back: rename anything named after a plan coordinate; every new module
      header states what the module IS today; delete any `TODO(plan)`; `DECISIONS.md`
      / `AMBIGUITIES.md` / `LESSONS_LEARNED.md` at the worktree root updated (all
      gitignored); wiki page in `docs/` if a durable repo-level learning emerged
      (e.g. "structured outputs for vision on Workers").
- [ ] Final quality gate: `pnpm lint && pnpm format:check && pnpm typecheck &&
      pnpm test && pnpm build` green; e2e green against the built stack.
- [ ] `git fetch && git rebase origin/main` (resolve by new commits, never force);
      re-run the gate; push ONLY when the parent relays operator permission; open
      the PR with a bullet description referencing spec/139 Phases 6–8, spec/25;
      title ≤ 52 chars (e.g. `Event storming: lanes, docking, photo import`).
- [ ] Verify what was committed is what was meant (`git diff origin/main --stat`,
      read the spec diffs once more).
- [ ] Report back: what shipped, what is outstanding (Q16 if no key), the PM2
      processes left running / stopped, and the PR link.

---

## 13. Working agreement for the implementer

- TDD per task: red → green → commit → refactor → commit. Tick the checkbox
  immediately after the task lands, never in a batch.
- Commit after every task; first line ≤ 52 chars; no co-authors; never `--no-verify`;
  never amend; never push without permission relayed from the operator.
- Precommit: format, lint, typecheck for the touched workspaces; the full gate at
  each phase end.
- Anything longer than ~10s (tests, e2e, builds, the dev stack) runs under PM2 with
  a `livediagram-eswall-` name and logs to file; tail the log, never stream.
- Prefer extracting a new hook / component / module over growing `useEditorState`,
  `useEditorDrag`, `Canvas.tsx` or `CanvasElementsLayer.tsx`; wire with the
  smallest edit.
- Every ambiguity you hit goes in `AMBIGUITIES.md` with the choice made; every
  architecture choice in `DECISIONS.md`; every surprise that cost real time in
  `LESSONS_LEARNED.md` (2–3 lines).
- Questions to the operator go in fenced `question` blocks (multiple choice, bold
  key words, `(R)` on the recommended answer). Ask ROUTINE things of nobody —
  the plan or the conventions settle them; ask HIGH-STAKES things (Q1, Q16, any
  product fork the plan does not settle, anything irreversible or costly) before
  acting on them.
