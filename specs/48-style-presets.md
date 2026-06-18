# 48 — Style presets

One-click style presets in the selected-element context menu, so a user can
create variety and emphasis on key elements without dialling each field by
hand. A **Presets** category sits at the top of the appearance group (above
**Animation**).

## Shapes

When a single **shape** element is right-clicked, the menu shows a **Presets**
category with two preset rows the user combines freely, plus a reset:

- **Colour** — eight one-click colour variations derived from the active
  theme. Each preset sets the shape's fill, border (stroke) and text colour
  together. The set spans the theme's on-theme look plus soft / tinted / solid
  / bold / outline / muted / inked emphasis variants (and, on multi-colour
  themes, a card per branch hue), so the same theme yields a legible spread of
  intensities. Text colour is auto-contrasted on filled variants so labels
  stay readable.
- **Border** — up to eight border-shape variations combining weight
  (thin / medium / thick), pattern (solid / dotted / dashed) and corner radius
  (none / small / medium / large / full). Includes a sharp (un-rounded) preset
  and a rounded preset using the border-radius the Border category exposes, so
  the user can pick variety and emphasis at a glance.
- **Reset to default** — clears the shape's colour overrides back to the
  theme and removes border weight / pattern / radius overrides, returning the
  shape to its theme default in one click.

Colour and border presets are independent: applying one never disturbs the
other, so the two combine (e.g. a tinted colour with a dashed un-rounded
border).

## Arrows

When a single **arrow** is right-clicked, the **Presets** category offers
eight one-click arrow styles that combine line pattern (solid / dashed /
dotted), thickness and an optional flow animation (e.g. a dashed animated
arrow, a travelling-dot arrow), plus **Reset to default**. Reset clears the
arrow's line-pattern / thickness / animation overrides.

## Implementation notes

- The category renders only in the single-element context menu, only for the
  matching element type (shape vs arrow). It is not offered in the
  multi-selection menu.
- Colour presets are theme-derived via `shapeColorPresets(theme)` in
  `apps/live/lib/themes.ts` (reusing the existing `tint` / `shade` /
  `isLightColor` colour helpers), so they always track the active theme like
  the colour-picker swatches (`themePresetColors`).
- Border and arrow presets are static preset tables in the presets component
  (`apps/live/components/StylePresets.tsx`).
- Each preset applies in a single history step via dedicated selection setters
  in `apps/live/hooks/useElementStyle.ts`
  (`applyShapeColorPresetSelected` / `applyShapeBorderPresetSelected` /
  `resetShapeStyleSelected` / `applyArrowPresetSelected` /
  `resetArrowStyleSelected`).
- Telemetry (spec/22): applying / resetting a preset fires
  `track('Element', 'Changed', …)` with a `StylePreset` / `BorderPreset` /
  `ArrowPreset` / `StyleReset` type token.
