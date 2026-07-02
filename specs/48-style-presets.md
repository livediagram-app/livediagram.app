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

- **Style presets** — twelve one-click looks derived from the active theme.
  Each preset is a _complete_ style: it sets the shape's fill, border (stroke)
  and text colour AND a matching border treatment (weight, pattern, corner
  radius) together, so the border isn't a separate choice. The set spans the
  theme's on-theme look plus soft / tinted / solid / bold / outline / muted /
  inked / pill / dotted / frame / ghost variants (and, on multi-colour themes, a
  card per branch hue), each pairing a colour with the border that suits it
  (Bold → thick, Outline → dashed, Pill → full radius, Dotted → dotted, Frame →
  thick + sharp, Ghost → thin dashed). Text colour is auto-contrasted on filled
  variants so labels stay readable. The standalone weight / pattern / radius
  controls in the **Border** category remain for fine-tuning after a preset.
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

The same hover-to-preview / click-commit flow extends to the **individual**
appearance controls in the context menu, not just the preset tiles:

- the **colour swatches** (Text / Background / Border) in the Colours section,
- the **Border** tiles (Strength / Pattern / Radius), and
- the **Rotation** angle tiles.

Hovering any of these shows the value live on the selection and only commits on
click, with the same ephemeral-preview / true-undo guarantees as the presets.
The one exception is each colour row's **custom `+` picker** (the native
`<input type=color>`): it stays on the debounced direct setter (a colour drag
must not land a history step per pixel), so it does not hover-preview.

## Arrows

When an **arrow** is right-clicked — on its own, or within a multi-selection
that contains one or more arrows — the **Presets** category offers eight
one-click arrow styles that combine line pattern (solid / dashed / dotted),
thickness and an optional flow animation (e.g. a dashed animated arrow, a
travelling-dot arrow), plus **Reset to default**. Reset clears the arrow's
line-pattern / thickness / animation overrides. In a multi-selection the preset
applies to every selected arrow at once.

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
  `track('Element', 'Changed', …)` with a `StylePreset` / `BorderPreset` /
  `ArrowPreset` / `StyleReset` type token.
