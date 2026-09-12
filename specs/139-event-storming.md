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
- **Stage routing:** each note kind carries its workshop `stage` in the
  catalogue (events / actors / hotspots → Big picture; commands /
  policies / read models / external systems → Process; aggregates →
  Design). On an event-storming board the commit path files a dropped
  note onto its stage's layer (`eventStormingStageLayerId`), so a
  Command dropped while browsing Big picture is already where the
  Process stage expects it. Only when the target layer exists, is
  visible AND unlocked — otherwise (and on non-ES boards) the note
  falls through to ordinary active-layer stamping.
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

## Phase 3 (shipped): workshop-stage views

One board, three depths plus a timeline lens — **shared** layer-visibility
presets over spec/74 layers, so the whole room walks the stages together,
facilitator-style (a deliberate choice over a per-user lens).

- **The template ships three layers** (bottom → top):
  `layer:es:big-picture` / `layer:es:process` / `layer:es:design`, all
  visible. Fixed sentinel ids (the `layer:default` pattern) so
  re-applying converges and peers materialise identically. The seed
  lives on Big picture. Defined by `eventStormingLayers()` in
  `@livediagram/diagram` beside the note catalogue;
  `templateLayers('event-storming')` returns it, making ES the one
  deliberate exception to the two-band scaffold/content shape (its own
  pin in `templates.test.ts`). _The timeline-rail layer + element and
  its view-bar toggle were built and then retired before release — the
  rail added chrome without earning it. Boards created while it existed
  keep their `layer:es:rail` as ordinary spec/74 data, manageable from
  the Layers panel; nothing drives it any more._
- **Stages reveal cumulatively** (big-picture ⊆ process ⊆ design):
  `applyEventStormingStage` is one ordinary tab commit setting the three
  stage layers' visibility — undoable, autosaved, synced, nothing new on
  the wire. The current stage is DERIVED as the deepest visible stage
  (`eventStormingStageOf`), so a fresh board reads as Design (all-in) and
  hand-toggled panel state still resolves sanely.
- **The switcher** (`EventStormingViewBar`) is a slim bottom-centre pill —
  Big picture / Process / Design chips + a divider + Timeline rail — shown
  only when the active tab carries the ES stage layers
  (`isEventStormingTab`, tab data, so it travels with the board). Editors
  only: a stage switch commits shared visibility, which a view-role
  visitor can't do (they see whatever view the room is in). Hidden in
  zen / embed; yields the slot to the sign-in / empty-canvas banners, and
  ThemeModeBanner yields to IT on ES boards. Three stage chips only —
  the Timeline-rail toggle was retired with the rail.
- **Switching a stage also activates that stage's layer**
  (`useEventStormingViews`), so notes added while in a stage land on the
  band the stage owns — and the active layer never strands on a band the
  switch just hid (which would pause element creation per spec/74).
- **Telemetry:** `UI / Used / EventStorming{BigPicture,Process,Design}`.

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
  random rotation (±1.5°, one decimal) so a wall of notes reads as a
  workshop rather than a grid. The template's seed events ship tilted
  (±1.5°) and `fixedSize` too.
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
- Tilt is calibrated, not decorative: ±1.5° reads hand-placed, ±2.5°
  reads messy — seed and dropped notes share the same range.
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
- Alignment help belongs BEFORE the drop: guide lines during the palette
  drag serve the capture loop; a misplaced note that needs fixing after
  is friction.

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
