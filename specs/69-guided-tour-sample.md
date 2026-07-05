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

A poster-composed scene centred on the viewport, in four zones:

- **Header**: a title text element ("Welcome to livediagram") and a caption
  explaining the one non-obvious mechanic: _hover the round note markers to
  learn the basics_.
- **An interactive flow row**: three themed shapes joined by pinned arrows
  (drag one and its arrows follow), ending in a diamond reached by a
  **labelled curved arrow with animated flow**, so arrow styling is visible,
  not just described.
- **"Make it yours"** (left): a slightly tilted sticky note plus two shapes
  carrying status **shape markers** (spec/49, one green, one red with a
  dashed border), giving the right-click styling note something concrete to
  point at.
- **"Beyond boxes"** (right): a progress bar, a progress ring, and a star
  rating at their factory defaults, plus a **Pencil-drawn freehand ribbon**
  between the clusters.
- **Annotation markers** (spec/38 circles), one per lesson, placed beside
  their subjects: the Palette, click / double-click / drag, drawing and
  styling arrows, right-click styling + markers, the Pencil (and shape
  recognition), the data shapes, themes + undo, and tabs + Share.

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
