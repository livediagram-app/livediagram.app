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
