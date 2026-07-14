# 86 — Element shadows

A **Shadow** category in the element style menu: a soft drop shadow behind a
boxed element, picked from presets or dialled in with sliders. It gives cards,
frames, and hero shapes depth without faking it with offset duplicate shapes.

## Data model

`shadow?: ElementShadow` on the boxed element types that draw a visible body:
**shape** (every kind, including icons and the self-drawing data shapes),
**sticky**, **image**, and **link-card**. Text, freehand, annotation, table,
and arrows don't carry one (arrows are a possible follow-up; a rectangular
shadow under a line or a text run reads as a rendering bug, not a style).
`supportsShadow(el)` in `@livediagram/diagram` is the single gate the UI and
renderers share.

```ts
type ElementShadow = {
  offsetX: number; // px, clamped to ±SHADOW_LIMITS.offset (24)
  offsetY: number; // px, same clamp
  blur: number; // px, 0..SHADOW_LIMITS.blur (48)
  opacity: number; // 0..1 shadow strength
};
```

Numeric fields (like `opacity`, unlike the border's preset buckets) because
the whole point of the category is slider control. The **colour is fixed**
(the slate-900 ink, `SHADOW_COLOR_RGB`) so shadows always read as shade, stay
theme-agnostic, and the model stays four sliders; a colour picker is a
possible follow-up. Absent field = no shadow (the default; the subtle
`shadow-sm`/`shadow-md` Tailwind resting shadows some kinds already carry are
cosmetic chrome, not part of the model, and an explicit `shadow` replaces
them visually).

## Presets + sliders

The **Shadow** accordion sits after **Border** in the element context menu's
style group (and in the multi-select Style flyout, applying selection-wide
like Border does). Contents:

- **Preset tiles** — `None`, `Soft`, `Drop`, `Lifted`, `Hard`
  (`SHADOW_PRESETS` in `@livediagram/diagram`): hover-to-preview /
  click-to-commit like the border grids. `None` clears the field. `Hard` is
  the zero-blur offset "poster" shadow; the other three are elevation steps.
- **Sliders** — Offset X (±24), Offset Y (±24), Blur (0..48), Opacity
  (0..100%). They follow the opacity-slider policy (debounced non-history
  ticks, one undo step + one log entry per gesture). Dragging any slider when
  no shadow is set seeds the rest from `DEFAULT_SHADOW` (the Drop preset's
  values, which the sliders also display at rest) so the first drag produces
  a visible shadow, not a degenerate all-zero one.

## Rendering

Canvas (`describeVariant`): CSS-native shapes with an opaque fill, stickies,
and link cards use `box-shadow` (cheap, follows the border radius).
Everything else that renders through a transparent wrapper (SVG silhouettes,
icons, data shapes, images, transparent-fill shapes) uses
`filter: drop-shadow(...)`, which follows the drawn alpha instead of the
bounding box. Both strings come from one place (`shadowBoxCss` /
`shadowFilterCss`).

Headless SVG export (`renderElementsToSvg` + the in-app export): one
`<filter><feDropShadow/></filter>` def per **unique** shadow in a `<defs>`
block (deterministic id via `shadowFilterId`, so elements sharing a shadow
share a def), referenced from the element's `<g filter="url(#…)">`.
`feDropShadow.stdDeviation` is `blur / 2` (the CSS blur radius ≈ 2σ
equivalence), so exports match the canvas. Snapshots (spec/67), embeds
(spec/33), and MCP renders inherit parity for free.

## Interactions with existing style machinery

- **Format painter** copies `shadow` with the other boxed style fields.
- **Reset style** (spec/48's shape reset) clears it; **Reset to theme**
  (colours only) leaves it alone — a shadow is geometry, not a colour.
- Themes never write shadows; presets are theme-independent.
- Telemetry (spec/22): preset commits fire `track('Element', 'Changed',
'Shadow')` via the shared preview/commit path; slider drags stay untracked
  like the opacity slider (the debounced change-log entry covers audit).
