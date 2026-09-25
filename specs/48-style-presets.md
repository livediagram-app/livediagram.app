# 48 — Style presets

One-click style presets in the selected-element context menu, so a user can
create variety and emphasis on key elements without dialling each field by
hand. A **Presets** category sits at the top of the appearance group (above
**Animation**).

## Shapes

When a **shape** element is right-clicked — on its own, or as part of a
multi-selection that contains one or more shapes — the menu shows a **Presets**
category with a single row of one-click looks, plus a reset. In a
multi-selection the chosen preset (or reset) applies to **every** selected
shape at once, in a single history step; the active-tile highlight reads off
the first selected shape. The dedicated **icon** glyph is excluded — it has no
fill / border to preset:

- **Style presets** — one-click looks derived from the active theme, one
  flat 4-wide grid ordered in **four tiers**, each tier quiet → loud so the
  grid reads as a run of ramps. The tiers are an ordering only: headings over
  them were tried and dropped, since they cost more menu height than they
  earned.
  - **Theme** — the accent at rising intensity: the theme's own look first
    (plus a card per branch hue on multi-colour themes), then Soft / Tinted /
    Solid / Bold.
  - **Neutral** — theme-independent greys: Ghost / Paper / Muted / Slate /
    Inked. Paper is a plain white card with a hairline grey edge; Slate a
    filled mid-grey, emphasis without the accent.
  - **Border** — line treatments: Hairline / Outline / Dotted / Dash-Dot /
    Frame. Hairline is the accent as a thin line with the label in the same
    colour (a line drawing); Dash-Dot carries the `dash-dot` border pattern.
  - **Status** — the semantic set, the same under every theme: Info /
    Success / Warning / Danger / Highlight (violet, "look here", for a
    callout that is none of the four states).

  Each preset is a _complete_ style: it sets the shape's fill, border
  (stroke) and text colour AND a matching border weight + pattern together
  (Bold → thick, Outline → dashed, Dotted → dotted, Dash-Dot → dash-dot,
  Frame → thick, Ghost → thin dashed, Hairline / Paper → thin) — but **never
  the corner radius**: radius is a silhouette choice the user makes
  separately, and presets clobbering it read as the preset breaking the shape
  (the radius-defined Pill preset left with that rule; a stored 'pill'
  binding simply stops re-deriving). Text colour is auto-contrasted on filled
  variants so labels stay readable. Twenty looks on a single-accent theme
  (five per group); a multi-colour theme adds its branch cards. The set is
  deduped on the colour triple but **not capped**: a cap would cut a tier
  short (the old 20-cap dropped Danger on six-branch themes). The standalone weight / pattern /
  radius controls in the **Border** category remain for fine-tuning after a
  preset.

- **Reset to default** — clears the shape's colour overrides back to the
  theme and removes border weight / pattern / radius overrides, returning the
  shape to its theme default in one click.

### Colour presets track the theme

A colour preset is theme-relative, not a frozen set of hex values. When applied
to a shape we store the preset's **stable id** (e.g. `bold`, `soft`,
`branch-0`) on the shape alongside the concrete colours it wrote. Changing the
diagram's **theme** then re-derives the bound preset for the new theme — a
shape on the **Bold** preset becomes the new theme's Bold look rather than
staying pinned to the previous theme's colours. The binding is dropped the
moment the user hand-edits any of the shape's colours or resets it to theme
(at which point the preset no longer describes the shape). Starter **templates**
use this too: a template's key element ships with a `colorPreset`, so it stands
out in whatever theme the diagram is created with.

### Hover to preview (desktop)

On a desktop pointer, **hovering** a preset tile shows it **live** on the
selected element(s) so the user can compare looks at a glance; the change only
sticks on **click**. Moving the pointer off the tile reverts to the pre-hover
look. The preview is ephemeral — it never lands an undo step or an activity-log
entry, and is reverted before the click commits, so undo snapshots the true
pre-hover state and the activity entry diffs from it correctly. Touch / pen
input does not preview (a tap is the commit).

### Granular controls preview too

The same hover-to-preview / click-commit flow extends to **every discrete tile
control** in the context menus (single-element and multi-selection), not just
the preset tiles:

- the **colour swatches** (Text / Background / Border) in the Colours section,
- the **Border** tiles (Strength / Pattern / Radius),
- the **Rotation** angle tiles,
- the **Shape** morph tiles (the single menu previews just the clicked
  element, never its whole group; the multi menu previews every morphable
  member),
- the **Icon size** tiles on a Technology icon (spec/41),
- the **Icon position** cross on a shape's inline icon,
- the **Markers** tiles and their Size row (spec/49),
- the **Text Alignment** 3×3 grid, and
- the **Text size** tiles (Scale / S / M / L).

Hovering any of these shows the value live on the selection and only commits on
click, with the same ephemeral-preview / true-undo guarantees as the presets.
The one exception is each colour row's **custom `+` picker** (the native
`<input type=color>`): it stays on the debounced direct setter (a colour drag
must not land a history step per pixel), so it does not hover-preview.

## Arrows

When an **arrow** is right-clicked — on its own, or within a multi-selection
that contains one or more arrows — the **Presets** category offers twelve
one-click arrow styles, ordered as hierarchical tiers: the **solid weights**
lightest → heaviest (Fine / Plain / Bold), then the **patterns** with their
weight variants (Fine Dash / Dashed / Bold Dash / Dotted), then the
**animated flows** (Flow / Dash Flow / Dot Flow / Signal / Pulse), plus
**Reset to default**. Reset clears the arrow's line-pattern / thickness /
animation overrides. The active-tile highlight matches on pattern +
thickness + flow (thickness disambiguates the weight tiers). In a
multi-selection the preset applies to every selected arrow at once.

## Implementation notes

- The category renders in both the single-element context menu and the
  multi-selection menu, for the matching element type (shape vs arrow). The
  `ShapePresetsSection` / `ArrowPresetsSection` components in
  `apps/live/components/palette/PresetSections.tsx` are shared by both menus so
  there is one implementation; the multi menu surfaces a shape section when the
  selection holds any preset-eligible shape and an arrow section when it holds
  any arrow, and the apply / reset handlers are already selection-wide
  (`applyShapeColorPresetSelected` / `applyArrowPresetSelected` walk every
  selected element id). When a mixed selection shows **both** sections they are
  titled **Shape Presets** / **Arrow Presets** to disambiguate (the same rule
  the Animation sections use); a single-kind selection keeps the plain
  **Presets** label.
- Colour presets are theme-derived via `shapeColorPresets(theme)` in
  `apps/live/lib/themes.ts` (reusing the existing `tint` / `shade` /
  `isLightColor` colour helpers), so they always track the active theme like
  the colour-picker swatches (`themePresetColors`). Each preset carries a
  stable `id`; `shapeColorPresetById(theme, id)` / `rederiveColorPresetForTheme`
  resolve a stored id back to colours for a theme, and the theme-change paths
  (`recolourElementsForTheme` / `switchThemeElements`) call them so a
  preset-bound shape re-derives instead of being preserved as a manual
  override. The `colorPreset` binding lives on `ShapeElement` in
  `packages/diagram`.
- Arrow presets are a static preset table in the presets component
  (`apps/live/components/palette/StylePresets.tsx`); shape style presets are theme-derived
  (`shapeColorPresets`), each carrying its border treatment.
- The element transforms each preset performs live in `apps/live/lib/style-presets.ts`
  (`applyColorPresetToEl` / `applyArrowPresetToEl`),
  shared so the hover preview is byte-for-byte the change the click commits. The
  granular single-field transforms live in the same file
  (`applyFillColorToEl` / `applyStrokeColorToEl` / `applyTextColorToEl` /
  `applyBorderStrokeToEl` / `applyBorderStyleToEl` / `applyBorderRadiusToEl` /
  `applyRotationToEl`) and are shared by both the direct setters in
  `useElementStyle.ts` and the preview/commit pairs in `useStylePreview.ts`, so
  the swatch/tile preview matches its commit exactly.
- Direct (non-preview) commits go through the selection setters in
  `apps/live/hooks/canvas/useElementStyle.ts` (`applyShapeColorPresetSelected` /
  `resetShapeStyleSelected` / `applyArrowPresetSelected` /
  `resetArrowStyleSelected`). Hand-editing a
  colour or resetting clears the `colorPreset` binding there.
- Hover preview is owned by `apps/live/hooks/canvas/useStylePreview.ts`: preview +
  revert go through `tickTabs` (present-only, no history / no log); the click
  commit restores the originals into the present, then commits, so the undo
  snapshot and activity diff are taken from the true pre-hover state. The
  context menu wires the tiles' click → commit and pointer enter/leave →
  preview/revert (mouse pointers only).
- Telemetry (spec/22): applying / resetting a preset fires
  `track('Element', 'Changed', …)` with a `StylePreset` / `ArrowPreset` /
  `StyleReset` type token. (A `BorderPreset` token was listed here too. There
  are no border presets, in this spec or in the code, so nothing ever emitted
  it.)

## Sticky-note presets

A sticky had no presets at all, so recolouring a note meant picking a fill and then hunting a readable ink to go on it: two decisions for what is really one. The Style band now opens a **Presets** grid for a sticky too, from `STICKY_PRESETS` in `packages/diagram/src/theme-presets.ts`.

It is a fixed pad, deliberately **not** theme-derived: a sticky is exempt from theme recolouring ([spec/139](139-event-storming.md)) precisely because the colour of a note is the user's own shorthand rather than the board's palette. Twelve notes, in three runs of four: warm (Classic, Lemon, Peach, Rose), cool (Lilac, Sky, Mint, Teal) and neutral (Slate, Paper, Charcoal, Ink). Each pairs its paper with an ink that reads on it, and a test holds that pairing, since a preset with unreadable text is worse than no preset.

A note carries **no border**: its edge against the peel shadow is its border. So a sticky preset's `stroke` is transparent with weight `none`, and applying one clears any hand-set `strokeColor` with it, which is what "one complete look" means for a note. The tiles preview as squares, which is what a note is.

The presets bind by exact colour match rather than by id: `colorPreset` is a shape field, and a sticky has no use for it beyond the highlight.

## Table looks

A table paints **four** surfaces (cells, grid lines, header band, header text)
that only read well in combination, so picking them one swatch at a time was
four decisions and a fair chance of a header you cannot read the title on. The
Presets grid offers eight complete looks from `tableColorPresets(theme)`,
theme-derived like the shape presets: the accent tier (Theme, Banded, Bold Head,
Minimal) then neutrals that are the same under every theme (Plain, Paper, Slate,
Inked). A test holds that every header band pairs with a readable title colour.

Banding (`zebra`) rides along, because it is a look. `headerRow` /
`headerColumn` deliberately do **not**: which cells ARE headers is data, and a
preset flipping it would silently re-read the first row of somebody's table as a
heading. Reset goes through the shared reset-colours handler, the same one the
Colours section's own reset uses.

A table **binds to its look** exactly as a shape binds to its colour preset:
`applyTablePresetToEl` records the preset's id in `tablePreset` on the table
element, and the theme-change paths call `rederiveTablePresetForTheme` so a
Banded table moves to the new theme's Banded instead of stranding on the old
theme's accent. The binding is what makes that possible: a table preset writes
RESOLVED colours into four fields, so without an id a theme change cannot tell a
look from four hand-picked colours, and it preserves them as customs. (This is
why a table was the one preset-styled element that did not follow a theme
change: charts and code blocks store only an id and resolve at render, and
shapes have always had `colorPreset`.) Hand-setting any of the colours the look
owns (cell fill, grid, text, header band, header text) or toggling the banding
clears the binding, because past that point the colours are the user's.

## Code-block schemes

A code block's Presets grid is its **colour scheme** rather than a shape look. It paints its own card and takes no element colours, so there is nothing to reset it to but another scheme, and the grid carries no reset row. See [spec/82](82-code-block.md).

## Chart palettes

A chart's Presets grid is the categorical **ramp** its slices / series fall back
to: a chart styles per slice from its Data category, so a look for it is the
palette, not a fill and a border. Its reset clears the choice, which puts the
chart back on the tab theme's palette. See [spec/53](53-pie-chart.md).

## Which grid an element gets

`TargetPresetsSection` (`components/palette/PresetSections.tsx`) is the one
place that answers it: chart palette, table look, shape look, sticky pad, code
scheme, or arrow line. Elements with none render nothing, so the caller mounts
it unconditionally.
