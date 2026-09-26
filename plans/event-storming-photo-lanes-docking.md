# Event storming: timeline lanes, anchor docking, photo import

**Status:** SHIPPED on `es-photo-lanes-docking`, awaiting permission to push.
Outstanding: live vision-model calibration (needs a key, see 3.7).
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
layout. The result lands ON THE CANVAS as a **draft**: the new notes appear at
their final, reconciled positions with a draft treatment that makes them the
most visible thing on the board, the notes that were already there fade slightly
while the draft is open, matched notes carry a small "already here" badge, and
every draft note is an ordinary note the author can immediately type into, drag,
re-kind or delete. A floating draft bar says what was read ("14 read · 9 new · 5
already on the board") and offers **Add** and **Discard**. Add commits the batch
as ONE undoable step (Undo removes every note the photo added); Discard leaves
the board exactly as it was. Repeating with the next photo of the next piece of
wall adds only what is new — that is what "incremental" means here.

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
- **Previews never touch the document — with one deliberate, precedented
  exception.** Lane highlight, dock candidate, anchor hover, the insertion
  ripple, the fade of existing notes during a photo draft: all render-time,
  published on module-level `useSyncExternalStore` stores exactly like
  `apps/live/lib/insertion-preview.ts`. The exception is the **photo draft's own
  notes**, which ARE written into the document, because the author must be able
  to type into, drag, re-kind and delete them with the ordinary machinery, and
  duplicating the label editor, the drag, and the context menu for an overlay
  would be the wrong kind of purity. This follows the drag gesture's precedent
  exactly: the SUBJECT of a gesture is written live through the non-undoable
  `tick` path with a checkpoint ARMED at the start, and the gesture's end
  collapses everything into one undo step (`useEditorDrag`'s
  `checkpointPendingRef` / lazy flush). A photo draft is one long gesture: the
  draft landing and every edit to a draft note are ticks; **Add** is the drop
  (one history step covering the whole import); **Discard** is the cancel
  (restore the armed snapshot). Side effects on OTHER elements stay previews.
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
- **The model is pluggable; the key says whose it is; the geometry is ours.** The
  api worker talks to any OpenAI-compatible chat-completions endpoint, and the
  PROVIDER IS INFERRED FROM WHICH KEY IS PRESENT — a key is provider-specific, so
  its name should say so (the operator's point). Presets, in
  `apps/api/src/ai-provider.ts`:

  | key var                      | provider | base URL (fixed)                                          | default model                                                  |
  | ---------------------------- | -------- | --------------------------------------------------------- | -------------------------------------------------------------- |
  | `GOOGLE_AI_STUDIO_API_KEY`   | google   | `https://generativelanguage.googleapis.com/v1beta/openai` | the current Gemini Flash id (see 3.2, discovered, not guessed) |
  | `OPENAI_API_KEY`             | openai   | `https://api.openai.com/v1`                               | `gpt-4o` (today's behaviour)                                   |
  | `AI_API_KEY` + `AI_BASE_URL` | generic  | from `AI_BASE_URL`                                        | none — `AI_MODEL` is REQUIRED for generic                      |

  `AI_MODEL` overrides the default model for any provider; `AI_VISION_MODEL`
  overrides it for the read route only (default = the resolved `AI_MODEL`).
  `resolveAiProvider(env)` returns `{ provider, baseUrl, apiKey, model,
visionModel } | null`; exactly ONE key var may be set — two or more, or a
  generic key without `AI_BASE_URL` / `AI_MODEL`, resolves to `null` AND logs
  one loud `console.error` naming the conflict (fail closed, never guess whose
  budget to spend). `aiEnabled` is `resolveAiProvider(env) !== null`. No
  `OPENAI_MODEL` any more (it becomes `AI_MODEL`); `OPENAI_API_KEY` is not an
  alias, it is the OpenAI preset's own key, so a self-hoster on OpenAI changes
  nothing. Requests use `response_format: { type: 'json_object' }` plus our own
  strict validation. Deploy step for the hosted site, in the PR description:
  `wrangler secret put GOOGLE_AI_STUDIO_API_KEY`, `wrangler secret delete
OPENAI_API_KEY`, drop the `OPENAI_MODEL` var if set.

- **Detection in the browser, reading in the model.** A new package
  `@livediagram/sticky-vision` finds the stickies in a photo with classical CV
  (colour classification against the catalogue fills, connected components,
  box fitting, same-colour blob splitting, row clustering) and produces the
  geometry the reconciler needs. The model only reads text from crops, so its
  notoriously weak coordinate sense never enters the layout, the payload shrinks,
  a face in the background never leaves the browser, and a fully in-browser
  reader is a drop-in later. Kind comes from the paper colour WE measured; the
  model is never asked what colour a note is.
- **The photo is never stored, and never even sent.** Not R2, not D1, not
  IndexedDB, not the change log, not the api. The browser decodes it
  (`createImageBitmap(file, { imageOrientation: 'from-image' })`, honouring
  EXIF), works on a downscaled copy for detection, cuts each detected sticky out
  of the full-resolution bitmap, re-encodes each crop as a small JPEG (which drops
  EXIF), and sends ONLY the crops to `POST /api/ai/read-notes`, which forwards
  them to the model and discards them. The palette row's tooltip says so in one
  line.
- **Detection and reconciliation are ours; only reading is the model's.** The
  detector returns what it MEASURED (box, colour → kind, silhouette, row, order);
  the model returns the TEXT on each crop, verbatim, or marks it illegible.
  Matching against the board and placement stay pure, deterministic, unit-tested
  TypeScript in `@livediagram/diagram`. Never ask the model "which of these are
  already on the board", and never ask it where anything is.
- **Existing notes are untouchable by an import.** Additions only. Text
  differences on matched notes are SHOWN in review, never applied.
- **One undoable step** per act (lane toggle, anchor-add, dock / undock on drop,
  a photo import from landing to Add), through the ordinary `commit()` choke
  point or the drag-style checkpoint, so layer stamping, kind stamping, the
  activity log, autosave and realtime all happen as usual.
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

- [x] **Q1 — Docking sides (ASK FIRST, before Phase 2 wiring).** The operator wrote
      "in front" for all three pairings. Brandolini's notation places a Command to
      the LEFT of its Event (command → event), a Command to the RIGHT of the Policy
      that issues it (policy → command), and a Policy to the RIGHT of the Event it
      reacts to (event → policy). _Default: the standard notation, as a
      catalogue (`ES_DOCKINGS`) with one row per pairing so a side is a one-line
      change._ The parent has asked the operator; if no answer has arrived when
      Phase 2 wiring starts, ask in a `question` block and continue with the
      pure model (which is side-agnostic) meanwhile. _Answered: A, the standard
      notation. Confirmed by the operator._
- [x] **Q2 — "Two visual anchor points".** _Default: a 16px seam between the docked
      notes, one small filled dot on each facing edge at mid-height, joined by
      nothing (two magnets, not a connector). Neutral ink, slightly stronger in
      dark mode._ Alternative if it reads wrong on the dev server: dots at the
      seam's top and bottom.
- [x] **Q3 — Where the lanes switch lives.** _Default: a switch row at the top of the
      Event Storming palette category ("Timeline lanes"), a command-palette entry
      ("Turn timeline lanes on / off"), and the empty-canvas context menu on ES
      boards. No keyboard shortcut in v1. Stored on the tab (shared, synced)._
- [x] **Q4 — Aligned vs staggered.** _Default: no mode toggle. The x grid is half a
      standard note (100px); a note can land exactly above the one on the lane
      above (same grid cell) or one cell (half a note) across. That is the whole
      of "either exactly above each other or staggered"._ Do not add a
      `stagger` setting unless the operator asks. _Confirmed by the operator._
- [x] **Q5 — Lane origin.** _Default: set ONCE when lanes are switched on — the
      top-left of the board's top-most, then left-most, note (`(0, 0)` on an empty
      board) — and stored (`esTimeline.originX / originY`). Existing notes are
      NOT re-snapped when lanes come on (no rearranging, ever); switching off
      keeps the origin so on/off is stable._ A "Snap all notes to lanes" verb is
      NOT in v1.
- [x] **Q6 — Lane pitch.** _Default: `ES_LANE_PITCH = 200 + ES_LANE_GAP`, gap 40px,
      notes centred vertically on the lane (so the 180-tall wide kinds and the
      140-tall actor sit centred, like on a wall). Calibrate by eye on the dev
      server the way the tilt was; record the number and why in spec/139._
- [x] **Q7 — Photo entry points.** _Operator-decided: a photo on an ES board is
      ONLY ever analysed._ (a) An "Add from photo" row at the top of the Event
      Storming palette category (camera glyph; on a phone the hidden file input
      carries `capture="environment"`); (b) a command-palette entry; (c) dropping
      or pasting an IMAGE FILE onto an ES board starts the analysis directly
      (no image element, no "place as image instead"). Without `aiEnabled` the
      row and the entry are absent and (c) falls through to today's behaviour
      (an image element), because there is nothing to analyse with. Verify the
      existing image-drop path is only intercepted for `image/*` files on ES
      boards with `aiEnabled`, and everything else drops exactly as today.
- [x] **Q8 — Zero notes found / not a wall.** _Default: a toast "No stickies found
      in this photo" with a one-line retake hint (fill the frame, straight on,
      good light); nothing lands on the board._
- [x] **Q9 — Where the photo lands when nothing matches on a non-empty board.**
      _Default: to the RIGHT of the board's bounding box, one note width away,
      its top row aligned to the board's top row (to the nearest lane when lanes
      are on). The x axis is time; a new piece of wall is most likely a
      continuation._
- [x] **Q10 — Several photos.** _Default: one photo per draft; while a draft is
      open the entry points are disabled ("Finish the current draft first" in the
      tooltip). After Add or Discard the next photo starts a new draft against
      the board as it now is, so overlap between photos is deduplicated by the
      ordinary matcher. Multi-file selection is a stretch task at the end._
- [x] **Q11 — Matched notes whose text differs in the photo.** _Default: the
      matched note's "already here" badge carries a tooltip "Read as: …" when the
      photo's text differs; never applied._
- [x] **Q12 — Anchor affordance visibility.** _Default: hollow dot on each FREE
      dockable face of a host, shown while the host is hovered or selected, with
      a tooltip naming the act ("Add a command before this event"). Spec/139
      retired the four quick-connect pluses on this board as chrome; these are
      at most two per host, appear only on hover / selection, and each carries
      notation meaning — they earn their place. If they read as clutter on the
      dev server, escalate with a screenshot rather than removing them._
- [x] **Q13 — Anchor-add placement when the spot is taken.** _Default: the new
      note lands at the docked position. If that footprint overlaps a visible
      boxed element, the board makes room with the shipped insertion ripple
      (`applyInsertionShift` from the seam's x, by note width + seam) in the SAME
      commit — the board opens only when there is no room, and the author sees
      the same ripple the Alt gesture taught them._
- [x] **Q14 — Exports.** _Default: the SVG / PNG export draws the seam dots
      (notation paints wherever a note paints — the caps precedent). Lanes are
      never exported (they are a drag-time aid). Mermaid / Excalidraw / Markdown
      ignore both._
- [x] **Q15 — Docked clusters and the insertion ripple.** _Default: a docked
      cluster moves WHOLE when the HOST's left edge is at or after the insertion
      point (the group precedent), and the seam is never offered as a gap (it is
      not one)._
- [x] **Q16 — Live calibration: key and photos PROVIDED.** The operator's Google
      AI Studio key is in `apps/api/.dev.vars` (worktree) as
      `GOOGLE_AI_STUDIO_API_KEY` — never print, log, `cat` or commit that file;
      only ever `grep -o '^[A-Z_]*='` it if you must confirm a name. Three real
      wall photos (4000×3000 JPEG, EXIF orientation 1) are unpacked in
      `/tmp/eswall-wall-photos/` (`20260826_024907.jpg`, `…919.jpg`, `…931.jpg`,
      plus 1000px `preview-*.png` copies); they overlap heavily (907 and 931 are
      the same left wall shifted; 919 is the right wall plane), which is the
      incremental case. Never commit them. Calibrate detector → reader → matcher
      against them in 3.7 and record the results in spec/139.
- [x] **Q17 — "Both their positions are already adjusted to be correct."**
      _Read as: in the draft, NEW notes are shown at their final reconciled
      positions (not the raw photo positions), and EXISTING notes are shown
      where they are (unmoved — the first requirement stands). If the operator
      meant that existing notes may ALSO be nudged (e.g. onto lanes) during the
      draft, that contradicts "never rearranged"; ASK if any task would need to
      move an existing note._
- [x] **Q18 — Detector ambiguity: actor vs aggregate.** Both are yellow; the
      actor is a small saturated square, the aggregate a pale wide note.
      _Default: classify by saturation first (pale → aggregate), then by
      silhouette when saturation is borderline; when still unsure return
      `unknown`, which lands as a Domain Event draft with the badge tooltip
      naming the doubt (the existing `unknown` path)._
- [x] **Q19 — Reading batches.** _Default: crops are sent in batches of up to 16
      images per request (each crop labelled by index in the message so the model
      returns `{ id, text, legible }` per crop), batches in flight two at a time,
      the whole run abortable. `PHOTO_MAX_NOTES` (120) still caps a run._
- [x] **Q20 — Detection preview.** _Default: none in v1 — the draft on the canvas
      IS the review. A sticky the detector missed is added by hand; a false
      positive is Deleted from the draft. Log the detection count and the
      per-kind histogram at debug level so a miss is diagnosable._

- [x] **Q21 — What the parent saw in the real photos (calibrate against these).**
  - The wall is BROWN KRAFT PAPER, not white. Grey-world white balance would be
    dragged by the brown; estimate the wall as the dominant low-saturation
    cluster instead and classify paper by saturation + value ABOVE the wall
    before hue. Orange paper and kraft share a hue (~25–35°) — saturation and
    value are what separate them.
  - The wall's colour convention differs from the catalogue: orange = events,
    blue = commands, GREEN = read-model / data notes, yellow = actor ("Planner",
    tilted), and PINK is used for BOTH hotspots ("Is this reliable?") and a
    policy ("If the slot was plannable before…"). There is no purple. Nearest
    catalogue hue would call pink `external-system`. _Answered by the operator:
    on their walls PINK MEANS HOTSPOT. The detector's pink band defaults to
    `hotspot` — the catalogue's `#fca5a5` red-pink AND the hot-pink magenta in
    the photos both land as hotspot — and a pink policy is re-kinded in the
    draft. `external-system` keeps only the band the real photos never occupy;
    calibrate that boundary in 3.7 against the three pink notes, and if the
    catalogue's external-system pink and the photos' hotspot pink cannot be
    separated, HOTSPOT WINS and spec/139 says so._ A per-board colour legend
    (`esColourLegend`) is the right later feature — listed under "Still ahead"
    in spec/139.
  - Handwriting is SMALL PEN, mixed case, several lines per note — not marker
    capitals. The read prompt must not assume caps; ask for the text verbatim
    with line breaks collapsed to single spaces. Crops come from the full-res
    bitmap at native resolution (~250–300px per note here); never upscale.
  - A note is ~60px wide in a 1024px working image. Prefer a 1600–2048px working
    image for detection if the time budget allows (measure); the split rule and
    the ink-fragment merge need the pixels.
  - Same-colour notes TOUCHING in a row are common ("Timeslot started / Activity
    started / Class started", three orange abutting) — the split rule is not
    optional. Different-colour partial overlaps (blue command over orange event,
    green over orange) are the norm for pairs; the occluded note's box is
    partial, so silhouette from a partial box must degrade to `square`, not to
    `small`.
  - Yellow masking-tape strips and a radiator / fly swatter / boots are in frame:
    min-area + aspect-ratio filters (paper is roughly square, tape is a thin
    strip) must drop them.
  - The photos span a WALL CORNER (two planes): rows on the right plane are
    foreshortened. Row clustering by centre-y is fine within a plane; the
    transform fit should be a robust (median / trimmed) estimate rather than
    plain least squares so a corner does not skew the whole placement.

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

// Photo draft (spec/139 Phase 8). Present = this note landed from a photo
// and has not been accepted yet. Rendered with the draft treatment wherever
// it appears; the draft bar derives its existence from these, so a draft
// interrupted by a reload (or seen by a peer) is still a draft, not a stray.
esDraft?: true;
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

- `DetectedNote` is now assembled CLIENT-SIDE from a `DetectedSticky` + the
  model's text for that id (`text: ''`, `legible: false` when the model could not
  read it — such a note still lands as a draft with an empty label, because the
  paper WAS there); `row` / `order` come from `rows.ts`, never from the model.
  `BoardNote` (id, text, kind, x, y, width, height) is unchanged.
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
- `draftNotesOf(elements)`, `acceptDraft(elements)` (strips `esDraft` from every
  draft note), `discardDraft(elements)` (removes every draft note and
  `stripDanglingDocks` afterwards) — pure, tested.

`@livediagram/api-schema` (`packages/api-schema/src/index.ts`)

- `ReadNotesRequest = { crops: { id: number; image: string /* jpeg|png|webp data URL */ }[] }`
- `ReadNotesResponse = { texts: { id: number; text: string; legible: boolean }[] }`
- `READ_MAX_CROPS_PER_REQUEST` (16), `CROP_MAX_EDGE_PX` (512), `CROP_MAX_BYTES`,
  `PHOTO_MAX_NOTES` (120), `PHOTO_MAX_EDGE_PX` — shared by the client (pre-flight)
  and the route (hard cap).

`@livediagram/sticky-vision` (NEW package `packages/sticky-vision/`, pure TS over a
`{ width, height, data: Uint8ClampedArray }` buffer — no DOM, no OpenCV, no wasm;
vitest with synthetic images drawn in the test, each test < 200ms)

- `colour.ts` — `rgbToHsv`, `greyWorldBalance(image)` (a cheap white-balance so a
  warm-lit wall does not turn orange paper red).
- `classify.ts` — `PaperClass` per catalogue kind with hue centre + band,
  saturation / value floors, DERIVED from `EVENT_STORMING_NOTES` fills at module
  init (hue from the fill; bands are the calibrated constants), plus `wall` (the
  background) and `ink`; `classifyPixel(hsv) → kind | 'wall' | 'ink' | 'unknown'`;
  the actor / aggregate rule (Q18). A test reads the catalogue and asserts every
  kind has exactly one class (the spec/25 "read the source" precedent).
- `components.ts` — `labelComponents(mask)` (union-find or two-pass), per-label
  bbox, area, pixel count.
- `boxes.ts` — `fitBoxes(components, { minArea, medianNoteSize })`: drop specks,
  merge fragments of one sticky split by handwriting (same class, touching /
  overlapping boxes), SPLIT a same-class blob whose width or height is ≈ n × the
  median square by projecting the mask along the long axis and cutting at the
  valleys (two overlapping orange events become two boxes), estimate silhouette
  (`square | wide | small`) from the box against the median.
- `rows.ts` — `clusterRows(boxes)` (1-D clustering of centre-y with a gap of half
  the median height) and `orderInRow` (by centre-x); `row` and `order` land on
  each sticky.
- `detect.ts` — `detectStickies(image, options) → DetectedSticky[]` (the
  pipeline), where `DetectedSticky = { id, kind, size, x, y, w, h /* px in the
working image */, row, order, confidence }`; `toNormalised(...)` for the
  reconciler; `cropRects(stickies, scale, pad)` for cutting from the full-res
  bitmap.
- `index.ts` re-exports; `README.md` states what the package IS and its limits.

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
  - [x] `apps/live/hooks/canvas/useClipboard.ts` + `apps/live/components/canvas/ImageDropZone.tsx` + wherever the canvas accepts a dropped image file (grep `dataTransfer.files`
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

- [x] `apps/live/lib/lane-preview.ts` — a module-level store (the
      `insertion-preview.ts` pattern) publishing `{ laneIndex, cellIndex } | null`
      for the lane / cell currently lit, with `useLanePreview()`. Value-equal
      short-circuit so pointer-rate moves don't re-render the overlay.
- [x] `boxed-drag-resolve.ts` `resolveBoxedMove`: after the precedence ladder's
      earlier rungs, when `timeline` is passed and the drag is a SINGLE sticky (the
      note grammar again — a multi-selection or a shape drags as today), snap via
      `snapToLanes` and return `{ tx, ty, lane }`; alignment snap stands down on any
      axis the lane took. Threshold: the lane wins within half the lane gap on y and
      half a cell on x (tests pin the numbers).
- [x] `useEditorDrag.ts`: thread `activeTab.esTimeline` through `EditorDragDeps`,
      publish the lit lane to `lane-preview` on every move, clear it on up / cancel
      / Escape. Free placement (Ctrl/Cmd) skips it; an open insertion slot wins
      over it; Shift-duplicate clones still snap.
- [x] RED/GREEN tests: `boxed-drag-resolve.test.ts` (existing? extend) for each
      ladder rung; `useEditorDrag.lanes.test.tsx` mirroring
      `useEditorDrag.insert-between.test.tsx`: a note drag lights the lane, drops
      on it, clears the store; Ctrl skips; Alt slot wins; multi-select does not snap.
- [x] Commit: `feat(live): notes snap to timeline lanes while dragged`.

### 1.5 Snapping — palette drag

- [x] `palette-drag-snap.ts`: extend the pure snap with the lane rung (same
      function as 1.4 — if the two paths' snap helpers differ in shape, extract the
      lane rung into ONE helper both call; do not implement it twice).
- [x] `usePaletteDragGuides.ts`: publish the lit lane; `usePaletteDrop.ts` consumes
      the same offset for the drop; `PaletteDragGhost.tsx` lands the ghost on the
      lane (the footprint already knows its silhouette).
- [x] Tests extend `palette-drag-snap.test.ts` and `usePaletteDragGuides.test.tsx`.
- [x] Commit: `feat(live): palette notes snap to timeline lanes`.

### 1.6 Rendering the lanes

- [x] `apps/live/components/canvas/TimelineLanesOverlay.tsx` — rendered from
      `CanvasChrome` (beside `CanvasGuideOverlay`), only while a drag is in hand on
      an ES board with lanes on (`useLanePreview() !== null`). Draws the lit lane as
      a faint band (lane top → bottom, viewport-wide, in the guides' visual language:
      the tab accent at low alpha) with a 1px centre-line, the two neighbouring
      lanes at half that alpha, and a short vertical tick at the snapped cell on the
      lit lane. Pure SVG converting canvas → client via wrapper rect + zoom exactly
      as `CanvasGuideOverlay` does. `pointer-events: none`. Reduced motion: no
      fade; otherwise a 120ms opacity ease in / out, mounted for the whole drag so
      the unmount never snaps (the `useInsertShift` lesson).
- [x] Zero CLS: the overlay is absolutely positioned inside the wrapper and never
      affects layout.
- [x] Dark scheme: verify the band reads on the dark dot-grid (spec/139's
      "recessed dot" lesson — go darker than the backdrop if a lighter band washes
      out).
- [x] Component test: renders nothing without a lit lane; renders three bands +
      tick with a lit lane; converts coords at zoom 0.5 / 2.
- [x] Commit: `feat(live): light the timeline lane under a dragged note`.

### 1.7 Interplay

- [x] Insert-between on a lanes-on board: `findInsertionSlot`'s `shiftDx` rounds UP
      to a whole number of grid cells (so a rippled row stays on the grid); test.
- [x] Shift-duplicate clone lands on the lane; test.
- [x] Undo of the lanes toggle restores the field; redo re-applies; realtime peer
      receives the tab-field change (verify in two browser tabs on the dev
      server).
- [x] The tour (spec/79) does not point at the new palette row; the modifier hint
      banner is unchanged.
- [x] Commit.

### 1.8 Verification (proof, not tests)

- [x] Dev server, playwright-cli: create an ES board, add three events, switch
      lanes on, drag a fourth note — the lane lights, the note lands centred on it
      and on a grid cell; drag a fifth onto the next lane exactly above; a sixth
      staggered by half a note; Ctrl-drag places freely; Alt over a gap still
      inserts. Screenshot both colour schemes into `/tmp` and eyeball them.
- [x] Reload: lanes still on, origin unchanged, nothing moved.
- [x] Non-ES board: nothing in the palette, no lanes, no store activity.
- [x] Spec/139 Phase 6 filled in with what SHIPPED (numbers, wording); domain
      learnings appended (at least: "lanes are an aid, not a cage").
- [x] `pnpm lint && pnpm typecheck && pnpm test` green; commit.

---

## 8. Phase 2 — Anchor docking

### 2.1 Spec

- [x] Resolve Q1 (ask if unanswered). Spec/139 Phase 7 section: the catalogue
      (three pairings, with sides and WHY those sides — the notation), the field,
      the seam + dots (Q2), the three ways a command is added / two ways a policy is
      (§1 B), affordances (Q12), magnetic docking on drag, undocking, host moves
      carry docked notes, deletion strips, copy rules (a copy of a docked note alone
      is standalone — a new piece of paper; host + docked copied together keep the
      relation with fresh ids), the ripple rule (Q13, Q15), exports (Q14),
      telemetry, and "not in v1" (the further pairings in §11).
- [x] Spec/05: `StickyElement.esDock`.
- [x] Commit.

### 2.2 Pure model (`event-storming-dock.ts`)

- [x] RED: `event-storming-dock.test.ts` — catalogue is total over the three
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
- [x] GREEN: implement. Export from `index.ts`.
- [x] Add `esDock?` to `StickyElement` with the WHAT comment (stored on the docked
      note; the host has no back-reference so a host can be deleted without a
      write to its neighbours; readers derive the cluster).
- [x] Wire `stripDanglingDocks` next to every `freezeDanglingGroupEnds` call site
      (`useElementSelectionActions.ts` ×2, `layer-operations.ts`) — extract ONE
      `afterElementsRemoved(before, after)` helper if that is the third caller of
      the same pair; tests.
- [x] `duplicate.ts`: remap `esDock.hostId` when both ends are in the copied set
      (the `groupId` remap precedent), strip it when only the docked note is copied;
      tests.
- [x] Import / merge (`import-merge.ts`) and cross-tab paste: a dangling `hostId`
      is stripped on the way in; test.
- [x] Commit: `feat(diagram): anchor docking model for event-storming notes`.

### 2.3 Rendering — seam dots + affordances

- [x] `apps/live/components/canvas/DockSeams.tsx` — for the active tab's docked
      pairs, draws the two dots per seam (`seamDots`), in the elements layer so they
      z-order with the notes (under the notes' shadows, above the backdrop), tab
      accent-neutral ink (`deriveTextColorForBg` of the backdrop at ~55% alpha; a
      touch stronger in dark). Follows the insertion ripple's `translateX` for the
      cluster (both notes shift, so the dots must too — read `useInsertShift`).
- [x] `apps/live/components/canvas/DockAnchors.tsx` — the hollow affordance dots on
      a HOVERED or SELECTED host's free faces (Q12). Each is a real `<button>` with
      an accessible name ("Add a command before this event"), keyboard reachable
      when the host is selected (Tab cycles them), 24px hit target around a 8px
      dot, tooltip via the shared `Tooltip`. Stand down while any drag is in hand,
      in read-only, on a locked tab / element, when the creation gate is blocked.
      Hover on the affordance shows the ghost silhouette of the note that would be
      added (the palette ghost's footprint styling) — stretch, do the tooltip first.
- [x] Dock CANDIDATE during a drag: `apps/live/lib/dock-preview.ts` module store
      publishing `{ hostId, side, bounds } | null`; `DockSeams` draws the two dots in
      the guides' accent while a candidate is live (the "magnets" lighting up).
- [x] SVG export (`svg-render.ts`): draw the seam dots for docked pairs (Q14), same
      geometry via `seamDots`; test extends `svg-render.test.ts`.
- [x] Component tests for all three; export test.
- [x] Commit: `feat(live): anchor dots for docked event-storming notes`.

### 2.4 Anchor-add (click an affordance)

- [x] `apps/live/hooks/canvas/useDockActions.ts` — `addDockedNote(hostId, side)`:
      builds the note through the ONE builder (§3) at `dockedBounds`, stamps
      `esDock`, applies Q13's ripple when the footprint collides, commits as one
      step (activity log: "Added a Command before Order placed"), selects it and
      opens the label editor (the drop-then-type rule), tracks
      `Element / Added / Sticky` + `Canvas / Used / DockAdd`. Also `undock(id)` and
      `dockTo(id, hostId, side)` for the menu + drop.
- [x] Wire `DockAnchors` → `addDockedNote`; keyboard: Enter / Space on the focused
      affordance.
- [x] Context-menu verb on a docked note: "Undock" (ES verb list,
      `EditorContextMenu.types.ts`); selection caption "Selected Command · docked
      to ORDER PLACED" if the caption helper can take a suffix cheaply — otherwise
      skip and note it.
- [x] Tests: hook (all three pairings; occupied face refuses; ripple only on
      collision; one undo step; gate paths); menu verb test.
- [x] Commit: `feat(live): add a docked note from a host's anchor`.

### 2.5 Magnetic docking on drag (note drag + palette drag)

- [x] Precedence rung 3 in BOTH resolvers (1.4 / 1.5): when the dragged thing is a
      single sticky of a dockable kind and `findDockCandidate` returns one, the
      candidate's bounds ARE the placement; publish to `dock-preview`; lanes and
      alignment stand down. Ctrl skips; Alt slot wins; Shift suppresses.
- [x] Drop: stamp `esDock` (`dock`), in the same checkpoint as the move (one undo
      step); track `Canvas / Used / Dock`. Dragging a DOCKED note beyond
      `ES_DOCK_SNAP_PX` of its docked position and dropping → `undock` in the same
      step; track `Canvas / Used / Undock`. Dragging it back within range re-docks.
- [x] Host drag carries its cluster: when the primary is a host with docked notes
      and the selection is just the host, the move translates the cluster (extend
      `startBounds` to the cluster — the group precedent in `selectionMembers`);
      a docked note is NOT carried when the host is moved as part of a
      multi-selection that already contains it (no double move); tests.
- [x] Modifier hint banner: while a dockable note is on the move near nothing,
      no hint; a candidate live → the banner is not needed (the dots say it).
      Confirm nothing regresses in `ModifierHintBanner` tests.
- [x] Tests mirror 1.4 / 1.5 for the dock rung, plus the undock-on-drag path and
      the cluster move.
- [x] Commit: `feat(live): notes dock magnetically to a compatible face`.

### 2.6 Interplay

- [x] Insert-between: `findInsertionSlot` never offers a seam as a gap; the cluster
      shifts whole by the host's left edge (Q15); a dragged HOST excludes its whole
      cluster from the reckoning (`excludeId` → `excludeIds`); tests in
      `insert-between.test.ts` + `note-insertion-drag.test.ts`.
- [x] Lanes: a docked note follows its host's y (centred on the host), not its own
      lane; the host snaps to lanes as usual; test.
- [x] Bring to front / send to back on a docked pair: unchanged (the dots are drawn
      under both).
- [x] Delete host → docked note stays, standalone; delete docked note → nothing
      else changes; undo restores the relation (it is on the element).
- [x] Realtime: two browser tabs — dock in one, the other shows the dots; undock;
      delete host in one while the other drags the docked note (the drop must not
      resurrect the field: `stripDanglingDocks` runs on the live tab at drop).
- [x] Offline board round trip; JSON export → import keeps the relation.
- [x] Commit.

### 2.7 Verification

- [x] Dev server, playwright-cli: hover an event → two hollow dots (west, east);
      click west → a docked command opens for typing, dots in the seam; click east
      → docked policy; hover the policy → east dot → docked command; drag a
      standalone command near an event's west face → magnets light → drop docks;
      drag it away → undocks; drag the event → the cluster moves; Alt-insert
      elsewhere ripples the cluster whole; export SVG shows the dots; both colour
      schemes screenshotted.
- [x] Spec/139 Phase 7 filled in; learnings appended (at least: "the docked note
      holds the relation, the host holds nothing", "magnets, not connectors").
- [x] Quality gate green; commit.

---

## 9. Phase 3 — Photo import

### 3.1 Spec

- [x] Spec/139 Phase 8: rewrite the "what the model is asked" paragraph to the
      hybrid (detection in the browser, only crops sent, the model reads text
      only); add a short "how the detector works" paragraph (colour classes from
      the catalogue, components, split rule, rows) and its known limits
      (white / grey paper is not in the notation; very dim or blue-lit photos
      confuse hues; a sticky covered more than ~60% is read as a fragment).
- [x] Spec/25: rename the env-var table to `AI_API_KEY` / `AI_BASE_URL` /
      `AI_MODEL` / `AI_VISION_MODEL`, state the OpenAI-compatible contract and the
      Gemini + local llama.cpp examples, document `POST /api/ai/read-notes` (auth,
      gates, caps, request / response, error tokens) and REMOVE `/api/ai/photo-notes`.
      Spec/06, spec/10 (deploy: the secret name), spec/11 (route list), spec/20 if
      it names the var, `specs/02` + `138` only if they mention the name in
      passing (one-word edits).
- [x] `apps/api/src/openapi/manifest.ts`: replace the photo-notes entry with
      read-notes; regenerate schemas; test.
- [x] Commit.

### 3.2 API: pluggable client + the read route

- [x] `apps/api/src/ai-client.ts` — `chatCompletions(env, body)`: builds
      `${AI_BASE_URL}/chat/completions` (trailing-slash tolerant), bearer
      `AI_API_KEY`, forwards the body, returns the `Response`. Both routes call it.
      Test: URL joining, header, body passthrough, a 4xx surfaces as `ai_error`
      with the provider status logged (never the key).
- [x] `apps/api/src/ai-provider.ts` per Edit A, TDD: each preset alone resolves;
      generic needs both `AI_BASE_URL` and `AI_MODEL`; two keys → `null` + one
      `console.error`; `AI_MODEL` / `AI_VISION_MODEL` overrides; trailing slash
      on `AI_BASE_URL` tolerated. `types.ts` Env grows the three key vars +
      `AI_BASE_URL` / `AI_MODEL` / `AI_VISION_MODEL` and loses `OPENAI_MODEL`;
      `ai-gate.ts`, `capabilities.ts`, `ai.ts`, `ai-client.ts` read only through
      `resolveAiProvider`. `wrangler.toml` comment block, `.env.example` (one
      block per row of the table), `docs/self-hosting.md`,
      `docs/local-development.md`, `docs/architecture.md`,
      `docs/what-is-livediagram.md`, spec/25's env table, spec/06 / 10 / 11 / 20
      where they name the var. Grep `OPENAI_MODEL` afterwards: zero hits outside
      a historical note. Existing `ai.test.ts` + gate tests stay green with their
      env stubs renamed.
- [x] Discover the Gemini Flash model id rather than guessing it: with the key in
      `apps/api/.dev.vars`, `GET {google base URL}/models` (bearer auth) lists what
      the key can use; pick the current stable `*-flash` id, make it the google
      preset default, and record the id + date in spec/25.
- [x] `apps/api/src/routes/ai-read-notes.ts` — `handleAiReadNotes(ctx)`: gate;
      JSON body `{ crops }`; validate count ≤ `READ_MAX_CROPS_PER_REQUEST`, each
      `id` an integer, each data URL prefix in `image/jpeg|png|webp`, decoded size
      ≤ `CROP_MAX_BYTES`; build ONE user message with the crops interleaved with
      `Crop <id>:` labels and a system prompt (`ai-read-prompt.ts`: "each image is
      one sticky note written in marker capitals; return the text VERBATIM, do not
      correct spelling, do not invent words, `legible: false` with empty text when
      you cannot read it"); `response_format: json_object`; parse + validate
      strictly (drop unknown ids, clamp text length, coerce `legible`); respond
      `ReadNotesResponse`. Errors: the spec/25 tokens plus `crops_invalid` (400)
      and `crops_too_large` (413). Log provider status + crop count + legible count.
- [x] `index.ts`: `case 'ai'` dispatches `'read-notes'`; `'photo-notes'` is gone
      (404 like any unknown path).
- [x] DELETE `ai-photo-notes.ts`, `ai-photo-notes.test.ts`, `ai-photo-prompt.ts`
      (+ test) in the same commit as the read route lands.
- [x] Tests `ai-read-notes.test.ts`: every gate path, 400 bad JSON / bad id /
      bad prefix / GIF / SVG / too many crops, 413 too large, 502 provider
      failure, 200 happy path with a stubbed fetch, unknown ids dropped, a
      provider answer missing an id → that id comes back `legible: false`;
      `ai-read-prompt.test.ts` pins "verbatim" and the legible rule.
- [x] Commit: `feat(api): a pluggable model client that reads note crops`.

### 3.3 Pure reconciliation (`event-storming-photo.ts`) — adjust only

- [x] Input type follows §5 (`DetectedNote` assembled client-side; empty text +
      `legible: false` allowed). A note with empty text NEVER matches an existing
      note (it always lands as a new empty draft). Adjust tests; the three
      end-to-end fixtures stay.
- [x] Commit.

### 3.4 Client: detection, crops, reading

- [x] `packages/sticky-vision` per §5, TDD module by module with synthetic
      images: single sticky per kind → right kind + box; a 3×2 grid → six boxes,
      two rows, order left→right; two overlapping same-colour events → split into
      two; a sticky with heavy handwriting → one box not five; a warm colour cast
      → still the right kinds after grey-world; a photo with no paper → `[]`;
      speck noise → dropped; 1024px working image in < 150ms in vitest (assert a
      loose bound so CI is not flaky).
- [x] `apps/live/lib/photo-prepare.ts` → rename to what it IS now:
      `photo-detect.ts`: `detectAndCrop(file, signal)` → decode with EXIF
      orientation, working copy at `PHOTO_MAX_EDGE_PX`, `detectStickies`, then
      `cropRects` cut from the full-res bitmap (pad 6%), each re-encoded JPEG
      q0.85 with longest edge `CROP_MAX_EDGE_PX`; returns
      `{ stickies, crops, imageSize }`. Reject unsupported types with the spec/19
      hint wording (HEIC → "save as JPEG"). Measure the detection time on a real
      2048px working image in the browser; if it exceeds ~300ms on a mid phone
      (use Chrome's CPU throttling ×4 as the proxy), move `detectStickies` into a
      Web Worker (`sticky-vision.worker.ts`), otherwise leave it on the main
      thread and record the measurement in spec/139.
- [x] `apps/live/lib/api/ai.ts`: replace `apiAiPhotoNotes` with
      `apiAiReadNotes(crops, signal)` → `ReadNotesResponse`, batched per Q19,
      two in flight, abortable, typed errors. Test.
- [x] `usePhotoDraft.ts` `startFromFile`: `detectAndCrop` → `apiAiReadNotes` →
      assemble `DetectedNote[]` (kind / box / row / order from the detector, text /
      legible from the model) → `reconcilePhoto` → land, exactly as 3.5 already
      says. Zero stickies detected → the Q8 toast, no model call at all. Progress
      toast copy: "Finding stickies…" then "Reading 14 stickies…".
- [x] Tests updated: the state machine now has a `detecting` state before
      `reading`; detection with no stickies never calls the api; an illegible crop
      lands as an empty draft note.
- [x] Commit: `feat(live): find stickies in the browser, read their text`.

### 3.5 The draft (on-canvas review)

- [x] `apps/live/hooks/canvas/usePhotoDraft.ts` — the state machine
      `idle → preparing → reading → draft → committing → idle`, plus `error`
      (toast + the entry points re-enabled); every transition logged at debug
      level. `startFromFile(file)`: `preparePhoto` → `apiAiPhotoNotes` (abortable)
      → `reconcilePhoto` against the LIVE tab → **land**: arm the drag-style
      checkpoint, `tick` every addition in through the ONE builder (fill,
      silhouette, tilt, fixed, auto-fit, layer stamp, `esKind`, `esDock`,
      `esDraft: true`), select them all, pan / zoom so the draft and its matched
      neighbours are in view (reuse the fit-to-selection utility if one exists),
      publish the local draft view state (`photo-draft-preview.ts` module store:
      `{ matchedIds, differences }`). `accept()`: `acceptDraft` via the gesture's
      end — ONE history step from the pre-landing snapshot; activity log "Added 9
      notes from a photo"; `track('AI', 'Used', 'PhotoNotes')` once +
      `Element / Added / Sticky` per note; clear the store. `discard()`: restore
      the armed snapshot (the cancel path), clear the store, nothing logged.
      Gates: read-only / locked tab / blocked layer → the entry points are
      disabled with a reason and `startFromFile` refuses.
- [x] Draft rendering, all render-time and local to the importing session:
  - [x] Draft notes (`esDraft` on the element, so peers and a reload see them
        too): full opacity plus a dashed accent outline just outside the paper
        (the alignment-guide accent) — "the most visible thing on the board".
  - [x] While the local store says a draft is open: every NON-draft element on
        the tab renders at ~50% opacity (a wrapper style in
        `CanvasElementsLayer`, never a write); matched notes additionally get a
        small "already here" badge (a check glyph on the top-right corner, a
        `Tooltip` "Read as: …" when the photo text differed, Q11).
  - [x] Draft notes are ordinary notes: double-click types (the label editor
        commits through `tick` while the draft is open, so it stays inside the
        gesture — verify the editor's commit path can be pointed at `tick`, or
        route its commits through the choke point that the gesture already
        intercepts), drag repositions (lanes / dock rungs apply), Delete removes
        the note from the draft, context menu offers the ES verbs plus **Change
        kind…** (a row of the eight kinds; re-kinding re-fills, re-silhouettes
        and re-centres through the one builder's silhouette rule; available on
        EVERY ES note, not only drafts — a verb, not styling).
  - [x] Dark scheme legibility of outline, fade and badge; reduced motion (no
        pulse — there is no animation to begin with; keep it that way).
- [x] `apps/live/components/chrome/PhotoDraftBar.tsx` — a floating bar (the
      `ModifierHintBanner` / view-bar visual language, bottom-centre) shown while
      the tab has draft notes: "14 read · 9 new · 5 already on the board", the
      **Add 9 notes** primary (count live, disabled at 0), **Discard** secondary,
      Escape = Discard after a confirm when any draft note was edited. Data-derived
      from `draftNotesOf(activeTab.elements)`, so a reload mid-draft shows the
      bar again with "Add all / Discard" and the fade off (the local store is
      gone; the notes are still drafts). WCAG AA, keyboard reachable, `aria-live`
      on the count, zero CLS (fixed height, no layout participation).
- [x] Reading state: a small progress toast "Reading the photo…" with Cancel
      (aborts the fetch); errors as toasts with Retry (`ai_error`,
      `rate_limited`, `origin_not_allowed`, `sign_in_required`,
      `ai_not_configured`, `photo_invalid`, `photo_too_large`, network).
- [x] Entry points (Q7): palette row "Add from photo" (hidden without
      `aiEnabled`; disabled with reason while a draft is open or the gate
      blocks); command palette entry; image-file drop / paste on an ES board
      routes to `startFromFile` (branch on ES-board + `aiEnabled` + an
      `image/*` file type; everything else untouched).
- [x] Tests: state machine (every transition incl. abort, error, retry, refuse
      on gate); landing uses the one builder (assert `fixedSize`, `esKind`,
      `esDraft`, `textSize: 'scale'`, layer id, tilt within ±1.1); a typed edit
      and a drag on a draft note stay inside the gesture (history length
      unchanged until Add); Add = exactly one history step and Undo removes
      every added note; Discard restores the pre-landing elements byte-for-byte;
      Delete on a draft note removes it from the batch; Change kind re-builds
      the silhouette; bar counts and disabled states; drop routing on ES vs
      non-ES boards and with `aiEnabled` off; reload with drafts shows the bar.
- [x] Commit: `feat(live): import sticky notes from a wall photo`.

### 3.6 E2E (mocked model)

- [x] `photo-import.spec.ts`: the fixture image is a PNG export of an ES board
      with six notes (the detector must find all six with the right kinds — this
      is a REAL detection in the browser, not mocked); route
      `**/api/ai/read-notes` → fixture texts by id (the ids are stable because the
      detector orders by row then x). Cases as before (empty board, re-import →
      zero new, overlap → three new right of the matched, reload, Undo / Redo,
      mid-draft reload, dark scheme) plus: a fixture with two overlapping same
      colour notes yields two drafts; a route returning `legible: false` for one
      id yields one empty draft.
- [x] Green under PM2 against the real stack.
- [x] Commit.

### 3.7 Live calibration (needs the operator — Q16)

- [x] ASK (question block) for the Gemini key, base URL and model id in
      `apps/api/.dev.vars` and 2–3 real wall photos in `/tmp`. Never print, log or
      commit any of it; the photos are never committed.
- [x] Calibrate the DETECTOR first on the real photos (hue bands, saturation
      floors, the split threshold, the merge rule) until every visible sticky is
      one box with the right kind; then the READER prompt until the text is
      verbatim and illegible crops are marked rather than guessed; then the
      MATCHER threshold so a re-import adds nothing and an overlapping second
      photo adds only the new notes. Record numbers, the model id used, and one
      paragraph of what needed tuning in spec/139.
- [x] If no key / photos arrive, record the calibration as OUTSTANDING in
      spec/139 and the final report (explicitly, never "verified"). — The key and
      photos DID arrive; what is recorded instead is the honest partial result.

### 3.8 Verification

- [x] Dev server walkthrough of every path in §10 C (with the mocked route via
      playwright-cli where the real model is unavailable).
- [x] Spec/139 Phase 8 filled in; learnings appended (at least: "perception is the
      model's, reconciliation is ours", "existing notes are immovable").
- [x] Quality gate green; commit.

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

**C. Photo import** — detector: each kind alone; grid; overlap same colour;
overlap different colours; heavy handwriting; warm / cool cast; no paper;
specks; a rotated (±10°) sticky still boxed; a phone photo's EXIF rotation
honoured before detection; working-image time bound; zero detections → no api
call; no key (no UI anywhere; image drop still makes an image element); key + read-only (no UI); key + locked tab / blocked layer (row
disabled with reason); pick via row / command palette / drop / paste; non-image
drop on ES board unchanged; image drop on non-ES board unchanged (still an image
element); HEIC / SVG / GIF rejected with hints before detection; too large after encode;
EXIF-rotated JPEG lands upright; abort mid-read; model 502 / 429 / 403 / 401 /
503 each surfaced as a toast with retry; `wall: false`; zero notes; notes with
`unknown` kind land as Domain Event drafts with the badge tooltip saying so;
empty board → all land in layout; partial overlap → only new land, positioned by
the fitted transform, existing byte-identical; full overlap → zero drafts, Add
disabled; duplicate texts on the board; a draft note typed into / dragged /
re-kinded / deleted before Add; a peer edits an existing note during the draft
(their edit survives Add and Discard); Add = one undo step; Discard = board
unchanged; reload mid-draft (bar returns, fade does not); peer sees draft notes
with the outline but no fade; offline board (works — the route needs no diagram
id); lanes on → drafts land on lanes; docking adjacencies land docked; second
photo after Add dedups against the first; entry points disabled while a draft
is open; an illegible crop → empty draft note; a batch failing mid-run → toast
with Retry, no partial landing; dark scheme; keyboard-only run (row → file input
→ bar → Add).

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

- [x] Photo import × lanes × docking walkthrough on the dev server: lanes on, a
      board with two docked pairs, import a photo overlapping one pair and adding
      a new command-event pair → additions on lanes, the new pair docked, nothing
      existing moved (compare element JSON before / after, byte-identical for
      matched ids).
- [x] Help: `apps/help/app/canvas/event-storming-boards/page.mdx` gains three
      sections (lanes, anchors, from a photo (the draft: outline,
      fade, badge, bar, Add / Discard / Undo)); registry `description` unchanged
      unless it no longer summarises, `keywords` gain the lane / dock / photo
      words (lane lanes timeline grid stagger anchor dock docked magnet photo
      camera wall picture ocr scan import);
      `apps/help/app/palette/event-storming/page.mdx` mentions the two new
      rows. No new article, so no icon / count changes — verify the registry tests
      still pass.
- [x] `README.md` / `docs/*`: env var `OPENAI_VISION_MODEL` in `docs/self-hosting.md` + `docs/local-development.md`; `docs/architecture.md` if it lists AI routes.
- [x] MCP (`apps/mcp`): verify the new fields pass through untouched when a tool
      writes a tab (no whitelist drops them); if `list_templates` / a tool describes
      ES notes, mention `esDock`; tests.
- [x] Telemetry dashboard (`apps/telemetry`): nothing to do unless it enumerates
      types — check `metrics.ts`.
- [x] `specs/README.md` index rows if any new spec file was created (none planned).
- [x] `plans/event-storming.md`: link this plan under a "Phase 6–8" line.
- [x] E2E smoke: add the lanes toggle + one docking to `smoke.spec.ts` if it stays
      under the suite's time budget; otherwise a `event-storming.spec.ts` beside the
      photo spec.
- [x] `~/PR_RESULTS.md` (outside the repo): the before / after deltas for the PR
      (elements added per import vs manual, notes snapped, tests added, bundle
      delta of the live app) — max 8 lines.
- [x] Fold-back: rename anything named after a plan coordinate; every new module
      header states what the module IS today; delete any `TODO(plan)`; `DECISIONS.md`
      / `AMBIGUITIES.md` / `LESSONS_LEARNED.md` at the worktree root updated (all
      gitignored); wiki page in `docs/` if a durable repo-level learning emerged
      (e.g. "structured outputs for vision on Workers").
- [x] PR description names the deploy step: `wrangler secret put GOOGLE_AI_STUDIO_API_KEY`,
      delete the old `OPENAI_API_KEY` secret, drop the `OPENAI_MODEL` var (the
      provider is inferred from whichever key var is set).
- [x] `packages/sticky-vision` in the repo layout block of `CLAUDE.md` and in
      `README.md` / `docs/architecture.md`.
- [x] `docs/` wiki page `docs/vision/sticky-detection.md`: how the detector
      works, its calibration constants and why, the limits — a durable
      repo-level learning.
- [x] Final quality gate: lint, format:check, typecheck, test and build all
      green; e2e green against the built stack (19 specs, 4154 unit tests).
- [x] Rebased on origin/main, gate green, pushed with the operator permission,
      PR #76 opened with a visual placement-rules description: 20 e2e specs, all
      CI checks (Build & verify, CodeQL, both Analyze jobs) passing.
- [x] Verify what was committed is what was meant (`git diff origin/main --stat`,
      read the spec diffs once more).
- [x] Reported: lanes (always-on, the placement rules + their rulings log),
      docking, add-from-photo, the PR link, the one outstanding item (vertical
      rhythm: rows 40px apart vs the 16px gutter) and the stack left running for
      review at :3102.

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
