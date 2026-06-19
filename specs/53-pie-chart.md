# 53 — Data charts (pie + bar + line)

Data charts are elements whose marks are sized by value, in a categorical
palette, with an optional legend. The palette holds them in the **Data**
sub-section of the **Tools** tab (folded in from a former standalone Data
category so the palette spends one fewer top-level tab) — **Pie**, **Bar**, and
**Line** today, built so more chart kinds slot in beside them. They share the
animation set, legend toggle, and context-menu categories; pie + bar also share
the same 1-D data model, while the line chart carries a 2-D dataset (see Model).

## Behaviour

- Drag a **Pie**, **Bar**, or **Line** chart in from the **Data** sub-section
  of the palette's **Tools** tab. It drops with sample data.
- A **Data** context-menu category edits the chart. Pie / bar edit inline: one
  row per datum — a recolourable swatch, a **label**, and a **value** — plus
  add / remove. The line chart's 2-D grid is too wide for the narrow menu, so
  the category instead **summarises the series** (a colour dot + name) and an
  **Edit data** button opens a **modal** (`LineDataDialog`): a row per category,
  a column per series, add / remove either axis, and an **Import CSV** button
  (header row = series names, first column = category labels). The chart +
  legend redraw live from the data.
- Hovering a mark (slice / bar / line point) shows a tooltip with its label +
  value, regardless of the legend toggle.
- A **Chart** context-menu category holds display options: a **Legend** toggle
  (on by default) that shows / hides the label key beside the chart.
- The **Animation** category carries the chart-specific animations
  (None / Grow / Pop / Spin / Pulse, with a **Speed** row + **Repeat** toggle)
  in place of the boxed-element animation set — a chart animates its marks, not
  the whole box. Grow / Pop play once (an entrance); Spin / Pulse loop.
- Mark colours default to **variants of the active theme** (`themeChartPalette`
  — each branch hue on multi-colour themes, accent tints/shades on single-accent
  themes), overridable per datum. So a chart reads as part of the theme out of
  the box.
- It's a normal boxed element otherwise (move / resize / select / group / lock),
  but the **Colours / Border / Presets** context-menu categories are hidden — a
  chart styles per-datum via its Data category, not as one filled box.

## Model

Each chart is a `ShapeKind` (`'pie-chart'` / `'bar-chart'` / `'line-chart'`),
not a new top-level type — so they inherit boxed-element behaviour. `isChartShape`
groups all three (they're all in `isSelfDrawingShape` too).

- Pie + bar: `ShapeElement.pieSlices?: PieSlice[]` (`{ label, value, color? }`).
- Line: `ShapeElement.lineCategories?: string[]` + `lineSeries?: LineSeries[]`
  (`{ name, color?, values: number[] }`), aligned to the categories — a 2-D
  dataset. `LINE_DEFAULT_CATEGORIES` / `LINE_DEFAULT_SERIES` seed a fresh chart.
- All three share `pieAnim?` / `pieAnimSpeed?` / `pieAnimRepeat?` + `chartLegend?`.
  The types + constants + `isPieShape` / `isBarShape` / `isLineShape` /
  `isChartShape` live in `packages/diagram/src/index.ts`.
- Rendered by `PieChartView` / `BarChartView` / `LineChartView`: SVG marks in the
  default palette or a per-mark colour, with a `ChartLegend`; the mark group
  carries the `lvd-pie-*` animation (CSS in `globals.css`, reduced-motion-safe),
  the axes / labels stay still. `element-variant.ts` gives them a borderless
  wrapper. Shared preamble lives in `lib/chart.ts` (`chartFrame` / `chartAnim`);
  hover wiring in `useChartHover` + `ChartTooltip`.
- CSV import (line): `parseCsvLineData` in `apps/live/lib/csv.ts` (quoted-field
  aware) turns a pasted/uploaded CSV into categories + series.
- Setters in `useElementStyle.ts`: `setPieDataSelected(slices)` (pie / bar),
  `setLineDataSelected(categories, series)` (line), + `setChartLegendSelected` /
  `setPieAnim*Selected`, all gated to chart shapes.
- Telemetry (spec/22): `track('Element', 'Added', 'PieChart' | 'BarChart' |
'LineChart')` on create, `track('Element', 'Changed', 'ChartData' | 'LineData'
| 'ChartAnim' | 'ChartLegend')` on edits.

Follows the composite-component pattern (spec/51, 52): a dedicated `ShapeKind`

- small `ShapeElement` fields + a bespoke `*View` + a borderless variant + a
  context-menu category. New chart kinds reuse it under the same Data palette tab.
