# Event storming

A new diagram type under the picker's **Technical** category: the
sticky-note workshop notation for exploring a business domain
(Brandolini's event storming). It is deliberately being built
**incrementally** — the template shipped first as a near-blank starter
so the type exists end-to-end (picker card, preview tile, builder,
catalogue counts), and the notation grows on top of it in phases. The
working plan lives in [`plans/event-storming.md`](../plans/event-storming.md).

## Why a template, not a new surface

livediagram's "diagram types" are template kinds
(`packages/templates/src/templates.ts`): a `TemplateKind`, a catalogue
entry, a pure element builder, a preview tile, and per-kind canvas
overrides. Event storming fits that mould exactly — it is ordinary
elements (stickies, text, arrows, frames) arranged by a convention, so
it inherits every editor feature (realtime, layers, comments, export)
for free. Nothing in the editor branches on the kind after creation.

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
  note, auto-fit is what makes a long phrase legible.
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

## Still ahead (phased, see the plan)

Board structure (swimlanes, pivotal events) and the help-centre article
for the diagram type itself. Each phase lands with its own spec update
here — this file stays the source of truth for what the type IS at any
moment.

## Counts

The catalogue is pinned at **48 templates (10 default + 38 extra)** —
`templates.test.ts`, spec/09, spec/16, spec/23, the marketing FAQ +
landing copy, and the help centre's templates article all moved
together with this addition.
