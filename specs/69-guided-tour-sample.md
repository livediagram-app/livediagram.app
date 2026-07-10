# 69 — Guided tour sample ("Take the guided tour")

> Naming note: this card's CTA was originally "Show me around". That name
> now belongs to the interactive editor tour
> ([spec/79](79-editor-tour.md)), so the card reads **Take the guided
> tour** instead. The two coexist: this spec is the annotated sample
> diagram, spec/79 the step-by-step chrome tour.

A learn-by-doing onboarding option: the welcome wizard offers a guided-tour
card, which fills the first tab with a small hand-built sample diagram
whose annotation markers ([spec/38](38-annotations.md)) explain the core
interactions in place. Instead of reading a help article in another tab, the
new user pokes at a real diagram that teaches itself.

## Where it appears

- **Welcome wizard only.** The template step of the welcome flow (both the
  first-run `/new` page and the in-editor welcome picker, see
  [spec/14](14-new-diagram-route.md)) shows a **Take the guided tour** card
  next to the **Blank** quick-pick card. It does not appear in the in-editor
  "Browse templates" mode — it's an onboarding affordance, not a template you
  reach for later.
- **One click, no theme step.** Picking it commits immediately with the
  default theme (same shortcut the footer **Skip** takes), because the point
  is to land the user on a living canvas fast. Theme browsing can come later
  through the normal Appearance surfaces.

## The sample itself

A hand-arranged reference layout (designed in the editor, then lifted into
the builder): a header plus **six large dashed section panels** in a
two-column grid, walked in reading order by **dashed-flow guide arrows** so
the eye always knows where to go next. The panels pin their soft grey fill
(`themeLockFill`) so they stay quiet containers under every theme.

1. **Palette**: sample shapes, a sticky + image placeholder + annotation
   (the Tools), device frames, line-art icons, and Technology marks, each
   row captioned.
2. **Editing Elements**: rename / rotate demos, status shape markers
   (spec/49), border styles, and the data shapes (progress bar + ring, star
   rating).
3. **Arrows**: three connected pairs showing a straight labelled arrow, a
   curved arrow with animated flow, and an elbow arrow.
4. **Collaboration**: two "participant" nodes joined by a beads-flow arrow,
   plus stickies about live links, comments and assigned actions.
5. **Selection Modes**: a marquee-bait row, a grouped pair, and a locked
   element.
6. **Explorer**: document shapes as diagrams-in-folders, plus a team
   library.

Each section carries **one annotation marker** (spec/38) with the deeper
lesson; the header caption explains the mechanic ("Hover over the small
annotations to learn the basics, then make this canvas yours.").

The exact copy and layout live in the builder; the spec constraint is that
every teaching note describes a real, currently-shipped interaction (if an
interaction changes, the tour copy changes in the same PR).

## Implementation

- **A real template kind.** `'guided-tour'` joins `TemplateKind` with a
  builder (`template-builders-guided-tour.ts` in `packages/templates`), so
  both commit paths — `/new`'s `commitNewDiagram` and the in-editor
  `chooseTemplate` — reuse the existing build → theme-recolour → commit
  pipeline unchanged.
- **Hidden from listings.** `TemplateDescriptor` gains `hidden?: boolean`.
  Hidden templates are excluded from the template browse grids, the template
  search, and the MCP `list_templates` catalogue, but remain buildable via
  `buildTemplate`. The tour is the first hidden template; the flag is generic.
- The welcome card calls the same `onPick` the Blank card uses, passing the
  `'guided-tour'` kind and the default theme.

## Telemetry

Falls out of the existing template pipeline:
`track('Template', 'Used', 'Guided-tour')` via the shared choose/commit
paths (the standard `titleCaseType(kind)`, see [spec/22](22-telemetry.md)).
No new categories or actions.
