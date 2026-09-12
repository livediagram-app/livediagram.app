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

## Phase 3 — workshop-stage views (Q3/Q4)

One diagram, four ways to look at it: **Big Picture** (events + hotspots +
actors), **Process Modelling** (adds commands / policies / read models /
external systems), **Software Design** (adds aggregates), **Timeline rail**
(the board against a spec/51 rail).

- [ ] DECIDE: mechanism — layer-visibility presets over spec/74 layers
      (shared, synced, facilitator-led; template ships stage layers and the
      mode switch sets visible + active layer) vs a per-user view lens
      (spec/45 isometric precedent; new filter machinery) — surfaced as a
      question, layers recommended
- [ ] DECIDE: where the switcher lives (context-menu category vs a small
      on-canvas mode bar vs the Layers panel alone)
- [ ] Template ships the stage layers via `templateLayers` once the
      mechanism is decided
- [ ] The rail view: a scaffold layer holding a spec/51 timeline-rail
      element (visible only in that view) vs a rendered overlay
- [ ] Telemetry on the switcher
- [ ] Spec/139 update describing views as shipped

## Phase 4 — board structure

- [ ] DECIDE: swimlanes / pivotal-event dividers as part of the seed?

## Phase 5 — the on-par tail

- [ ] Help article `apps/help/app/.../event-storming/page.mdx` + registry
      entry (`packages/help-registry`) with keywords, category, articleCount
      bump + FEATURE_ICONS / FEATURE_ENTITY_HEX card art (spec/55 house style)
- [ ] Marketing: decide whether event storming earns a use-case mention
      beyond the counts (carousel / FAQ list already name-checks it)
- [ ] MCP: `list_templates` picks it up automatically — verify output once,
      no code expected
- [ ] E2E: confirm the generic smoke (spec/72) covers template creation, add
      a case only if it doesn't
- [ ] Fold-back: names match post-plan reality, spec/139 states what the type
      IS, no plan-coordinate comments left in code
