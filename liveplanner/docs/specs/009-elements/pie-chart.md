# Data charts (pie + bar + line)

Data charts are elements whose marks are sized by value, in a categorical
palette, with an optional legend. In liveplanner a chart is made from a Sheet's cells (**Insert Chart**, a template's
sheet, an agent's `change_sheet`; [Sheet charts](../029-sheets/sheet.md#charts)) or in a Dashboard slot from a Sheet
([Sheet Chart](../026-plan/plan-tabs.md#sheet-chart)), and the canvas draws a chart linked to a Sheet (`chartSource`; see "Charts
drawn from a sheet"). A chart with no `chartSource` (an import, a paste, an unlinked one) is in the model and every
export, and on the canvas shows as an empty box with its selection ring ([Elements](README.md)). Each draws as one of seven
**chart types** (Chart types, below): Column, Bar, Line, Area, Scatter, Pie and Doughnut. They share the
animation set, legend toggle, and context-menu categories; pie + bar also share
the same 1-D data model, while the line chart carries a 2-D dataset (see Model).

## Behaviour

- Any chart becomes any chart type from its menu's **Chart Type** section. Each is a row with a one-line blurb
  ("Proportions of a whole", "A trend over time") rather than a caption tile:
  the picture names the chart, not the job it does.
- A **Data** context-menu category edits the chart. Pie / bar edit inline: one
  row per datum: a recolourable swatch (opening the
  [colour picker](../004-interface-design/colour-picker.md) in a popover), a **label**, and a **value**, plus
  add / remove. The line chart's 2-D grid is too wide for the narrow menu, so
  the category instead **summarises the series** (a colour dot + name) and an
  **Edit Data** button opens a **modal** (`LineDataDialog`): a row per category,
  a column per series, add / remove either axis, and an **Import CSV** button
  (header row = series names, first column = category labels). The chart +
  legend redraw live from the data.
- Hovering a mark (slice / bar / line point) shows a readout with its label +
  value, regardless of the legend toggle.
- A **Chart** context-menu category holds display options: a **Legend**
  placement picker: **Off / Top / Left / Right / Below** (glyph-over-label
  tiles). Picking a side both turns the legend on and positions it (setting
  `chartLegend: true` and `chartLegendPosition`), while **Off** sets
  `chartLegend: false`. The default is **Below**: a side legend spends up to
  130px of a 280px-wide chart on series names, squeezing the plot into a third
  of the card, and it is the plot people are reading; a bottom band costs
  height, which these charts have more of to give. The resolved default applies
  to every chart that never picked a placement, which is the point of a default
  rather than a per-element field. The chart default sizes are squarer to match. The chart layout (`chartFrame`) reserves a
  vertical strip for a left/right legend or a horizontal band for a top/bottom
  one, and the chart body fills the remaining `area`; `ChartLegend` stacks in a
  column on the side, or wraps in a centred row on top/bottom. A name longer than the strip is cut with an
  ellipsis inside it, on the canvas and in an export alike, so a long name never runs past the chart.
- Under the placement tiles (while the legend is on), **Text Size** (the one
  [Text Size](../004-interface-design/fonts.md#text-size) slider, 6 to 48 px, without Scale) sets the
  key's row size. It writes the element's ordinary `textSize` (a chart has no label, so the Text
  flyout never offers it) and reads through `legendFontPx` (`label-font.ts`): a px is itself, and
  the presets earlier charts carry read 11 / 14 / 18px, with Medium the default. A key is not a name, so it has its own scale rather than
  the label one. An absent `textSize` reads as Medium.
- Under the legend, **Show Values** (`chartValues`, off by default, so a chart made before it draws as it did) prints
  each mark's number on the chart: above a column, after a bar, above each point of a line, area or scatter series, and
  inside a pie's or doughnut's wedge (as a percentage when the values add up to 100). A column chart with values also
  names each column under its baseline, so its legend can be turned off; a name wider than its column's share is cut
  with an ellipsis, and dropped when not one letter fits, so neighbours never overprint. Numbers read short from
  10,000 up: 120000 as 120k, 1500000 as 1.5M, at most one decimal, in the unit the rounded number reads in (999,960 is
  1M, not 1000k); under that in full (1,080). A small value that rounds to nothing reads 0, never -0. A wedge's number takes the ink that reads on its colour; the rest take the chart's text
  colour, at the key's size. The editor's toggle fires `Element·Changed·ChartValues`. It is a display option of the
  chart, so it follows the Chart category's gating: an Editor changes it; a Participant or Viewer sees the numbers.
- Under Show Values, **Show Axis** (`chartAxis`, off by default, so a chart made before it draws as it did) draws the
  value axis on a column, bar, line, area or scatter chart (a pie has none): tick labels at round values (1, 2 or 5
  times a power of ten, four or five of them, the range widened to the next round value past the largest and
  smallest, zero always in it) and a faint gridline across the plot at each, the plot drawn in from the side the
  labels take. A column or line chart labels its left side; a bar chart its bottom. Numbers read as Show Values'
  do (120k, 1.5M), with as many decimals as a step under one needs, so no two ticks read the same (0.02, 0.04). The
  toggle fires `Element·Changed·ChartAxis`; the gating is Show Values'.
- **A second axis**: a line, area or scatter series marked `axis: "right"` is drawn against a scale of its own,
  worked out from the right-hand series alone, so a series in the thousands and one in the tens both read (signups
  against paid). With Show Axis on, the right side carries that scale's tick labels in the chart's text colour,
  the plot's right edge drawn in the first right-hand series' colour so the two read as one (labels in a light
  series' colour were too faint to read); the gridlines follow the left scale. A chart whose series are all on the right draws them on the left
  scale, as if none were. In the editor, the Chart category of a line chart with two or more series has **Right
  Axis**, a choice of None or one series, which moves that series to the right (one commit, `Element·Changed·
ChartAxis`); a series on the right shows "(right)" after its name in the Data summary. An Editor changes it.
- The **Animation** category carries the chart-specific animations
  (None / Grow / Pop / Spin / Pulse, with a **Speed** row + **Repeat** toggle):
  a chart animates its marks, not the whole box. Grow / Pop play once (an entrance); Spin / Pulse loop.
- Mark colours default to the **theme's categorical palette** (`themeChartPalette`, `chart-categorical.ts`): the
  theme's own hues first, its lead always first, each stepped into the lightness band its surface reads in (OKLCH
  0.43 to 0.78 on a light page, 0.48 to 0.70 on a dark one) with a chroma of at least 0.10, then the reference
  categorical hues to fill out, kept only where neighbours stand at least 8 apart (ΔE) for a reader with protan or
  deutan colour vision and 15 for normal vision, and any two at least 14 apart on a light page, 9 on a dark one. Five
  to eight colours a theme; a test keeps every theme passing the dataviz validator's gates. On a filled page the colours are picked as they will be drawn there, after the 3:1 contrast step
  (`chartMarkInk`), so what is drawn is what passes. Overridable per datum. A column or bar chart takes the lead alone (How a chart is drawn).
- A chart drops at its own default (260 x 220; a line chart 300 x 240), which fits this canvas. (The products with slide and
  infographic pages size a chart dropped on one for the page,
  `../packages/element-model/src/chart-drop-size.ts`.)
- It's a normal boxed element otherwise (move / resize / select / lock),
  but the **Colours / Border** context-menu categories are hidden: a
  chart styles per-datum via its Data category, not as one filled box. Its
  **Presets** grid holds the chart palettes (see Chart palettes).

## Chart types

A **chart type** is how a chart draws its data, named as Google Sheets names it. Seven ship; each is a chart kind
(the stored `shape`) and, for all but the first of its kind, a `chartVariant`:

A chart is **named by its type** wherever the editor names an element: the selection badge says "Selected Column
Chart" and a screen reader hears "Column chart", as the palette's tile says, never the kind's "Bar Chart"
(`elementKindLabel`, `kindLabel`).

| Chart type | Kind (`shape`) | `chartVariant` | Draws                                                                                              |
| ---------- | -------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Column     | `bar-chart`    | (none)         | Upright bars from a zero baseline, one per datum; a negative one hangs below it                    |
| Bar        | `bar-chart`    | `horizontal`   | Bars to the right from a zero baseline, one per datum, top to bottom; a negative one to its left   |
| Line       | `line-chart`   | (none)         | A line with point markers per series                                                               |
| Area       | `line-chart`   | `area`         | Line's lines, each with the area between it and zero filled in its colour fading down, overlapping |
| Scatter    | `line-chart`   | `scatter`      | A point per category per series, no lines, at x = the category read as a number (below)            |
| Pie        | `pie-chart`    | (none)         | Wedges clockwise from twelve o'clock                                                               |
| Doughnut   | `pie-chart`    | `doughnut`     | Pie's wedges with the middle open: a ring whose hole is 60% of its radius                          |

- A chart with no `chartVariant`, or one its kind does not take, draws as its kind's first type, so every chart
  made before chart types draws as it did.
- **Below zero on a column or bar chart.** The value range runs from the smallest value or zero, whichever is less,
  to the largest or zero, whichever is more, and the baseline is drawn at zero: a column for a negative value hangs
  below it (a bar runs left of it), as standard charts draw them. Its value reads under the column's end (left of a
  bar's), and a column's name stays under the whole plot, never in among the hanging columns. Show Axis covers the
  negatives too: its ticks run from a round value under the smallest to one over the largest, zero always a tick.
  A chart with no negative value draws exactly as before (the baseline at the plot's foot). Only a pie reads below
  zero as zero. A value that is not a number draws as zero. A chart drawn from a Sheet takes its negative cells
  this way too. The chart's data rows take a negative value on a column or bar chart, the minus typed first or last, as Edit
  Data's grid does on a line chart; on a pie its values stop at zero. An agent's write keeps them the same way: a column or bar chart's value below zero is stored as written (and one
  already stored survives an agent's edit to the chart), a pie's is stored as zero.
- **Scatter's x**: when every category reads as a number (`12`, `-3.5`, `1,200`), each point sits at its number on
  an x-axis running from the least to the greatest (widened by 1 when they are all equal), labelled at five evenly
  spaced values; otherwise the categories are evenly spaced, as Line's are, and labelled as Line's. Its readout reads
  `x · series: y`.
- **The Chart Type section** opens first in the chart's Tools flyout, closed until opened (as every section is): a
  grid of seven tiles, each the type's glyph over its name, the chart's own type pressed. Hovering a tile previews
  nothing; picking one changes the chart, one undo step, `Element · Changed · ChartType`.
- **Changing type** keeps the chart's size, style, palette, legend and animation. Within a kind it only sets
  `chartVariant`. Across kinds it moves the data: a pie or bar chart's slices become one series named **Series 1**
  over their labels (their colours dropped, so the series takes the palette's first), and a line chart's first
  series becomes the slices over its categories (below zero read as zero on a pie). A chart drawn from a Sheet
  re-reads its range as the new type at once.
- Who may: as every other chart change, someone who may edit the canvas (an Editor); a Participant and a Viewer get
  no Chart Type section.

## How a chart is drawn

Every chart looks finished the moment it lands, on a slide, an infographic or a board, with no setting changed
(Work Tracker 1500). The look is a rendering rule, not stored data, so every chart, old or new, draws this way, on the
canvas and in every export alike (`../packages/element-model/src/chart-style.ts`, one copy for every product, as are
the views in `../packages/workbench/src/components/canvas/charts/`):

- **Chrome in the chart's own ink.** The baseline the marks grow from and Show Axis's gridlines are the chart's text
  colour, faded (35% and 12%), so they stay quiet on every theme and on a dark page, where fixed slate greys glared.
  A line, area or scatter chart has no vertical axis line; its baseline and gridlines carry it.
- **Text that grows with the chart.** Its Text Size is the size at the board default (a short side of 240 px), never
  a cap: a bigger chart scales the key, its numbers and its axis together by its short side over 240, eased (to the
  power 0.6), so a 1600 x 880 chart on a 1920 x 1080 slide draws a 31 px key, 26 px numbers and 24 px axis text at
  Medium, where it drew 14, 12 and 12. Axis and category text is a fifth under the key, never under 9 px. The key's
  strip and the axis's room grow with it (`chartTextScale`, `chartLegendPx`, `chartValuePx`, `chartTickPx`). A line
  chart keeps room at each end for half its end category's name, so "Jan" is never cut by the chart's edge.
- **Columns and bars** round their value end (a radius of 14% of the bar's thickness, at least 2 px, so a slide's
  wide bar is as round as a slim one, and never more than half its length) and keep their baseline end square, so
  every bar grows from the one baseline; a value below zero rounds its own end. Each is at most 48 px thick, or a
  sixth of the chart's short side on a larger chart, and two thirds of its slot.
- **A column or bar chart is one hue.** Its bars are one series, so they all wear the palette's lead colour and each
  is named on its axis, always, Show Axis or not: under a column, or left of a bar, right-aligned against the plot in
  a column up to 30% of the chart wide; a name cut to its room with an ellipsis. Its key, a second copy of those
  names, shows only when a bar wears a colour of its own (set per datum in Data), and then those colours lead.
  Rainbow bars said "these differ" of bars that differ only in height.
- **Lines** are smooth (a monotone curve, so a peak stays the peak and a flat run stays flat: the line never claims a
  value the data does not hold), from 2 px thick on a small chart to 3.5 px on a slide-sized one, with small beads at
  their points and a full dot at the end, where the latest value is. Hovering anywhere near a point reads it.
  **Show Values** on a line, area or scatter chart is thinned so no number overprints another: each series' end
  first, then its highest and lowest, then every other point that still fits, each kept inside the plot's ends.
- **Areas** fade from their line (32%) down to the baseline (3%), so the line leads and overlapping areas stay
  readable through each other.
- **Pies and doughnuts** set their wedges a clear gap apart (2% of the radius, 1 to 3.5 px) that the page shows
  through, light or dark, where a white outline glared on a dark page; a sliver too thin to give up the gap keeps its
  width. A doughnut's hole is 60% of its radius.
- **The key** marks each name with a round dot, as the Legend element does.
- **Colours that tell apart.** A pie, a doughnut and a chart of several series take a categorical palette made for
  the theme's surface (`../packages/element-model/src/chart-categorical.ts`, see Chart palettes), where the theme's
  near-twin tints sat about 5 apart (ΔE) and could not be told apart.

**Existing charts change look.** None of this is stored: a chart made before it draws this way too, the first time it
is opened or exported. A column chart that never set a colour turns one hue and shows its names on the axis instead
of a key; its Data and its settings are untouched, and a colour set per datum still wins.

## Model

Each chart is a `ShapeKind` (`'pie-chart'` / `'bar-chart'` / `'line-chart'`),
not a new top-level type, so they inherit boxed-element behaviour. `isChartShape`
groups all three (they're all in `isSelfDrawingShape` too).

- Pie + bar: `ShapeElement.pieSlices?: PieSlice[]` (`{ label, value, color? }`).
- `ShapeElement.chartValues?: boolean`: the numbers on the marks (Show Values); absent means off.
- `ShapeElement.chartAxis?: boolean`: the value axis, its tick labels and gridlines (Show Axis); absent means off.
  A `LineSeries` may carry `axis?: 'right'`, its own scale (a second axis); any other value reads as absent. The
  axes are laid out with the marks (`axisScale`, `axisLabelRoom`, `rightAxisSeries` in
  `../packages/element-model/src/chart-axis.ts`, read by `chart-marks.ts`) for both renderers.
- Line: `ShapeElement.lineCategories?: string[]` + `lineSeries?: LineSeries[]`
  (`{ name, color?, values: number[] }`), aligned to the categories: a 2-D
  dataset. `LINE_DEFAULT_CATEGORIES` / `LINE_DEFAULT_SERIES` seed a fresh chart.
- **Rows on the way in**: validation refuses a slice that is not `{ label, ... }`, a series that is
  not `{ name, values, ... }` and a category that is not text. A row that arrives malformed anyway
  (stored before, a peer's op, a file) is settled as it enters (`settleChartRows`): a slice or series
  that is not an object is dropped; a label, name or category that is not text reads as its number or flag written out, else as empty, and a series' values that are not a list as none, so categories keep their places.
- All three share `pieAnim?` / `pieAnimSpeed?` / `pieAnimRepeat?` / `chartLegend?` / `chartLegendPosition?` and
  `chartVariant?` (`'horizontal' | 'area' | 'scatter' | 'doughnut'`, Chart types above); `chartTypeOf(el)` and
  `chartShapeOf(type)` map between a chart and its type, `chartTypeChange(el, type)` gives the patch that changes it
  (`../packages/element-model/src/chart-types.ts`), and `pieMarks` / `barMarks` / `lineMarks`
  (`../packages/element-model/src/chart-marks.ts`) lay out every type's marks for both the canvas views and the exporter, so
  the two never draw a chart differently. An exported chart's (and Sankey's) text names the theme's font, else the
  export's sans default, never bare: a standalone viewer drew bare text in its serif default.
  The types + constants + `isPieShape` / `isBarShape` / `isLineShape` /
  `isChartShape` live in `@liveplanner/project` (`../packages/element-model/src/data-shapes.ts`).
- Rendered by `PieChartView` / `BarChartView` / `LineChartView`: SVG marks in the
  default palette or a per-mark colour, with a `ChartLegend`; the mark group
  carries the `lvd-pie-*` animation (CSS in `apps/editor/app/canvas-motion.css`,
  reduced-motion-safe), the axes / labels stay still. `element-variant.ts` gives
  them a borderless wrapper. The shared layout `chartFrame` lives in
  `../packages/element-model/src/chart-frame.ts` (re-exported from `apps/editor/lib/chart.ts`,
  which holds `chartAnim`); the frame, readout and legend are drawn by
  `ChartSurface`; hover wiring in `useChartHover` + `ChartReadout`.
- CSV import (line): `parseCsvLineData` in `apps/editor/lib/csv.ts` (quoted-field
  aware) turns a pasted/uploaded CSV into categories + series.
- Setters in `useChartSetters.ts`, exposed through `useElementStyle.ts`: `setPieDataSelected(slices)` (pie / bar),
  `setLineDataSelected(categories, series)` (line), + `setChartLegendSelected` /
  `setChartLegendPositionSelected` / `setPieAnim*Selected`, all gated to chart
  shapes.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `track('Element', 'Added', 'Pie-chart' | 'Bar-chart' |
'Line-chart')` on create, `track('Element', 'Changed', 'ChartData' | 'LineData'
| 'ChartAnim' | 'ChartLegend' | 'ChartType')` on edits.

Follows the composite-component pattern ([Timeline rail](timeline-rail.md)): a dedicated
`ShapeKind` + small `ShapeElement` fields + a bespoke `*View` + a borderless variant + a
context-menu category. New chart kinds reuse it under the same Data palette category.

## Charts drawn from a sheet

A chart may carry `chartSource` (a sheet and a range of it): its data is then read live from that Sheet's cells and
the element's own data is the last read ([Sheet charts](../029-sheets/sheet.md#charts)). Its Data menu offers
**Unlink From Sheet** in place of the data editor. A Scatter chart from a Sheet whose first column holds numbers (so
the read numbers its categories `1, 2, …` and makes that column a series) takes that column as its x and the other
columns as its series, as a spreadsheet's scatter chart does.

## Chart palettes

Without a chart-level palette, saying "this chart is greys" would mean opening
the data editor and setting a colour on every row by hand, and a row added later
would still come out in the theme's colours.

`chartPalette` (a `ChartPaletteId` from `../packages/element-model/src/chart-palettes.ts`)
slots in as the middle rung: **per-datum colour > the chart's palette > the tab
theme's > the built-in ramp**. Stored as an id, so it keeps applying as the data
grows, and it never touches the data, so a slice somebody coloured on purpose
keeps its colour.

Eight ship, eight colours each: **Vivid** (the built-in ramp, named so it can be
picked deliberately rather than only landed on), **Ocean**, **Forest**,
**Sunset**, **Berry**, **Earth**, **Grey** (for print, and for a chart whose
point is the shape of the data), **Contrast** (maximally separated hues, for the
chart read from the back of a room). A palette's first two colours, the two largest slices or the first two series, stay plainly apart (a
CIELAB ΔE of 15 or more), so even Forest's dark run starts green-900 then green-700.

They are the chart's **Presets** grid ([Style presets](../010-palette/style-presets.md)): a chart styles per slice from
its Data category, so a "look" for it is the ramp, not a fill and a border. The
grid's reset clears the palette, which is the one preset grid with something
real to reset to: following the theme again.

## Legend

A `legend` shape: a card of colour-coded rows, a dot and a label each, in the
**Data** palette category. It is a KEY, not a chart, so it carries no values and
no geometry to argue about, and nothing on it is clickable: the colours and the
words are edited from the menu's **Legend** section, where every other data
shape's rows are edited.

`legendItems` is `{ label, color? }[]`, bounded in `validate.ts`. The colour is
**optional** and falls back to the chart palette by index, which is what makes a
legend dropped beside a chart already match it: first row, first slice. A row
added from the menu is created with no colour for the same reason, so it picks up
the next colour rather than leaving a blank swatch to go and fill in. Setting a
legend's own `chartPalette` re-colours every uncoloured row, so a legend and a
chart set to the same palette stay in step. It is set from the **Palette** tiles at
the foot of the Legend section (the same eight as a chart's Presets, with a reset
back to the theme's ramp); the legend's Presets grid keeps the card looks, which
colour the card itself.

The **Legend** section also carries **Text Size** (the same slider, without Scale), on
the same `legendFontPx` scale as a chart's key, so a Legend beside a chart can
match it. The dot and row pitch scale with it.

Self-drawing (`isSelfDrawingShape`), so no centred label editing, and its wrapper
paints no box; `LegendView` draws the card from the element's fill + stroke, and
`svgLegendShape` draws the same thing for exports and thumbnails.

## The Chart Data and Legend dialogs

A pie, column or bar chart's rows are edited in the **Chart Data** dialog, not in the menu: the Data category
lists each row's colour, label and value and has **Edit Data**, which opens it (a line chart's Edit Data opens its
grid, as before). Per row the dialog has the colour, the label, the value and a remove button, then Add Slice.

A legend's rows are edited in the **Legend** dialog, opened by the menu's **Legend** row: a colour, a word and a
remove button per row, then Add Row. Its text size and palette stay in the menu's **Legend Style** category.

Both are centred modals, bottom sheets on a phone, under the dialog hero header; each change saves as it is made,
and rows slide in and out ([Motion](../004-interface-design/motion.md) "Rows that come and go").
