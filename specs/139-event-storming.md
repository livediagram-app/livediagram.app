# Event storming

A **board kind**: the sticky-note workshop notation for exploring a
business domain (Brandolini's event storming), started from a template
under the picker's **Technical** category.

An event-storming board is an ordinary tab — plain stickies, one layer,
the same persistence, realtime, comments and export as everything else —
carrying `kind: 'event-storming'` (`TabKind`), which the editor reads to
present it differently: the notation fills the palette, notes take fixed
paper silhouettes with auto-fitting text and a slight tilt, resize is
blocked, a dropped note opens for typing, and the element menu offers
verbs instead of styling. The kind tunes PRESENTATION; it does not fork
the document model.

It was built incrementally, and two early mechanisms have since been
withdrawn — a layer per workshop stage with a chip bar to switch them,
and a timeline rail — each recorded below with why. The working plan
lives in [`plans/event-storming.md`](../plans/event-storming.md).

## Why a template, not a new surface

livediagram's "diagram types" are template kinds
(`packages/templates/src/templates.ts`): a `TemplateKind`, a catalogue
entry, a pure element builder, a preview tile, and per-kind canvas
overrides. Event storming fits that mould exactly — it is ordinary
elements (stickies, text, arrows, frames) arranged by a convention, so
it inherits every editor feature (realtime, layers, comments, export)
for free.

What it grew beyond the mould is `Tab.kind`: the editor DOES branch on
this one after creation, because the notation only reads as a notation
when the surface respects it (fixed stationery, no resize, verbs not
styling). That branch is presentation only — every other template kind
is still invisible to the editor once its elements are on the canvas.

## Phase 1 (shipped): the starter

- `TemplateKind` `'event-storming'`, title **Event storming**, an
  `extra` in the **Technical** category.
- The seed is the method's opening move and nothing else: three orange
  domain-event stickies (past tense — "Order placed", "Payment
  received", "Order shipped"), gently tilted so they read as
  hand-placed, above a muted one-line reminder of the rule ("Domain
  events · past tense · left to right in time order"). Builder:
  `packages/templates/src/template-builders-eventstorming.ts`.
- **Colour is the notation.** Orange MEANS domain event, so the
  stickies carry an explicit `fillColor` (`#fdba74`). Stickies are
  exempt from theme recolouring, so the semantics survive every theme;
  any non-sticky notation added later must pin its fill with
  `themeLockFill` for the same reason.
- **Dot-grid backdrop**, not the technical templates' graph paper: an
  event-storming board is a sticky-note workshop like the user story /
  affinity maps, which pin `grid`.
- Preview tile: three orange stickies marching along a faint dashed
  timeline arrow (`template-preview-4.tsx`).

## Phase 2 (shipped): the sticky grammar in the palette

The notation's note kinds, each an ordinary sticky with a pinned
semantic colour:

| Kind              | Fill      | Meaning                             |
| ----------------- | --------- | ----------------------------------- |
| `domain-event`    | `#fdba74` | something that happened, past tense |
| `command`         | `#93c5fd` | an intent that triggers the event   |
| `actor`           | `#fef08a` | who issues the command              |
| `policy`          | `#d8b4fe` | "whenever X then Y" reaction rule   |
| `read-model`      | `#86efac` | information the actor decides on    |
| `external-system` | `#f9a8d4` | a third party the flow touches      |
| `aggregate`       | `#fef9c3` | the thing commands act on           |
| `hotspot`         | `#fca5a5` | a conflict, question, or risk       |

- **Single source of truth:** `EVENT_STORMING_NOTES` in
  `@livediagram/diagram` (`src/event-storming.ts`) — kind, label, blurb,
  fill. The palette tiles derive from it (a `map`, not hand-copies) and
  the template builder reads its orange from it, so the surfaces cannot
  drift (pinned by `event-storming.test.ts` + `palette-tile-defs.test.tsx`).
- **Palette home:** a **top-level Event Storming category** in the
  Structure band (spec/110) — promoted out of the Write accordion once
  the notation earned first-class status. Rows with a blurb (the
  Behaviour / Data treatment): eight identical squares in different
  colours don't explain themselves. Tile ids keep their historical
  `tools:es-<kind>` prefix — Favourites persist ids, so a rename would
  silently drop saved favourites (spec/78). **On an event-storming board
  the palette OPENS on this category** instead of Favourites (keyed on
  the board-ness of the active tab); everywhere else Favourites stays
  the landing view. Help article: `palette/event-storming` (registered,
  with card art).
- **The kind is stored.** Every note carries `esKind` on the element: the
  colour says it visually, but the kind is domain data — it names the
  selection ("Selected Domain Event" rather than "Selected Sticky") and is
  what any later notation-aware feature reads instead of matching hexes.
  Notes authored before the stamp resolve through their canonical fill.
- **A verb menu, not a styling menu.** Right-clicking a note offers Cut /
  Copy / Duplicate / Bring to Front / Send to Back / Remove, and nothing
  else: Colours, Shadow, Animation, Text, Rotation and Layer are hidden,
  because a note’s colour, silhouette, text treatment and tilt ARE the
  notation — those controls could only break the grammar. Front/back are
  the IN-LAYER stack (the notes share one band), and Cut is copy+delete.
  Collaborate + Resources stay: comments, assigned actions, links. The
  verbs render as full-width rows (`MenuActionRow`, the accordion-header
  shape without the expand), banded clipboard / stacking / remove, with
  Remove tinting destructive on hover — not a tile grid, because a verb
  list reads down the menu like every other row.
- **Drop, then type.** Dragging a tile onto the board opens the new
  element’s label editor, focused — the drag already said WHERE and WHAT,
  and the only thing left is the words, so making the author double-click
  their own fresh note is a step that answers nothing. Applies to every
  palette drop, gated by `takesTypedLabel`: a sticker, session button,
  reaction pad, mode button or estimate renders its face from a SETTING,
  so a caret there would offer to edit something that isn’t text.
- **The pen has one width.** Auto-fit is capped at **25px**
  (`FIT_MAX_PX`, floor 10px). On a real wall everyone writes at roughly one
  size, so a two-word event and a two-line policy sit at the same weight
  and the board reads as one surface. Letting a short label fill its paper
  made it a poster that shouted down every note beside it — which is what
  the original 44px ceiling did. Only the top end is pinned; a long note
  still shrinks.
- **Notes are written in MARKER.** `ES_NOTE_FONT` is `permanent-marker`
  (spec/28's catalogue), resolved from the note rather than stamped on the
  element — same reasoning as the caps: the face is grammar, so every board
  gets it, including the ones authored before this, and nobody has to keep
  it. It sits between the author's own `element.font` (which still wins) and
  the tab default (which it beats). Chosen by looking at all twelve options
  on real stationery: marker is the only one that reads as a wall rather
  than a diagram, and capitals are its home register. The auto-fit measures
  IN that face (`labelMeasure`'s `fontFamily`), because a marker is far
  wider than the UI sans at the same px — and the canvas re-renders once the
  webfont lands (`useFontsReady`), or a board nobody has touched keeps a size
  measured against the swap fallback.
- **Notes are WRITTEN IN CAPITALS.** A marker on paper produces caps, and a
  wall of them reads as one hand: capitals stay legible from across the
  room, hold an even block of colour on the paper, and stop a board looking
  like eight people's sentence-case handwriting. The rule is
  PRESENTATION-only (`eventStormingLabelText` in `@livediagram/diagram`, a
  CSS `text-transform` on the canvas): the typed label is stored exactly as
  written, so search, the JSON export and the day a note stops being a note
  all keep the author's casing. It applies wherever a note PAINTS — display
  label, rich runs, the live editor (so typing shows the note as it will
  read), and the SVG / PNG export, which would otherwise hand out a picture
  that isn't the board. Capitals are WIDER, so the auto-fit measures the
  caps (`fitMultilineFontPx({ uppercase })`); measuring the typed mixed case
  would overflow the paper the moment it rendered.
- **Two words keep each other company.** The auto-fit has a second
  constraint beyond “does it fit”: a multi-word label must keep at least
  one PAIR of words on a line. At a large enough size every word lands on
  its own line and the note stops reading as a phrase and starts reading
  as a column of fragments — technically fitted, visually wrong. The rule
  only ever shrinks, and falls back to the plain fit when two long words
  can never share a line (they must not drag the note down to 10px).
- **Layer routing:** on an event-storming board the commit path files a
  dropped note onto the board's single layer
  (`eventStormingBoardLayerId`), whatever its kind. Only when that layer
  exists, is visible AND unlocked — otherwise (and on non-ES boards) the
  note falls through to ordinary active-layer stamping. Each kind still
  carries a `stage` in the catalogue: it is real domain vocabulary
  (which pass of the workshop the note belongs to) and reads in the
  palette, but it no longer decides structure.
- **Mechanics:** each tile arms the ordinary sticky draw gesture with
  the kind's fill riding the intent (`PendingDraw` sticky variant gains
  `fill?: string`, the session/provider precedent), and `buildDrawnBoxed`
  lands it as `fillColor`. No new element type, no schema change — the
  notes are plain stickies, so votes, comments, exports and realtime all
  just work, and the fill survives theming because stickies are
  theme-exempt. Pressed-state matches on the fill so arming Command
  doesn't light all nine sticky tiles.
- **Telemetry:** adds report `Element / Added / Sticky`, unchanged — the
  colour is a user choice riding the intent, not a new kind (the same
  reasoning as Video's provider, spec/22).

## Phase 3 (superseded): ONE board, ONE layer

The board shipped with a layer per workshop stage (Big Picture / Process /
Software Design) and a bottom-centre chip bar toggling their visibility.
**That has been withdrawn: an event-storming board now has exactly one
layer**, `layer:es:board` (`eventStormingLayers()`), and no view bar.

- **Why.** Layers paint as separate BANDS, so two notes on different
  stages could never be stacked against each other — "bring to front" did
  nothing across a band, with nothing on screen to explain why. A
  workshop surface is one wall of paper: the notation already says what
  each note IS, so the stage it belongs to doesn't need its own plane.
  The chip bar was also permanent chrome on a board whose whole premise
  is distraction-free capture, and it earned its place only by driving
  the layers it has now lost.
- **Identity is a FIRST-CLASS field**: `Tab.kind = 'event-storming'`
  (`TabKind` in `@livediagram/diagram`). It used to be inferred from layer
  ids, and that broke twice — first as a checklist (all three stage
  layers, so deleting one stripped the board), then as a single layer a
  facilitator can delete from the Layers panel — each time taking the
  palette, the stationery and the note menu with it, with nothing on
  screen to explain why. A kind TUNES presentation; it does not fork
  persistence, realtime, comments or export, so the editor stays one
  editor. The template declares it through `templateCanvasOverrides`, so
  the picker, /new and the MCP worker all land it in one commit.
  `isEventStormingTab(tab)` reads the kind first and falls back to the
  board layer or any legacy stage-layer id, so boards authored before the
  field keep working; their bands remain ordinary spec/74 layers.
- **The kind set is TOTAL**: `TabKind = 'diagram' | 'event-storming'`.
  “Ordinary board” is a thing the model can SAY, so code switches over a
  complete union and a third kind can’t be silently forgotten in a branch.
  `tabKindOf(tab)` resolves the absence that every pre-field tab will carry
  forever (no migration reaches an exported file or someone else’s offline
  copy).
- **Stamped at the PERSISTENCE boundary**, not only at the editor’s commit
  choke point: several mutation paths reach the wire (history commit, the
  non-undoable session tick, a remote apply), and a field whose presence
  depends on which one ran is a field no reader can trust. `tabForWire`
  (cloud) and `upsertTab` (offline IndexedDB) both stamp, so the two
  stores can never disagree about what a tab is. The stamp is a ONE-WAY
  write, so it resolves legacy signals first — branding a pre-`kind`
  workshop board `diagram` would take its palette, stationery and note
  menu away permanently, with no later load able to tell.
- **What went with it:** `EventStormingViewBar`,
  `useEventStormingViews`, `applyEventStormingStage`,
  `eventStormingStageOf`, `eventStormingStageLayerId`,
  `EVENT_STORMING_STAGES` and the `UI / Used / EventStorming*`
  telemetry. _(The timeline-rail layer + element and its toggle were
  built and retired earlier, for the same reason: chrome that didn't earn
  its place. Boards created while it existed keep `layer:es:rail` as
  ordinary data.)_
- **Stages are not gone as an idea** — every note kind still carries its
  `stage`, and a future revisit can surface it as a FILTER (dimming,
  not a plane) without reintroducing bands.

## Phase 4 (shipped): workshop stationery

The notes behave like the physical kit:

- **Silhouettes.** Each kind carries a `size` class in the catalogue —
  standard `square` (200×200) for events / commands / read models /
  hotspots, `wide` (300×180) for the prose kinds (policy, external
  system, aggregate), `small` (140×140) for the actor. A kinded note
  keeps its silhouette on ANY board (the kind is the notation); the
  palette tile glyphs mirror the silhouette so the row's picture says
  the shape before the blurb does.
- **One size for life.** On an event-storming board every sticky drops
  `fixedSize: true` (element-level flag; `isFixedSizeElement` unifies it
  with the spec/103 fixed-size shape kinds): no resize handles, union
  scaling moves it without scaling it, the menu's Size category stays
  away, drag-to-size gestures and tap-size-inheritance both stand down.
- **Hand-placed tilt.** Every sticky dropped on an ES board gets a
  random rotation (±1.1°, one decimal) so a wall of notes reads as a
  workshop rather than a grid. The template's seed events ship tilted
  (±1.1°) and `fixedSize` too.
- **No palette chrome.** An ES board hides the palette's whole header
  band — BOTH dropdowns (canvas tool + category). The notation is the
  only category that matters here, and every control that doesn't serve
  "add a note, type, drag" is a distraction. Canvas tools stay reachable
  by keyboard shortcut and the command palette (spec/70).
- **Auto-fit, centred text.** Every ES note is created with `textSize: 'scale'` and centred both ways: a workshop note is one short phrase that should fill its paper and sit in the middle, like a marker-written sticky. It also closes the loop with fixed silhouettes — the note cannot be resized, so the TEXT adapting is what keeps a long phrase legible.
- **Drag to the board.** Sticky tiles (the plain note and the whole ES
  category, rows and Favourites grid alike) drag onto the canvas like
  shape tiles (spec/58 ghost included, sized to the silhouette). The
  drop goes through the same builder as a tap, so fill, silhouette,
  tilt, fixed size and stage routing all apply identically.

## Phase 5 (shipped): insert a note between two notes

**Hold Alt** and drag a note over the **gap between two notes** and the
board offers to INSERT it there: every element at or right of that point
slides further right to open a slot, live; dropping commits the
insertion as ONE undoable step; letting go of Alt, or leaving the gap,
closes it again.

It works for **a note dragged in from the palette AND a note already on
the board** — the drag people do most is moving a note they have already
placed, and that is where making room in the middle earns its keep.

- **Armed on a held Alt, never automatically.** Without the modifier the
  drag behaves exactly as it does on every other board: no slot, no
  ripple, no surprise. Automatic arming was tried first and was wrong
  twice over — an author dropping a note NEAR a row got the whole board
  rearranging under them, and the gesture was unavailable in the one
  place it mattered most.
- **Why Alt and not Ctrl or Shift.** Both are taken during a canvas
  drag: Cmd/Ctrl means free placement (spec/60) and Shift means
  drag-duplicate (spec/80). Alt was unclaimed, so insertion displaces
  nothing and means the same thing on every board. Do not "simplify"
  this back to another key.
- **"Press Alt while dragging", not "hold Alt and drag".** On desktops
  whose window manager claims Alt+button (Cinnamon's default, and
  others'), a drag STARTED with Alt already down is taken by the WM to
  move the window and the page never sees it. Pressing Alt after the
  drag is under way always works, because the WM's grab is established
  at button-press. All the copy says "press", for that reason.
- **A moved note leaves its hole behind.** When a note already on the
  board is inserted elsewhere, nothing closes up behind its ORIGINAL
  position — the board makes room at the destination, and the source gap
  is the author's to tidy. Predictable beats clever.
- **A single sticky only.** A multi-selection drag, and a drag of a
  shape / icon / arrow, behave exactly as they do today whatever is
  held: the gesture is about the note grammar. This is true of the
  palette path too — a shape dragged in from the palette no longer
  inserts, which it did while arming was automatic.
- **Precedence.** An open slot IS the placement, so it wins over
  Cmd/Ctrl free placement (snapping is irrelevant while a slot is open).
  Shift wins the other way: drag-duplicate already owns that gesture, so
  no slot is offered while Shift is down.
- **Live in both directions, at any point in the drag.** Press Alt
  mid-drag and the slot opens; release it and the board unwinds and
  hands placement back to the ordinary snap. The drop does whatever the
  state is at the instant the button is released.
- **Discoverability.** While a note is on the move on one of these
  boards, the modifier hint banner offers the gesture: "Alt — Press to
  insert it between two notes". A held modifier nobody has heard of is a
  feature nobody finds, and the offer only makes sense during the drag.

**Why here and nowhere else.** An event-storming wall is a
left-to-right timeline of domain events, so "this happened before that"
is the entire information content of the x axis. Adding a step in the
middle is the commonest edit in a session, and it used to cost a manual
re-shuffle of everything downstream — the one operation a
low-threshold-capture board cannot afford to be slow. On an ordinary
board x means nothing in particular, so the same gesture would be a
surprise: everything is gated on `isEventStormingTab`, and no other
board's behaviour changes at all.

- **The preview NEVER touches the document.** No commit, no tick, no
  realtime broadcast, no autosave, no dirty flag. The slot is published
  on a module-level store of its own (`lib/insertion-preview.ts` — it
  has two publishers, the palette drag and the note drag, which is why
  it does not live beside the palette's own drag state), and the canvas
  renders it as a CSS
  `translateX` on the elements that move. A preview that wrote would
  sync half-finished states to peers and pollute the undo stack; a
  transform cannot desync from a model it never touched, and it unwinds
  by dropping a style. The minimap, which reads the model, correctly
  shows nothing moving.
- **The insertion point is the RIGHT-hand note's left edge.** The
  incoming note takes that note's place and everything from there slides
  by `note width + the row's prevailing gap` (the median gap between
  adjacent notes in the hovered row; the template's 72px when the row
  has no gap to measure). So every gap the author already arranged
  survives untouched, and the new note gets the row's own rhythm on its
  right.
- **Everything to the right moves, not just the row.** A command above
  its event and a policy below it stay lined up with the event they
  annotate. Boxed elements move by `x`; a group moves whole when its
  CENTRE is at or after the point (a group is never torn in half); a
  free arrow entirely at or after the point travels, one that straddles
  it stretches (each endpoint keeps the note it was drawn between);
  pinned arrows need no help at all. **Locked elements do not move** —
  the board opens around them, because a locked element is one the
  author pinned on purpose. Elements on a hidden or locked LAYER cannot
  define the row (you can't aim at a note you can't see) but do travel,
  so the order still makes sense when the layer comes back.
- **One placement rule at a time.** While a slot is open the alignment
  snap yields: the slot publishes its own offset through the same snap
  channel, so the ghost, the insertion marker and the drop cannot
  disagree — the same discipline spec/58's ghost already follows. The
  marker is a vertical line at the insertion point drawn in the
  alignment guides' own visual language, spanning the board because the
  whole board is what splits.
- **Hysteresis, so a shaking hand doesn't strobe the board.** An open
  slot stays open until the cursor leaves the gap by a margin; a cursor
  crossing the boundary back and forth cannot toggle it. The slot eases
  open and shut over 120ms (collapsed to instant under reduced motion);
  the COMMITTED positions never animate — the drop lands exactly where
  the preview promised.
- **One undoable step.** The ripple and the new note are one commit
  through the ordinary choke point, so layer stamping, board-kind
  stamping, the activity-log entry and autosave all happen as usual, and
  a single Undo restores the board exactly. The ripple runs against the
  tab as it is at drop time, not the snapshot the drag started from, so
  a peer's mid-drag edit is not reverted by the drop that follows it.
  The activity log names the act ("Inserted a Sticky note, moving 2
  Sticky notes right") rather than listing an add and some unrelated
  edits.
- **Never offered where the drop would be refused**: a view-only
  session, a locked tab, or a hidden / locked active layer sees no
  preview at all. `canInsertBetweenOn(gate, altHeld)` is ONE predicate
  for both entry points and all three surfaces within each (preview,
  ghost, drop), so they cannot disagree about whether the gesture is
  armed.
- **Moving a note already on the board** differs from the palette path
  in exactly one way: the dragged note is excluded from the reckoning
  (`findInsertionSlot`'s `excludeId`), so it neither defines the row it
  is hovering nor gets pushed aside to make room for its own arrival.
  The note itself moves live, as any dragged note does, and sits IN the
  open slot; every OTHER note's ripple stays a render-time preview until
  the drop. The drop applies the ripple through the gesture's existing
  checkpoint, so the live ticks and the ripple collapse into one undo
  step covering the note's original position too.
- **Alt with the hand held still** works on a pointer drag (keydown /
  keyup replay the last pointer position) but NOT on a palette drag:
  during a native HTML5 drag Chromium delivers no key events to the
  document at all, so `dragover.altKey` is the only channel and the slot
  opens on the next movement, however small.
- **Not in v1:** vertical insertion (the module is axis-parameterised in
  shape, horizontal in fact), and leading / trailing insertion (there is
  no "between" at the ends of a row — you can just drop there).
- **Telemetry:** `Canvas / Used / InsertBetween`, once per committed
  insertion from EITHER entry point, alongside the ordinary
  `Element / Added / Sticky` when the note is a new one. The two entry
  points are deliberately not told apart: the question the dashboard
  answers is "does anyone use this gesture".

## Domain learnings (session log)

One-liners captured as they were learned — product truths for this diagram
type, kept current every session. Each should stay true on its own.

- The board is a super-low-threshold capture surface: add, type, drag —
  anything between a thought and a sticky is friction to remove.
- Distraction-free by default; options are progressively disclosed —
  chrome must earn its place on this board.
- Double-click means "type": menus never open on the capture path, only
  on explicit right-click / long-press.
- Colour IS the notation: semantic fills are pinned in one catalogue and
  theme-exempt, so restyling can never erase meaning.
- Shape is notation too: wide = the prose kinds (policy, external
  system, aggregate), small = actor, square = the rest — mirroring the
  physical 76×76 / 127×76mm stationery.
- Fixed silhouettes, no resizing: uniform sizes are what let size carry
  meaning; one resized note breaks the whole wall's grammar.
- Authenticity is a feature: the paper peel, glue strip, and hand-placed
  tilt make the board read as a workshop, not a diagram.
- Tilt is calibrated by eye, not by rule: ±1.1° reads hand-placed,
  ±2.5° reads messy — seed and dropped notes share the same range.
- Sticky shadows tolerate no hard edges: continuous ramps (gradient in
  the paint, then blur) beat masked or clipped fades, which band — the
  winning recipe was measured against Miro's renderer and hand-tuned on
  a live board (a 25-variant side-by-side beat isolated mockups).
- The palette opens ON the notation for this board type: the notation is
  what the board is for, Favourites is for everywhere else.
- The palette rows say shape + meaning, not just colour: silhouette
  glyphs and one-line blurbs do the explaining, in workshop order.
- Notes know their workshop stage and file themselves onto its layer —
  but never onto a hidden or locked one (fall back to the active layer
  rather than vanish).
- Workshop stages are SHARED state (layer visibility): the facilitator
  walks the whole room through Big picture → Process → Design.
- Any feature that hides layers must self-heal the active layer, or
  boards parked in a shallow stage silently pause all creation.
- Palette drag and palette tap must go through one builder: fill,
  silhouette, tilt, fixed size and routing may never drift between the
  two entry points.
- Tile ids are forever: Favourites persist them, so promotion between
  palette homes keeps the historical prefix.
- Chrome must earn its keep or be removed: the timeline rail (layer,
  element, view chip) was built, judged, and retired in one session.
- On this board the palette IS the notation: its category and tool
  dropdowns are hidden, because a chooser you never need is a distraction.
- Removing chrome is safe only when another path survives: hidden tool
  pickers still leave keyboard shortcuts and the command palette.
- Hiding chrome has a second audience: the editor tour ([spec/79](79-editor-tour.md))
  pointed at the hidden header until it learned to drop those steps on a
  board — anything that teaches the UI has to be told when the UI shrinks.
- Next App Router hydrates React on `document`, so React handlers are
  siblings of document listeners: stopPropagation cannot hide from them.
- Creation should end where the user's attention already is: a dropped
  element that needs words opens for typing.
- “It fits” is not the same as “it reads” — one word per line fits.
- An action ANSWERS the right-click: every verb closes the menu, which
  otherwise covers the element whose change the user wants to see.
- A proxy identity (a layer id, a colour, a shape) always drifts from
  the thing it stands for: name the fact on the model instead.
- Bands are planes, and a plane you cannot see is a rule you cannot
  learn: stacking that silently no-ops across a layer is worse than no
  stacking. One wall of paper beats three planes of it.
- One button, one job: the secondary button only opens the menu — no
  select, no drag, no dismiss.
- React stopPropagation is dispatched from the root container, so it
  also hides the event from window-level listeners (drag-end lives there).
- A menu that opens on press fights the hand that opened it: open on
  release, dismiss on capture-phase pointerdown.
- One gesture, one answer: the selection popover and the context menu
  never share an element — the right-click menu wins while open.
- Where the grammar is fixed, the menu should offer VERBS not styles: a
  control that can only break the notation is worse than no control.
- Notation kinds belong ON the element, not inferred from colour: a hex
  match is a coincidence waiting to happen.
- A copy is a new piece of paper: fresh id AND fresh tilt, or duplicates
  read as photocopies.
- "The one place copies happen" was three places: per-copy rules belong
  in a shared helper every path spreads.
- Board identity must not hinge on data the user can edit: ANY stage
  layer means event storming, because deleting one silently stripped the
  palette and note routing.
- Quick-connect pluses stand down on an ES board: four affordances
  ringing every note is chrome the capture loop never asks for.
- A widget can outlive its concept: the edge "anchor" grips resize, so
  they must follow the resize rule — naming lagged behaviour and let a
  fixed-size note be dragged wider.
- Text fills the paper, the paper never resizes: on a fixed-silhouette
  note, auto-fit is what makes a long phrase legible — but fill it to the
  brim and a two-word note becomes a poster; the ceiling IS the pen.
- Paper shadows are backdrop-relative: ink tuned on light paper vanishes
  on a dark wall, so a dark canvas needs its own deeper peel.
- Display label and inline editor must share ONE typography rule, or
  double-clicking to type shifts the text.
- On a lifted dark canvas the dot grid must go DARKER than the backdrop:
  a lighter dot washes out, a recessed one reads.
- Alignment help belongs BEFORE the drop: guide lines during the palette
  drag serve the capture loop; a misplaced note that needs fixing after
  is friction. Ghost, guides and landed element must share ONE snap
  computation, or the preview lies.
- The x axis IS the domain content here: on a timeline of events,
  "between" is a first-class place to drop something, and making room
  by hand is the friction the board can least afford.
- A preview is a promise, so it must never write: render it as a
  transform over an untouched model and it cannot leak to a peer, the
  undo stack, or autosave — and it unwinds by deleting a style.
- Insert where the displaced note WAS, not in the middle of the gap:
  taking its place preserves every spacing the author already chose.
- One drag, one placement rule: a slot and an alignment snap fighting
  over the same drop point is how a ghost starts lying.
- A live preview needs hysteresis or a shaking hand strobes the board.
- Chrome anchored to element BOUNDS (the selection popover) has to stand
  down during a render-time shift — bounds know nothing about a
  transform, so it would float over empty canvas.
- A gesture that arms ITSELF is a gesture that fires when you did not
  mean it. Automatic insertion read as the board coming apart under an
  author who only wanted to drop a note nearby.
- Pick a modifier by what is FREE, not by what feels natural: Ctrl and
  Shift were already free placement and drag-duplicate, so Alt was the
  only one that could mean the same thing on every board.
- The desktop can eat a modifier before the page ever sees it. Alt+press
  is a window-move on Cinnamon's default, so the gesture had to be
  taught as "press Alt WHILE dragging" — the WM grabs at button-press,
  so pressing it mid-drag is always safe.
- A native HTML5 drag gets no key events in Chromium at all. `dragover`
  carries the modifier state and nothing else does, so "live" means
  "next movement" on that path and genuinely instant on a pointer drag.
- The thing being inserted must be excluded from its own ripple, or it
  is its own neighbour: the row resolves against the note sitting under
  the cursor and the geometry answers nonsense.
- A DOM event's fields live on its prototype, so spreading one to replay
  it with a different modifier yields `{}` and a NaN delta. Snapshot the
  fields you need.
- A modal that lands a beat AFTER the canvas will silently swallow a
  test's drag: checking whether it is showing yet races it, waiting for
  it does not.

## Still ahead (phased, see the plan)

Board structure (swimlanes, pivotal events). Vertical insertion, for
boards that run top to bottom: the geometry is axis-parameterised in
shape and horizontal in fact. Each phase lands with its own spec update
here — this file stays the source of truth for what the type IS at any
moment.

## Counts

The catalogue is pinned at **48 templates (10 default + 38 extra)** —
`templates.test.ts`, spec/09, spec/16, spec/23, the marketing FAQ +
landing copy, and the help centre's templates article all moved
together with this addition.
