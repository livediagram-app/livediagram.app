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

## Phase 6 (shipped): timeline lanes

**Timeline lanes** is what an event-storming board IS, not a mode it can be
put into. The board carries an infinite stack of horizontal lanes — one note tall, evenly pitched, running in
both directions — and a note being dragged **snaps its centre onto a lane**. A
lane is a ROW, and rows are all it claims: **x is answered by the notes already
on the board**, not by a grid.

**X used to be a half-note lattice, and that was wrong** (found by the operator
on a real board, fixed before the feature was used in anger). Columns every
100px could only express gaps that were multiples of a half note, but the
board's own gutter was 72 at the time — the event-storming template built its
starter row with it, and the insertion ripple opened a slot by it — so every row the product
itself laid out was permanently off-lattice: a note dragged in the lane above
one landed 28px to its right, then 44px to its left, and the x tolerance was
half a cell, which every x is within, so there was no leaving it where you put
it either. The lattice only ever agreed with a board whose notes were touching,
which is the one arrangement a wall rarely has.

Phase 5 made the x axis a grammar the board KNOWS ("between" is a place you can
drop something). Lanes do the same for y: each lane is a row of the story
(events along the top, the commands that caused them underneath, the policies
that reacted below that), each column a moment. On an ordinary diagram neither
axis means anything in particular, so the whole feature is gated on
`isEventStormingTab` and no other board's behaviour changes at all.

- **NOT A MODE, and not board state.** There is no switch, no command and no
  menu verb: an event-storming board is a board of lanes, the way it is a board
  of coloured paper. It was a toggle for one afternoon and the toggle was the
  wrong shape — nobody wants half an event-storming board.
- **The stack is DERIVED, never stored.** `activeTimeline(tab)` answers
  `{ originY }`, anchored on the board's top-most note (zero on an empty
  board), ignoring work on a hidden or locked layer. Nothing to persist,
  nothing to migrate, nothing to fall out of step with the board — and moving
  the anchor by a whole number of pitches draws exactly the same lanes.
- **Each axis snaps only within its own tolerance**, and independently: half
  the lane gap (20px) on y, so a note parked deliberately between two lanes
  stays there; 12px on x, a real threshold, so a note placed in open space
  stays exactly where the hand put it.

### Placement rules

The rules a single note follows on a lanes-on board. This table is the contract;
it is updated in the SAME commit as any change to it, and the rulings below
record who asked for what.

| Where                                | What is offered                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Same lane, no neighbour in reach** | Nothing. The note is free within the lane.                                                                                                                                                                                                                                                                                                                                                                           |
| **Same lane, a neighbour in reach**  | One GUTTER from the neighbour, and then the same again with a square note worth of empty wall between (room kept for an event not yet written): `x = n.x + n.width + 16 + k × (200 + 16)`, `k ≥ 0`, and the mirror to its left. Every step is a SQUARE note, whatever is being placed, so a row has one set of places whichever sticky you hold.                                                                     |
| **Same lane — never offered**        | Touching (`n.x ± w`). One gap plus one sticky (`n.x + n.width + gutter + w`) — that is a note's edge, not a place. Half a pitch. Anything landing on a note that is already there (opening a row is the Alt insertion, a different verb).                                                                                                                                                                            |
| **Adjacent lane**                    | EDGES LINE UP, in three columns: exactly above/below the note, and ONE rhythm step (216) to either side — the diagonal, a note sitting against its neighbour one place along. Same silhouette lines up on the left edge and, for two SQUARES, the brick as well (centred on the gap beside the note). Different silhouettes line up on the left edge or the right edge, in the same three columns, and get no brick. |
| **Every other x snap**               | Stands down. On an event-storming board the lane resolver is the only source of x — the ordinary alignment and distribution rungs were adding exactly the positions the rules above exclude.                                                                                                                                                                                                                         |
| **A multi-selection**                | Placed as ONE BLOCK: the offers are asked of the selection’s outline, so its LEFT edge takes a left-edge offer and its RIGHT edge takes a right-edge one, and every note moves by the one delta — a row dragged together keeps its spacing exactly.                                                                                                                                                                  |
| **Dropped ON a note in the row**     | Resolved to the nearest slot, however far it is. Sliding a note back until it touches the one before it is how an author says "right behind this", and the gesture overshoots by nature; a footprint lying on another note is not a resting place on a board of paper.                                                                                                                                               |
| **The gutter**                       | Always `ES_NOTE_GAP` (16). Not measured from the board any more: one number, relative to the notes in the row, is what makes the places predictable.                                                                                                                                                                                                                                                                 |
| **Capture**                          | Half a standard note (100px) on x, the lane tolerance on y; the note OWN row ranks first and distance decides within a rank (an aligned column and a brick stay equals); the slot is drawn before the drop.                                                                                                                                                                                                          |
| **Precedence**                       | An open Alt slot, then Cmd/Ctrl free placement, then a dock candidate, then these rules.                                                                                                                                                                                                                                                                                                                             |

**Non-square stationery** (provisional, awaiting a ruling): a wide or small note
takes a slot like any other. The first slot after a neighbour is that
NEIGHBOUR's right edge plus a gutter, so a wide note simply occupies a longer
stretch and the rhythm resumes after it; the empty places after that are sized
by the note being PLACED. Across lanes it aligns on its left edge, and its brick
is centred on the gap, so its own width decides where its left edge falls. All
of it lives in `rhythmSlots` and `gutterCentres` in
`packages/diagram/src/event-storming-lanes.ts`, so a ruling is a small change.

**Rulings** (each one an operator input, and what changed):

- **2026-09-17 — "dragging in the higher lanes drags the whole timeline"**:
  the stack is derived from the board top-most note, and the board re-commits
  on every move — so a note dragged up into the higher lanes became the new
  top-most note on each tick and re-anchored the stack to itself, the timeline
  chasing the sticky. A gesture now FREEZES the stack when it begins
  (`laneTimelineRef`), the preview carries the frozen `originY`, and the
  overlay draws its bands from it rather than from the live board. Asserted by
  a test that drags the top-most note up three lanes and reads the origin back
  unchanged.
- **2026-09-17 — "remove the toggle, lanes are always on"**: timeline lanes are
  not a mode. The switch, the command-palette verb, the canvas-menu verb, the
  two telemetry events and the whole field are GONE; the lane
  stack is derived from the board (anchored on its top-most note), so there is
  nothing to store, nothing to migrate and nothing to fall out of step. An
  event-storming board IS a board of lanes.
- **2026-09-17 — "a multi-selection should still snap"**: dragging several
  notes now places the selection as one block against its own outline (left
  edge to a left-edge offer, right edge to a right-edge one) and moves every
  note by the one delta, so notes that were already aligned stay aligned.
- **2026-09-17 — "a palette tile stays armed after a drag creates a note"**:
  landing a palette drag now disarms the tile it armed (), so
  the next click on the canvas does not silently mint a second note.

- **2026-09-16 — "the lattice does not match my rows"**: x was a half-note
  lattice (100px columns) which could not express the board's own 72px gutter,
  so a note dragged above a row landed 28px right, then 44px left. Replaced with
  neighbour-relative placement.
- **2026-09-16 — "two events next to each other do not suggest the gap"**: the
  neighbour tolerance was 12px, a snap rather than a suggestion, so in practice
  nothing was offered. Capture radius widened to half a note and the target
  footprint is now DRAWN before the drop.
- **2026-09-17 — "I am missing the diagonal"**: across lanes the board only
  offered the column exactly above/below a note (and the brick). A note placed
  diagonally — one place along from its neighbour in the row above — is just as
  ordinary, and had to be eyeballed. Each edge column is now offered at one
  rhythm step either side as well. One step, not four: past the neighbours a
  note could actually touch, the row above stops having an opinion.
- **2026-09-17 — "that would make things a lot simpler, right?"** (operator’s
  own simplification, and it was): across lanes, EDGES line up — same
  silhouette on the left edge, different silhouettes on either edge — and the
  brick survives only between two squares. Along a row the gutter is always 16
  and every step is a square note plus a gutter, so a row offers the same
  places whichever sticky is being placed, including the place that keeps room
  for an event not yet written. The measured gutter (`prevailingNoteGap`, its
  floor and its bucketing) is GONE: a constant said the same thing with none of
  the ways to be wrong.
- **2026-09-16 — "the gaps are too wide, should be 16"**: `ES_NOTE_GAP` is now
  **16**, and it is the one number the whole board works to — the lane rhythm,
  the event-storming template row and the insertion ripple all read it, so a row
  the template lays out and a row the author drags out have the same rhythm.
  `MIN_MEASURED_GUTTER` dropped to 8 with it, since the floor has to sit under
  the gutter or a board could never measure its own.
- **2026-09-16 — "as close behind each other as possible gives irregular
  stuff"**: a row built that way came out with gaps of 72, 16, 4, 60, 72, 72.
  Placing a note "right behind" another means sliding it back until it touches,
  and the hand ends up INSIDE the previous note — 124px from the next slot,
  past the 100px capture radius — so the note stayed where it was dropped. An
  overlapping footprint now resolves to THIS row rhythm at any distance, and
  the row own slots outrank the columns and bricks offered by the row next door
  (those were winning on raw distance and leaving gaps of 36 and 12 behind).
  Building the row again from the operator own aims gives 72 every time.
- **2026-09-16 — "two events can only be placed without the gap, or with a very
  big gap"**: the gutter was the MEDIAN of every gap on the board, so a handful
  of accidental near-touching pairs (16px, left behind while dragging) pulled a
  board whose deliberate gaps were all 72 down to 44 — and the whole rhythm
  followed it. The gutter is now the most REPEATED gap, ignoring anything under
  `MIN_MEASURED_GUTTER` (24px: a seam, not a gutter), ties going to the board
  default.
- **2026-09-16 — "too many snapping points"**: same-lane offers were a single
  gutter each side, while the alignment and distribution rungs quietly added
  touching, on-top and half-way positions. Same lane is now the rhythm only
  (whole steps), the half-pitch is gone from a single lane, and every other x
  rung stands down on a lanes board. The brick survives across lanes only.

- **The pitch is a constant, not a field.** `ES_LANE_PITCH` = 240px: a
  200px-tall standard note plus a 40px gap, the rhythm of stickies pressed onto
  a wall in rows. One rhythm per board is the whole point — a board with two
  lane heights is a board with no lanes.
- **Notes are CENTRED on their lane**, which is what makes mixed stationery
  read as one row: the 180-tall wide kinds (policy, external system, aggregate)
  and the 140-tall actor sit centred against the 200-tall square kinds instead
  of hanging from a shared top edge.
- **Nothing on the board ever moves to make room.** Not one note. Lanes are an
  aid the next drag can use, not a cage the board is poured into; "snap
  everything to lanes" is a separate verb nobody has asked for yet.
- **Invisible until a note is on the move.** No permanent rules ruled across
  the canvas: while a single note is being dragged (from the palette or already
  on the board, alone or as a selection) the lane it would land on lights as a faint band with a centre
  line, its two neighbours light at half that alpha so the rhythm reads, and a
  the bands span the viewport because the lanes are infinite. Everything goes on release. There are no column marks:
  the board draws the SLOT it is offering instead, which says the same thing
  about x and says it where the note is actually going.
- **Notes only** — one or many. A selection of notes is placed as one block
  (see the rules table); a shape, an icon, an arrow or an image drags exactly as
  it does on every other board. The Alt insertion and the dock still want
  exactly one note, which is their own rule.
- **Precedence** (top rung wins): an open insertion slot (Alt, Phase 5) → free
  placement (Cmd/Ctrl, spec/60) → a dock candidate (Phase 7) → the lane (y) and
  the neighbours (x) → the ordinary alignment / distribution snap for whichever
  axis is left. Shift-duplicate (spec/80)
  suppresses the slot and the dock, and the clone still lands on a lane.
- **The preview never touches the document** (the Phase 5 rule): the lit lane
  is published on a module-level store and rendered as an overlay; the drop is
  the first thing that writes.
- **One snap computation per gesture.** The palette path and the note-drag path
  each resolve the lane ONCE and the ghost, the overlay and the drop all read
  that answer. A preview that disagrees with the drop is a lie (spec/58).
- **A rippled row keeps its own rhythm.** The Alt insertion opens by the
  incoming note plus the row's own gap, on a lanes board exactly as on any
  other. It used to round that up to a whole number of columns; that rounding
  was the lattice bug in another costume, shifting a row off the very spacing
  it was measured from.
- **Never exported.** Lanes are a drag-time aid, not board content: the SVG /
  PNG export draws none of them. Mermaid / Markdown / Excalidraw ignore the
  field entirely.
- **Telemetry:** `Canvas / Used / TimelineLanesOn` and `…Off`, fired BEFORE the
  commit so the flip that turns something off still reaches the wire.
- **Not in v1:** no keyboard shortcut, no "snap all notes to lanes" verb, no
  vertical lanes (the module is horizontal in fact, axis-shaped in form), and
  no per-lane naming — a lane is a position, not an entity.

**What shipped, in numbers.** `ES_LANE_HEIGHT` 200 (one standard note),
`ES_LANE_GAP` 40, `ES_LANE_PITCH` 240, `ES_NOTE_GAP` 16 (the board's own
gutter, shared with the template and the insertion ripple), y tolerance 20
(`ES_LANE_SNAP_Y`, half the gap), x capture radius 100
(`ES_CANDIDATE_RADIUS_X`, half a standard note), reach 2 lanes
(`ES_CANDIDATE_REACH_LANES`). They sit in one constants block at the top of the
geometry module, because they are a single model and get corrected together. The
geometry is `packages/diagram/src/event-storming-lanes.ts` (including
`activeTimeline`, which derives the stack from the board itself); the lit lane is the module store `lib/lane-preview.ts` rendered by
`components/canvas/TimelineLanesOverlay.tsx`; the two drag paths resolve it in
`hooks/canvas/boxed-drag-resolve.ts` and `lib/palette-drag-snap.ts`. The
overlay's ink is the ALIGNMENT GUIDES' own derivation
(`elementStroke ?? deriveTextColorForBg(backgroundColor)`) rather than a second
vocabulary, which is also what keeps it legible on a dark wall.

## Phase 7 (shipped): anchor docking

The notation's own adjacencies become something the board KNOWS, rather than
something the eye infers from two notes being near each other. A **Command** can
be added standalone, **docked to the Domain Event it triggers**, or **docked to
the Policy that issues it**; a **Policy** can be standalone or **docked to the
Domain Event it reacts to**. A docked pair sits with a small seam between the
two notes and two anchor dots — one on each facing edge — in that seam.

- **The three pairings, and their sides, are a CATALOGUE** (`ES_DOCKINGS`), one
  row per pairing, because the sides are notation rather than geometry and a
  workshop that reads its wall the other way should cost one line:

  | docked note | host         | side   | reads as                                 |
  | ----------- | ------------ | ------ | ---------------------------------------- |
  | Command     | Domain event | before | the intent, then what happened           |
  | Command     | Policy       | after  | "whenever X then Y", Y being the command |
  | Policy      | Domain event | after  | the event, then the reaction it fires    |

  Those are Brandolini's own placements: a command sits to the LEFT of the event
  it causes (cause before effect, along the same left-to-right time axis the
  board already means), and both a policy and the command a policy issues sit to
  the RIGHT of what they follow.

- **The docked note holds the relation** (`StickyElement.esDock = { hostId,
side }`), and the host holds nothing. So deleting a host needs no write to its
  neighbours, a copy of a docked note alone is simply a new piece of paper, and
  every reader derives the cluster the same way. A docked note whose host has
  gone becomes standalone on the next commit that notices
  (`stripDanglingDocks`, the `freezeDanglingGroupEnds` precedent).
- **Magnets, not connectors.** The two dots in the seam say "these two are one
  phrase"; nothing is drawn between them. A line would be an arrow, and an arrow
  on this board means something else.
- **Three ways to dock, one result.** Click a host's anchor affordance and the
  compatible note is added already docked and open for typing; drag a note
  within `ES_DOCK_SNAP_PX` of a compatible free face and it docks on the drop;
  drag a docked note away and it undocks on the drop. All three commit as ONE
  undoable step through the ordinary choke point.
- **The affordances earn their place.** A hollow dot on each FREE dockable face
  of a hovered or selected host — at most two per host, never more, each naming
  its act ("Add a command before this event"). Spec/139 retired the four
  quick-connect pluses on this board as chrome; these are different in kind,
  because each one is a sentence of the notation rather than a generic "connect
  something here".
- **A host carries its cluster.** Moving a host moves everything docked to it;
  a docked note moved on its own leaves the host where it is (and undocks if it
  goes far enough). A multi-selection that already contains both never
  double-moves the docked note.
- **Precedence**: a dock candidate sits BELOW an open insertion slot and below
  free placement (Cmd/Ctrl), and ABOVE the lanes and the alignment snap. Shift
  (drag-duplicate) suppresses docking entirely.
- **Lanes and docking agree by construction**: a docked note takes its y from
  its HOST (centred on it), so the host is what lands on the lane and the
  cluster stays one row.
- **The insertion ripple treats a cluster as one thing** (the group precedent):
  it travels whole when the HOST's left edge is at or after the insertion
  point, and the seam is never offered as a gap to insert into — it is not a
  gap, it is a join.
- **Exports paint the seam** (the caps precedent: notation paints wherever a
  note paints), so an SVG or PNG of the board carries the relation. Mermaid /
  Markdown / Excalidraw ignore it.
- **Telemetry:** `Canvas / Used / DockAdd` (added from an anchor),
  `Canvas / Used / Dock` and `Canvas / Used / Undock` (by drag or menu),
  alongside the ordinary `Element / Added / Sticky` when a note is minted.
  **What shipped, in numbers.** `ES_DOCK_SEAM_PX` 16, `ES_DOCK_SNAP_PX` 40,
  `ES_DOCK_DOT_R` 4. The model is
  `packages/diagram/src/event-storming-dock.ts` (catalogue, geometry, cluster,
  `dock` / `undock` / `stripDanglingDocks`); the acts are
  `hooks/canvas/useDockActions.ts` with the placement decision in
  `lib/dock-add.ts`; the drag rung is `hooks/canvas/note-dock-drag.ts` published
  through `lib/dock-preview.ts`; the surfaces are
  `components/canvas/DockSeams.tsx` (the dots, and the pair a drag is offering)
  and `components/canvas/DockAnchors.tsx` (the affordances). The export draws the
  same dots through the same `seamDots`.

- **Not in v1:** the further pairings the notation has (actor under a command,
  read model before it, aggregate above a command–event pair, external system
  before an event, hotspot on a corner) — each needs a `side` the geometry
  does not know yet, and the aggregate needs a two-host relation. They are
  listed in the plan so nobody re-derives them.

## Phase 8 (shipped): import a photo of the wall

Photograph a piece of the physical wall — stickies, possibly overlapping,
possibly a region already partly on the board — and the board reads the notes
out of it: the **kind from the paper colour**, the **text from the
handwriting**, the **layout from the photo**. It then **reconciles** against
what the board already holds: notes already there are matched and left exactly
as they are, and only the **new** ones are added, placed relative to the
matched neighbours they sat beside in the photo. Repeating with the next photo
of the next piece of wall adds only what is new — that is what "incremental"
means here.

A real workshop always happens on a physical wall first. Getting it onto the
board used to cost a transcription afternoon, which is the one thing a
low-threshold capture surface can least afford.

- **Detection and reconciliation are ours; only the reading is the model's.**
  Finding the stickies — where each one is, what colour its paper is and so
  which KIND it is, which silhouette, which row, in what order — happens in the
  BROWSER, with classical computer vision (`@livediagram/sticky-vision`). It is
  deterministic, free, offline, and testable against images we draw ourselves.
  The model is asked exactly one thing: read the handwriting on this crop, or
  say you cannot. Matching against the board and placing the additions stay
  pure, unit-tested TypeScript (`event-storming-photo.ts`).

  The split is not squeamishness, it is where each side is actually good. A
  vision model's sense of coordinates is famously loose, and a board laid out
  from hallucinated boxes is worse than no import; a hue histogram's is exact.
  And the model is never asked "which of these are already on the board" or
  "where is this" — those are questions about our data and our geometry, and an
  answer to either could not be checked.

- **How the detector works.** Grey-world white balance (so a warm-lit wall does
  not turn orange paper red), then every pixel is classified against the
  notation's own catalogue fills — hue centre from `EVENT_STORMING_NOTES`, with
  calibrated hue bands and saturation / value floors — into a note kind, the
  wall, or ink. Connected components over that mask become candidate blobs;
  fragments split by handwriting are merged back; a blob whose width or height
  is about n times the median note is SPLIT at the valleys of its own
  projection, which is how two overlapping orange events become two notes. Box
  against median gives the silhouette, centre-y clustering gives the rows, and
  centre-x within a row gives the order.

  Its limits, honestly: white and grey paper are not in the notation, so it
  cannot see them; a very dim or blue-lit photo moves hues far enough to
  confuse kinds; a sticky more than about 60% covered reads as a fragment of
  whatever is left. Every one of those lands as a draft the author can fix, or
  as nothing at all — which is why there is no detection preview: the draft on
  the canvas IS the review.

- **Existing notes are untouchable.** An import only ever ADDS. A matched note
  is never moved, resized, re-kinded or re-worded — if the photo says something
  different, the review SHOWS it ("on the board as …") and leaves it. The board
  is the record; the photo is a reading of one moment of the wall.
- **The photo is never stored, and never even sent.** Not R2, not D1, not
  IndexedDB, not the change log — and not the api either. The browser decodes
  it (honouring the EXIF orientation flag), detects on a downscaled working
  copy, cuts each detected sticky out of the full-resolution bitmap and
  re-encodes that CROP as a small JPEG (which drops EXIF with it). Only the
  crops leave the machine, to `POST /api/ai/read-notes`, which forwards them to
  the model and discards them. Whoever is standing in front of the wall, and
  whatever else is in the room, stays in the browser.
- **Gated on the model key exactly as spec/25 is.** No `AI_API_KEY` = no photo
  UI anywhere, and a self-host without one loses nothing else. It is NOT gated
  on the AI-panel preference: this is not the assistant. The provider is
  whatever `AI_BASE_URL` points at — any OpenAI-compatible endpoint, which is
  Gemini on the hosted site and can be a local llama.cpp on a laptop.
- **Placement composes the other two phases.** New notes land on the lanes when
  lanes are on, and a pair the photo shows adjacent in a notation pairing lands
  DOCKED. That is why photo import was built third: doing it first would have
  meant building its placement twice.
- **A review step, then one undoable commit.** The dialog shows each note found
  over the photo and in a list, badged NEW / ON BOARD, with the text and kind
  editable and every note tickable. "Add N notes" commits the included ones
  through the ordinary choke point in one step, so a single Undo takes the
  whole import back.
- **Where a photo with nothing in common lands:** to the RIGHT of the board's
  bounding box, one note width clear, its top row aligned with the board's top
  row (snapped to a lane when lanes are on). The x axis is time, and a fresh
  piece of wall is most likely a continuation.
- **Nothing found is not an error.** "No stickies found in this photo" with one
  line of retake advice (fill the frame, straight on, good light), and the
  dialog stays open for another try.
- **Telemetry:** `AI / Used / PhotoNotes` once per committed import, plus the
  ordinary `Element / Added / Sticky` per note.
  **Calibrated against real walls, and partly so.** Three photographs of a real
  workshop wall (brown kraft paper, ~45 notes, a wall corner, pen handwriting)
  were run through the detector, and they moved almost every number in it:

  - The wall is BROWN KRAFT, which is the same hue as an orange domain event.
    The first version read most of the wall as paper. The floors are now
    measured from each photograph — the wall's own hue and saturation, with the
    wall/paper split chosen by Otsu over the saturation histogram — and a pixel
    near the wall's hue must clear that floor while one far from it (a purple
    policy, a green read model) needs much less.
  - GREY-WORLD WHITE BALANCE IS OFF BY DEFAULT, and that is a finding. On a
    kraft wall it takes the wall for a neutral surface and corrects the brown
    out of the whole photograph, moving every paper hue with it: detections
    fell by three quarters with it on. Measuring the wall per photo replaces it.
  - The hue BANDS are widened to measured paper rather than the catalogue
    swatches: the wall's greens read h≈86 where the catalogue's read-model swatch
    is h≈137, and its policy lilac reads h≈300 where the swatch is h≈269.
  - PINK IS HOTSPOT. The operator's walls use pink for hotspots, and the
    catalogue's external-system pink cannot be told from its hotspot red-pink in
    a photograph anyway (the external-system swatch is too pale to clear the
    paper floor at all on kraft). The whole pink band resolves to hotspot; an
    external system read as one is re-kinded in the draft, which is a click.
  - HANDWRITING SHATTERS A NOTE into dozens of paper fragments, so every
    statistic taken before merging describes the fragments. The merge now runs
    FIRST, to a fixed point, by an absolute pen-stroke gap (0.6% of the working
    image), and only then is the note size measured.
  - A blob is only cut into several notes when it is long against the note size
    AND against its own other side, and only when it is SOLID: a sprawling patch
    of wall that squeaked past the floor used to be diced into dozens of notes
    that were never there.

  **What is still outstanding, explicitly.** The working image is SCALED TO
  1000px before detection (`PHOTO_MAX_EDGE_PX`), because that is where the
  detector was calibrated and where it finds the most notes; at 2048 it found a
  quarter as many. The handwriting crops are cut from the full-resolution
  bitmap, so reading loses nothing. Measured on the three real photos through
  the browser detector: 20, 32 and 34 notes. The far plane of a wall corner is
  largely missed, and crop quality for small pen handwriting is unproven. The
  flow itself is proven end to end — photo in, draft on the canvas, Add, Undo —
  with the operator's own key and `gemini-3.6-flash`. Treat the DETECTOR as
  usable-but-partial and the reader prompt as untuned; the draft's Change kind,
  delete and add-by-hand paths are
  what make a partial read workable today. `packages/sticky-vision/scripts/calibrate.ts`
  is the loop to continue in (it caches decoded photos, so a run is ~1s).

- **Not in v1:** multiple photos in one run (one at a time, then "Add another
  photo" against the board as it now is), applying a matched note's text
  difference, and reading arrows / connections out of the photo.

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
- Perception is the model's, reconciliation is ours: ask a model only what it
  can SEE, and never what our own data already knows, because the second kind
  of answer cannot be checked.
- Existing notes are immovable: an import that could move what is already
  there would be an import nobody dares run twice.
- Ask the model for NORMALISED geometry and the answer survives the client's
  downscale, the model's own resizing, and any future change to either.
- A stationery silhouette comes from the KIND, never from the photo: a note
  photographed at an angle would otherwise arrive slightly the wrong shape
  and stay that way forever.
- The review IS the feature: a model reading handwriting will get some of it
  wrong, and an import that just happened is an import nobody can trust.
- Re-reconcile at COMMIT time, not at review time: a peer can add the very
  note the photo shows while the author is reading it.
- A React state updater is not a place for side effects — it re-runs, and the
  import added everything twice. Unit tests missed it; counting stickies on a
  real canvas did not.
- Lanes are an aid, not a cage: they appear only during a drag, they snap only
  within a tolerance, and they move NOT ONE note that is already down.
- A toggle for something the board always wants is a toggle nobody should have
  to find. Lanes shipped with a switch, a command and a menu verb; the operator
  asked for all three to go, and with them went the tab field, its migration
  surface and two telemetry events. Derived state cannot drift from the board
  it describes.
- A grid claims every point by construction (half a column is the farthest
  anything can be from one), so only the axis with a real tolerance — y, onto
  the lane — is where "an aid, not a cage" actually lives.
- Two placement rules on one axis is one lie: when a lane claims an axis, the
  alignment guide for that axis has to go with it, or the board draws a line
  along an edge the note is not landing on.
- A presentational control must be presentational to the SCREEN READER too:
  the toggle inside a `role="switch"` row was still announcing its own role
  and name, so every settings row in the editor read as two switches.
- Screen pixels cannot check a grid: the notes are tilted, so their bounding
  boxes are rotation-bloated — the e2e reads the SAVED tab back from the api
  instead, which proves the placement and the persistence in one assertion.
- The docked note holds the relation, the host holds nothing: deleting a host
  then needs no write to its neighbours, and every reader derives the same
  cluster from either end.
- Magnets, not connectors: two dots in a seam say "one phrase" without drawing
  a line, and on this board a line would be an arrow, which means something
  else entirely.
- A note asking whether a face is free must not count ITSELF as what is
  occupying it, or nudging a docked note undocks it for good.
- An affordance earns its place by being specific: four generic pluses were
  chrome, two dots that each name a sentence of the notation are not.
- Guard the ACT, not just the affordance: a face is only offered when free,
  but a peer can take it between the render and the click, so the commit is
  where "one note per face" actually lives.
- Healing after a delete had three call sites and two jobs before it had one
  name — that is exactly how the fourth call site forgets one of them.

## Still ahead (phased, see the plan)

Board structure (swimlanes, pivotal events). Vertical insertion, for
boards that run top to bottom: the geometry is axis-parameterised in
shape and horizontal in fact.

**A per-board colour legend (`esColourLegend`).** Every wall invents its own
convention — the operator's uses pink for hotspots and green for read models,
neither of which is the catalogue's. The photo import currently resolves that
with one global decision (pink is hotspot) plus the draft's Change kind verb;
the honest version is a legend on the board itself, which the detector reads
instead of the catalogue and which the author sets once per wall. It is also
what would let a board say "we don't use policies" and have the reader stop
looking for them.

Each phase lands with its own spec update here — this file stays the source of
truth for what the type IS at any moment.

## Counts

The catalogue is pinned at **48 templates (10 default + 38 extra)** —
`templates.test.ts`, spec/09, spec/16, spec/23, the marketing FAQ +
landing copy, and the help centre's templates article all moved
together with this addition.
