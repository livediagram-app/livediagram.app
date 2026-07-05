# 69 — Guided tour sample ("Show me around")

A learn-by-doing onboarding option: the welcome wizard offers **Show me
around**, which fills the first tab with a small hand-built sample diagram
whose annotation markers ([spec/38](38-annotations.md)) explain the core
interactions in place. Instead of reading a help article in another tab, the
new user pokes at a real diagram that teaches itself.

## Where it appears

- **Welcome wizard only.** The template step of the welcome flow (both the
  first-run `/new` page and the in-editor welcome picker, see
  [spec/14](14-new-diagram-route.md)) shows a **Show me around** card next to
  the **Blank** quick-pick card. It does not appear in the in-editor
  "Browse templates" mode — it's an onboarding affordance, not a template you
  reach for later.
- **One click, no theme step.** Picking it commits immediately with the
  default theme (same shortcut the footer **Skip** takes), because the point
  is to land the user on a living canvas fast. Theme browsing can come later
  through the normal Appearance surfaces.

## The sample itself

A compact scene centred on the viewport:

- A **title** text element ("Welcome to livediagram") and a caption
  explaining the one non-obvious mechanic: _hover the round note markers to
  learn the basics_.
- **Three themed shapes connected by pinned arrows** (a mini flow), so
  dragging a shape visibly drags its arrows with it.
- A **sticky note** as a second element flavour.
- **Annotation markers** (spec/38 circles), each placed beside the thing it
  explains, teaching via their hover notes:
  1. add elements from the Palette,
  2. double-click a shape to edit its label,
  3. drag from a shape's edge to draw an arrow,
  4. right-click an element for colours and styling,
  5. undo with Ctrl/Cmd+Z or from the Activity panel.

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
`track('Template', 'Used', 'Guided Tour')` via the shared choose/commit
paths (see [spec/22](22-telemetry.md)). No new categories or actions.
