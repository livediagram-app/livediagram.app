# Data charts (pie + bar + line)

Data charts are elements whose marks are sized by value, in a categorical
palette, with an optional legend. The palette holds them in its own top-level **Data**
category ([Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)):
**Pie**, **Column**, and **Line**, built so more chart kinds slot in beside them. Each draws as one of seven
**chart types** (Chart types, below): Column, Bar, Line, Area, Scatter, Pie and Doughnut. They share the
animation set, legend toggle, and context-menu categories; pie + bar also share
the same 1-D data model, while the line chart carries a 2-D dataset (see Model).

## Behaviour

- Drag a **Pie**, **Column**, or **Line** chart in from the palette's **Data**
  category. It drops with sample data. (The Column tile makes the
  `bar-chart` element, named as Google Sheets and Excel name a chart of upright bars.) Any of them then becomes any
  chart type from its menu's **Chart Type** section. Each is a row with a one-line blurb
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
  (None / Grow / Pop / Spin / Pulse, with a **Speed** row + **Repeat** toggle)
  in place of the boxed-element animation set: a chart animates its marks, not
  the whole box. Grow / Pop play once (an entrance); Spin / Pulse loop.
- Mark colours default to **variants of the active theme** (`themeChartPalette`:
  each branch hue on multi-colour themes, accent tints/shades on single-accent
  themes), overridable per datum. So a chart reads as part of the theme out of
  the box.
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

| Chart type | Kind (`shape`) | `chartVariant` | Draws                                                                                            |
| ---------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Column     | `bar-chart`    | (none)         | Upright bars from a zero baseline, one per datum; a negative one hangs below it                  |
| Bar        | `bar-chart`    | `horizontal`   | Bars to the right from a zero baseline, one per datum, top to bottom; a negative one to its left |
| Line       | `line-chart`   | (none)         | A line with point markers per series                                                             |
| Area       | `line-chart`   | `area`         | Line's lines, each with the area between it and zero filled in its colour at 25%, overlapping    |
| Scatter    | `line-chart`   | `scatter`      | A point per category per series, no lines, at x = the category read as a number (below)          |
| Pie        | `pie-chart`    | (none)         | Wedges clockwise from twelve o'clock                                                             |
| Doughnut   | `pie-chart`    | `doughnut`     | Pie's wedges with the middle open: a ring whose hole is 55% of its radius                        |

- A chart with no `chartVariant`, or one its kind does not take, draws as its kind's first type, so every chart
  made before chart types draws as it did.
- **Below zero on a column or bar chart.** The value range runs from the smallest value or zero, whichever is less,
  to the largest or zero, whichever is more, and the baseline is drawn at zero: a column for a negative value hangs
  below it (a bar runs left of it), as standard charts draw them. Its value reads under the column's end (left of a
  bar's), and a column's name stays under the whole plot, never in among the hanging columns. Show Axis covers the
  negatives too: its ticks run from a round value under the smallest to one over the largest, zero always a tick.
  A chart with no negative value draws exactly as before (the baseline at the plot's foot). Only a pie reads below
  zero as zero. A value that is not a number draws as zero.
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
  series becomes the slices over its categories (below zero read as zero on a pie).
- Who may: as every other chart change, someone who may edit the canvas (an Editor); a Participant and a Viewer get
  no Chart Type section.

## Model

Each chart is a `ShapeKind` (`'pie-chart'` / `'bar-chart'` / `'line-chart'`),
not a new top-level type, so they inherit boxed-element behaviour. `isChartShape`
groups all three (they're all in `isSelfDrawingShape` too).

- Pie + bar: `ShapeElement.pieSlices?: PieSlice[]` (`{ label, value, color? }`).
- `ShapeElement.chartValues?: boolean`: the numbers on the marks (Show Values); absent means off.
- `ShapeElement.chartAxis?: boolean`: the value axis, its tick labels and gridlines (Show Axis); absent means off.
  A `LineSeries` may carry `axis?: 'right'`, its own scale (a second axis); any other value reads as absent. The
  axes are laid out with the marks, in `chartValueAxis` (`packages/design/src/chart-axis.ts`) for both renderers.
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
  (`packages/design/src/chart-types.ts`), and `pieMarks` / `barMarks` / `lineMarks`
  (`packages/design/src/chart-marks.ts`) lay out every type's marks for both the canvas views and the exporter, so
  the two never draw a chart differently. An exported chart's (and Sankey's) text names the theme's font, else the
  export's sans default, never bare: a standalone viewer drew bare text in its serif default.
  The types + constants + `isPieShape` / `isBarShape` / `isLineShape` /
  `isChartShape` live in `@livedesign/design` (`src/data-shapes.ts`).
- Rendered by `PieChartView` / `BarChartView` / `LineChartView`: SVG marks in the
  default palette or a per-mark colour, with a `ChartLegend`; the mark group
  carries the `lvd-pie-*` animation (CSS in `apps/live/app/canvas-motion.css`,
  reduced-motion-safe), the axes / labels stay still. `element-variant.ts` gives
  them a borderless wrapper. The shared layout `chartFrame` lives in
  `packages/design/src/chart-frame.ts` (re-exported from `apps/live/lib/chart.ts`,
  which holds `chartAnim`); the frame, readout and legend are drawn by
  `ChartSurface`; hover wiring in `useChartHover` + `ChartReadout`.
- CSV import (line): `parseCsvLineData` in `apps/live/lib/csv.ts` (quoted-field
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

## Charts linked to a liveplanner sheet

A metric tree, a KPI board or a cost chart gets its numbers copied by hand from a spreadsheet, and goes stale the week
after it is made. A pie, bar or line chart can instead take its data from a range of a liveplanner Sheet and keep in
step with it (Work Tracker 1133). It stays a native chart: drawn in the design's theme, styled and exported like any other; only
its numbers come from the sheet. It works as livedocuments' linked charts do, from one copy of the editor's side in
`@liveworkspace/workbench` (`components/sheet-links/`); the platform's side (the range read, the door, the change
signal) is [liveworkspace sheet-sources.md](../../../../liveworkspace/docs/specs/004-index/sheet-sources.md).

- **Link to Sheet.** An Editor's chart Data section offers **Link to Sheet…** under its rows: a dialog to pick a plan
  (the person's liveplanner plans, most recent first, with a search), one of its Sheets, and a range typed as in a
  spreadsheet (`B2:E9`, prefilled with the sheet's filled extent). A preview shows what the chart will draw (its
  categories and the series it draws, or why it cannot: "That is not a range."). A pie, doughnut, column or bar draws the first series
  alone, so its preview shows that column and says the rest are left out ("A column chart draws the first series.");
  a line, area or scatter shows every series it draws (Work Tracker 1212). **Link** writes the read onto the chart (its
  slices, or its categories and series, keeping colours by position) with the source, as one undo step. The dialog
  notes that the values are saved in the design, so people who can't open the plan still see them.
- **The source** (`chartSheetSource`, `@liveworkspace/element-model/chart-sheet-source`) names the plan, the sheet and
  the range by stable row and column ids (so rows inserted inside it are read, and moves are followed), with the
  plan's and sheet's names, the range as A1 text and when it was last read (`readAt`).
- **Linked to.** A linked chart shows a quiet line below its bottom edge, left-aligned (sliding left to stay on screen near the window's right edge) and clear of the selection handles, while it is hovered or selected, at one
  size on screen whatever the zoom: a sheet glyph, then "Linked to <plan> · updated 2 min ago". The Sheet row in its
  Data section says the same, with the sheet and range under it ("Costs · B2:E9"), and offers an Editor **Update**
  (read again now), **Change…** and **Unlink**.
- **The first read waits for sign-in.** The first read of each range goes out once sign-in has answered and the
  design has loaded, and carries the design's grant, so it is read with the person's own access (never an
  anonymous read first) and the plan counts the design as watching from that first read: the first change to the
  sheet updates the chart (Work Tracker 1215). Meanwhile the saved values show; if sign-in has not answered
  within 10 seconds the line says "saved" as for a reader without access, and the read still goes once it does.
- **Keeping in step.** While the design is open, each linked chart on the open tab is read on open, on a tab change
  and whenever its sheet changes (the room's `source-changed` frame), never by polling. Each person reads with their
  own access:
  - who can open the plan sees the values it holds now; an Editor's editor also saves them on the chart, quietly (no
    undo step), so the saved values follow;
  - who cannot open the plan (or has lost access, or the plan or sheet was deleted) sees the values last saved on the
    chart, and the line says "saved 2 hours ago" with no Update;
  - when the read fails (offline, the plan's app down) the line says "Couldn't update" and Update tries again.
- **A design saved Offline** has no room, so no change signal reaches it: its linked charts are read on
  open, on a tab change and on Update, each with the person's own access, and draw the saved values when offline.
- **While linked**, the Sheet row takes the place of the slice and series rows ("These numbers come from the
  sheet."): the next read would overwrite a hand edit. Chart type, palette, legend, values, axis and animation stay the
  Editor's.
- **The range breaks** when a corner row or column is deleted: the chart keeps its values, and the line says "The
  linked range is gone" with **Change…** to pick it again. Update is not offered then: a read of a range that is gone
  is refused again (Work Tracker 1212).
- **Unlink** removes the source and keeps the last values, as one undo step.
- **Not linked yet.** A chart can be meant to come from a sheet before one is linked (`chartSheetPending`): a
  template's chart whose numbers belong in a sheet (livedocuments' Status Report, Work Tracker 1281). Until a sheet is
  linked it never passes its sample numbers off as real: its marks draw faded, under a centred chip, a sheet glyph and
  "Not linked to a sheet yet", on the canvas, in a thumbnail and in every export (SVG, PNG, PDF), whoever looks. The
  chip takes no pointer, so the chart selects and drags as any. Its Data section opens with "Sample numbers, meant to
  come from a sheet." and, for an Editor, **Link to Sheet** and **Use These Numbers** (they become the chart's own and
  the mark goes, one undo step). Linking drops the mark in the link's own undo step; Unlink never sets it again. A hand
  edit to the rows keeps it until Use These Numbers. The mark names no other item, so copies, exports and Community
  copies keep it. A Participant and a Viewer see the faded chart and its chip, never the actions.
- **Exports and copies.** An export (SVG, PNG, PDF, the design's file) draws the saved values and the file carries no
  source, as does a copy made through a Community link and a Community visitor's read. A duplicate, a copy-paste or a
  tab copied within livedesign keeps the source.
- **Who may.** Link to Sheet, Update, Change and Unlink are an Editor's (`can.level === 'edit'`, not read only). A
  Participant and a Viewer see the line and the live values on the terms above; they never write.
- **Telemetry.** `Element·Changed·ChartSheetLink` on Link, `Element·Changed·ChartSheetUnlink` on Unlink.

## Live data from a plan

A chart, and a table, can take its numbers from more of a liveplanner plan than a Sheet range (Work Tracker 1368): the
platform's [live-data.md](../../../../liveworkspace/docs/specs/004-index/live-data.md) sets the sources, the reads and
the bounds; this design's side is the shared workbench copy above.

- **From a Plan.** The Data section's **From a Plan…** (it was Link to Sheet) opens the dialog: a plan, then
  **Sheet Range**, **Board Counts** (cards per column, label, assignee or priority, filtered by priority, label,
  assignee and card type) or **Dashboard Metric**, a preview, and **Series** chips that say which of the read's series
  feed the element, in order.
- **The live mark.** A small live dot and, on hover or selection, "Live from <plan> · updated 2 min ago". The Data
  section adds **Open Plan** (the plan in liveplanner, in a new tab) and **Freeze**.
- **Freeze** keeps the numbers and stops reading ("Frozen · as of 12 Nov"); **Unfreeze** reads again. Both are one
  undo step.
- **Tables.** A table's Data section offers the same **From a Plan…**. Linked, its cells are the read (a header row,
  then a row per category), not typed into, and its look stays the Editor's; Unlink keeps the cells.
- **Readers without the plan** see the snapshot, never the live source; exports, thumbnails, Offline and Community
  copies draw the snapshot and carry no link.
- **Who may.** From a Plan, Update, Freeze, Unfreeze, Change and Unlink are an Editor's; a Participant and a Viewer see
  the mark and the numbers on their own access.
- **Telemetry.** `Element·Changed·ChartBoardLink`, `ChartMetricLink`, `TableLiveLink`, `LiveDataFreeze` and
  `LiveDataUnfreeze`, beside `ChartSheetLink` and `ChartSheetUnlink`.

## Chart palettes

Without a chart-level palette, saying "this chart is greys" would mean opening
the data editor and setting a colour on every row by hand, and a row added later
would still come out in the theme's colours.

`chartPalette` (a `ChartPaletteId` from `packages/design/src/chart-palettes.ts`)
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

## Element tour

The **Chart tour** is on the footer's Get Started button (**Start Chart Tour**) while an Editor has a data chart (any of the seven chart types) selected, on an unlocked element, and walks through it on the element
itself ([Element tours](../007-editor/element-tours.md) "The Chart tour").
