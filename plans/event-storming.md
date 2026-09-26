# Event storming diagram type

An on-par diagram type under the picker's **Technical** category, built
incrementally. Spec: [`specs/139-event-storming.md`](../specs/139-event-storming.md).
Each phase updates spec/139 in the same change as the code (spec-first rule).

"On par" in this repo means a template kind is only the entry point — a
finished diagram type also has its notation reachable from the palette, a
registered help article with a drawn card, telemetry on new interaction
surfaces, and every count-pinned copy surface moved together.

## Phase 1 — the type exists end-to-end (SHIPPED)

- [x] `TemplateKind 'event-storming'` + catalogue entry (Technical, extra)
- [x] Builder `template-builders-eventstorming.ts` — minimal seed: three
      orange past-tense domain-event stickies + a muted method-reminder line
- [x] `build-template.ts` dispatch case
- [x] Dot-grid backdrop (`TEMPLATE_PATTERNS`), like the other sticky workshops
- [x] Picker preview tile (`template-preview-4.tsx`)
- [x] Tests moved: `templates.test.ts` (48 = 10 + 38), `template-builders.test.ts`
      ALL_KINDS, `template-preview.test.ts` (generic)
- [x] Counts moved together: spec/09, spec/16, spec/23, marketing FAQ +
      landing copy, help templates article
- [x] Spec 139 + specs/README row
- [x] Verified in the dev server (open `/new` → Technical → Event storming)

## Decisions taken (2026-09-12)

- **Q1 — grammar home:** palette accordion — a dedicated Event Storming
  `PaletteTileGroup` inside the Write tab (the sticky's home category).
- **Q2 — seed:** stays minimal (three events + caption); grammar lives in
  the palette only.
- **Q3 — one kind, switchable views:** a single `event-storming` template
  kind; the SAME diagram switches between Big Picture / Process Modelling /
  Software Design as views, not separate templates.
- **Q4 — timeline:** none in the seed, plus a fourth view showing the board
  against a spec/51 timeline rail.

## Phase 2 — the shapes (the sticky colour grammar) (SHIPPED)

- [x] Shared note-kind catalogue `EVENT_STORMING_NOTES` in
      `@livediagram/diagram` (kind / label / blurb / fill), pinned by tests
- [x] Template builder reads its orange from the catalogue (no drift)
- [x] `PendingDraw` sticky intent carries `fill?`; `buildDrawnBoxed` lands it
      as `fillColor` (theme-exempt on stickies)
- [x] Eight tiles derived from the catalogue (`tools:es-<kind>`), collapsed
      behind a Write-tab **Event Storming** `PaletteTileGroup` row
- [x] Pressed-state matches on the fill (arming Command lights one tile)
- [x] Census 4 → 12 + the three prose surfaces it names: Write category
      description, help-registry entry (+ keywords), Write help article
      (+ tools article's Write line)
- [x] Telemetry unchanged: `Element / Added / Sticky` (fill = user choice,
      the Video-provider precedent)
- [x] Spec/139 phase-2 section
- [x] Verified in the dev server (Write tab → Event Storming → drop notes)

## Phase 3 — workshop-stage views (Q3/Q4) (SHIPPED)

One diagram, three cumulative stages + an additive rail lens.

- [x] DECIDED (Q5): layer-visibility presets over spec/74 layers — shared,
      synced, facilitator-led; the switch sets visible + active layer
- [x] DECIDED (Q6): slim on-canvas segment control, ES boards + editors only
- [x] Pure helpers in `@livediagram/diagram/event-storming` (layer ids,
      `eventStormingLayers`, `isEventStormingTab`, stage apply/derive, rail
      toggle), pinned by tests
- [x] Template ships the four stage layers (`templateLayers`), seed stamped
      onto Big picture, spec/51 rail element on the hidden rail layer — the
      one deliberate exception to the two-band pin, with its own pin
- [x] ~~`EventStormingViewBar` + `useEventStormingViews`~~ — withdrawn with the stage layers (spec/139 Phase 3); the board is one layer
      through EditorView; banners yield order settled (ThemeModeBanner
      yields to the bar)
- [x] Telemetry: UI/Used EventStorming{BigPicture,Process,Design,RailOn,RailOff}
- [x] Spec/139 phase-3 section + spec/09 template entry updated
- [x] Verified in the dev server (bar renders, rail toggles, stages switch)

## Phase 4a — palette promotion + stage routing + rail retirement (SHIPPED)

Decisions (2026-09-12, round two): the notation becomes a **top-level
palette category** (Structure band); tiles **auto-route notes onto their
stage's layer**; the **timeline rail is retired** (layer, element, view-bar
toggle — it added chrome without earning it; old boards keep the layer as
ordinary spec/74 data).

- [x] `stage` on the note catalogue + `eventStormingStageLayerId` (tested)
- [x] Rail removed: diagram helpers, template layer + element, view-bar
      chip, hook plumbing, telemetry strings; specs updated
- [x] Tiles moved to `section: 'event-storming'` (ids unchanged for
      Favourites); Write reverted to its four elements + census 4
- [x] Top-level category: PALETTE_CATEGORIES (Structure band), tab icon,
      dispatch entry, census 8
- [x] Stage routing in the commit path (visible + unlocked target only;
      falls through to active-layer stamping otherwise) — tested
- [x] Palette OPENS on the Event Storming category on ES boards (keyed
      default; Favourites everywhere else)
- [x] Help: `palette/event-storming` article + registry entry (+ Palette
      count 25) + card art (icon + hue); Write article/registry reverted
- [x] Specs: 139 rewritten sections, 110 band table, 09 template entry
- [x] Verified in the dev server (palette opens on the notation; Command
      files under Process from Design view, falls back gracefully in Big
      picture; stranded-active-layer self-heal fixed and verified)

## Phase 4c — workshop stationery (SHIPPED)

- [x] `size` class on the note catalogue (square / wide / small) +
      `eventStormingNoteSize`; wide = policy, external system, aggregate;
      small = actor — pinned by tests
- [x] `fixedSize` element flag + `isFixedSizeElement`; gates: resize
      handles, union scale, Size menu, drag-to-size, tap inheritance
- [x] Random ±2.5° tilt for every sticky dropped on an ES board; seed
      events stamped fixed + tilted
- [x] Palette tile glyphs mirror the silhouettes
- [x] Drag-to-board for sticky tiles (rows + Favourites grid), same
      builder as tap: fill / silhouette / tilt / fixed / routing verified
      via api (300×180 policy landed on layer:es:process)
- [x] Sticky chrome: 1px definition halo + retuned glue wash (3% → 14%,
      out by 33%)
- [x] Spec/139 phase 4 + spec/09 paper-look prose

## Phase 4b — board structure

- [ ] DECIDE: swimlanes / pivotal-event dividers as part of the seed?

## Phase 5 — the on-par tail

- [x] Help article `apps/help/app/canvas/event-storming-boards/page.mdx` + registry
      entry (`packages/help-registry`) with keywords, category, articleCount
      bump + FEATURE_ICONS / FEATURE_ENTITY_HEX card art (spec/55 house style)
- [x] Marketing: name-checked in the FAQ + landing counts; a use-case
      carousel entry is NOT earned yet — the type is one workshop notation,
      not a headline use case, and the counts already carry it
- [x] MCP: `list_templates` picks it up automatically — verified: entry present, overrides carry kind + the single layer, 4 seed elements, 48 templates
- [x] E2E: the smoke did NOT cover template creation at all — added a
      startTemplateDiagram fixture + a case walking template → board → reload
- [x] Fold-back: `esStageStamp` → `esBoardLayerStamp`, the `stage` field
      comment now states what it IS (domain vocabulary, drives nothing),
      dead view-bar comments removed, spec/139 opens with the board kind

## Phases 6–8 — lanes, anchor docking, photo import (SHIPPED)

Three additions to the board kind, planned and worked in
[`plans/event-storming-photo-lanes-docking.md`](event-storming-photo-lanes-docking.md)
and specified in spec/139's Phase 6 / 7 / 8 sections:

- **Timeline lanes** (`Tab.esTimeline`): a board-level switch giving the y axis
  a rhythm, lit only while a note is being dragged.
- **Anchor docking** (`StickyElement.esDock`): the notation's own adjacencies —
  command↔event, command↔policy, policy↔event — as something the board knows.
- **Photo import** (`POST /api/ai/photo-notes`): read a photograph of the real
  wall and add only the notes the board does not already have.
