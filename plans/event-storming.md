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

## Phase 2 — the shapes (the sticky colour grammar)

The notation's element kinds, each a sticky with a pinned semantic colour:

| Note            | Colour            | Meaning                                  |
| --------------- | ----------------- | ---------------------------------------- |
| Domain event    | orange            | something that happened, past tense      |
| Command         | blue              | an intent that triggers the event        |
| Actor / user    | small yellow      | who issues the command                   |
| Policy          | lilac / purple    | "whenever X then Y" reaction rule        |
| Read model      | green             | information the actor decides on         |
| External system | pink              | third party the flow touches             |
| Aggregate       | large pale yellow | the thing commands act on (design level) |
| Hotspot         | red / magenta     | conflict, question, risk                 |
| Opportunity     | green (diamond)   | improvement idea                         |

- [ ] DECIDE: where the grammar lives (see decisions below) — palette
      surface vs builder-only vs both
- [ ] Shared note-kind constants (labels + colours) in `@livediagram/templates`
      or `@livediagram/diagram`, so builder + palette + MCP can't drift
- [ ] The chosen palette surface, with telemetry on the new tiles
      (`track('Element', 'Added', <Type>)` — reuse existing enums where they fit)
- [ ] Extend the template seed to introduce the grammar (per the seed decision)
- [ ] Tests: colour constants pinned, builder lockstep, palette tile tests
      matching the existing tile-def suites
- [ ] Spec/139 update describing the grammar as shipped

## Phase 3 — board structure

- [ ] DECIDE: timeline treatment (plain arrow vs timeline element vs none)
- [ ] DECIDE: swimlanes / pivotal-event dividers as part of the seed?
- [ ] Consider `templateLayers` (scaffold vs content split, spec/74) once the
      board has scaffold worth locking
- [ ] Big-picture vs process-level variants — one kind or two (see decisions)

## Phase 4 — the on-par tail

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
