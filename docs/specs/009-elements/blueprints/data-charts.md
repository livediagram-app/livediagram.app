# Data charts (pie, bar, line) and the legend: blueprint

Derived from [Data charts (pie + bar + line)](../pie-chart.md). The spec decides; this file only
adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                      | Role                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/data-shapes.ts`                                                    | `PieSlice`, `PieAnim`, `PIE_ANIMS`, `PIE_LOOPING_ANIMS`, `PIE_PALETTE`, `PIE_DEFAULT_SLICES`, `LineSeries`, `LINE_DEFAULT_*`, `LegendItem`, `LEGEND_*`, the kind guards |
| `packages/document/src/element-types.ts`                                                  | `ChartLegendPosition` and the chart / legend fields on `ShapeElement`                                                                                                   |
| `packages/document/src/chart-frame.ts`                                                    | `chartFrame`: colours, data, legend strip, plot `area`                                                                                                                  |
| `packages/document/src/chart-palettes.ts`                                                 | `ChartPaletteId`, `CHART_PALETTES`, `chartPaletteColors`, `isChartPaletteId`                                                                                            |
| `packages/document/src/theme-presets.ts`                                                  | `themeChartPalette`: the tab theme's categorical ramp                                                                                                                   |
| `packages/document/src/label-font.ts`                                                     | `LEGEND_FONT_PX`, `legendFontPx`                                                                                                                                        |
| `packages/document/src/svg-render-charts.ts`                                              | `svgPieChart`, `svgBarChart`, `svgLineChart`                                                                                                                            |
| `packages/document/src/svg-render-shapes.ts`                                              | `svgLegendShape`                                                                                                                                                        |
| `packages/document/src/svg-render.ts`                                                     | Export: resolves the chart palette per tab, routes the legend                                                                                                           |
| `packages/document/src/validate.ts`                                                       | `SHAPE_KINDS`, array bounds, `chartPalette`, `legendItems` checks                                                                                                       |
| `apps/live/lib/chart.ts`                                                                  | `chartAnim`; re-exports `chartFrame`                                                                                                                                    |
| `apps/live/lib/csv.ts`                                                                    | `parseCsvLineData`                                                                                                                                                      |
| `apps/live/components/canvas/PieChartView.tsx`, `BarChartView.tsx`, `LineChartView.tsx`   | Canvas marks                                                                                                                                                            |
| `apps/live/components/canvas/LegendView.tsx`                                              | Canvas legend element                                                                                                                                                   |
| `apps/live/components/primitives/ChartSurface.tsx`, `ChartLegend.tsx`, `ChartReadout.tsx` | Frame, key, readout                                                                                                                                                     |
| `apps/live/hooks/canvas/useChartHover.ts`                                                 | Hover key per mark                                                                                                                                                      |
| `apps/live/components/dialogs/LineDataDialog.tsx`                                         | The line data grid modal and CSV import                                                                                                                                 |
| `apps/live/components/palette/ElementDataSections.tsx`                                    | Data, Legend and Chart sections; the chart Animation tiles                                                                                                              |
| `apps/live/components/palette/context-menu-data-editors.tsx`                              | `PieDataEditor`, `LineDataSummary`, `LegendDataEditor`                                                                                                                  |
| `apps/live/components/palette/context-menu-tiles.tsx`                                     | `LegendPositionTiles`                                                                                                                                                   |
| `apps/live/components/palette/TypographySections.tsx`                                     | `LegendTextSize`                                                                                                                                                        |
| `apps/live/components/palette/PresetSections.tsx`, `StylePresets.tsx`                     | `ChartPalettePresetsSection`, `ChartPalettePresets`                                                                                                                     |
| `apps/live/lib/style-presets.ts`                                                          | `applyChartPaletteToEl`                                                                                                                                                 |
| `apps/live/hooks/canvas/useChartSetters.ts`                                               | Data, legend and animation setters                                                                                                                                      |
| `apps/live/hooks/canvas/useStylePreview.ts`                                               | `previewChartPalette` / `commitChartPalette`                                                                                                                            |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`                                           | `setLegendItemsSelected`                                                                                                                                                |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                                        | Passes `themeChartPalette(getTheme(activeTab.theme))` to the canvas                                                                                                     |

## Domain and naming

| Term             | Identifier                                              | Meaning                                                  |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Chart            | `isChartShape(kind)`                                    | `'pie-chart' \| 'bar-chart' \| 'line-chart'`             |
| Datum (1-D)      | `PieSlice = { label, value, color? }` in `pieSlices`    | One slice or bar                                         |
| Category         | `lineCategories: string[]`                              | One x-axis position of a line chart                      |
| Series           | `LineSeries = { name, color?, values }` in `lineSeries` | One line, a value per category                           |
| Chart animation  | `pieAnim: PieAnim`                                      | `'grow' \| 'pop' \| 'spin' \| 'pulse'` on the mark group |
| Key              | `chartLegend`, `chartLegendPosition`                    | The chart's own legend strip (on unless `false`)         |
| Chart palette    | `chartPalette: ChartPaletteId`                          | A stored ramp id, the middle colour rung                 |
| Theme ramp       | `themeChartPalette(theme)`                              | Categorical colours derived from the tab theme           |
| Built-in ramp    | `PIE_PALETTE` (= the `vivid` palette)                   | The last colour rung                                     |
| Legend (element) | `ShapeKind` `'legend'`, `isLegendShape`, `legendItems`  | A standalone key card; not a chart                       |
| Legend row       | `LegendItem = { label, color? }`                        | One dot and one label                                    |
| Key text size    | `textSize` read through `legendFontPx`                  | 11 / 14 / 18 px                                          |
| Readout          | `ChartReadout`                                          | The hovered mark's `label: value` box                    |

Banned synonyms: "series" for a pie datum (say datum or slice), "legend" for the chart's strip in
code comments where the element is meant (say key vs legend element), "colour scheme" for a chart
palette (that is the code block's term), "tooltip" for the readout (a tooltip names a
control).

## Behaviour and state

### Create

- Pie and bar seed `pieSlices` from `PIE_DEFAULT_SLICES` (A 40, B 30, C 20); size 260 × 220.
- Line seeds `LINE_DEFAULT_CATEGORIES` (`Jan`..`Apr`) and `LINE_DEFAULT_SERIES` (two series);
  size 300 × 240.
- Legend seeds `LEGEND_DEFAULT_ITEMS` (First, Second, Third, no colours); size 180 × 132.
- Palette tiles in the Data category: `data:pie`, `data:bar`, `data:line`, `data:legend`, each a
  row with a blurb.

### Colour ladder

For datum `i` with optional `color`:
`color ?? (chartPaletteColors(chartPalette) ?? (themeRamp non-empty ? themeRamp : PIE_PALETTE))[i % n]`.
On the canvas `themeRamp = themeChartPalette(getTheme(activeTab.theme))`; in the export it is
`themeChartPalette(getBuiltInTheme(tab.theme, surface))` [GE3]. `themeChartPalette` emits each
palette entry's stroke, then accent tints and shades, then the text colour, deduplicated; it is
never empty.

Legend element ladder: `item.color ?? (chartPaletteColors(chartPalette) ?? PIE_PALETTE)[i % n]`;
the theme ramp is not consulted [QE3].

### Layout (`chartFrame`)

1. `w = max(1, width)`, `h = max(1, height)`; `data = pieSlices` when non-empty, else
   `PIE_DEFAULT_SLICES` (`D101`).
2. `pos = chartLegendPosition ?? 'bottom'`; `showLegend = chartLegend !== false`.
3. Left / right: strip width `min(w * 0.4, 130)`; top / bottom: band height `min(h * 0.32, 72)`;
   zero when hidden.
4. `area` is the remaining rect; `legend` is the strip, with `show` and `pos`.
5. `ChartLegend` renders nothing when the strip is under 48 px wide (side) or 18 px tall (band)
   (D107);
   side legends stack in a column, bands wrap in a centred row; swatch `round(fontPx * 0.8)`.

### Marks

- **Pie**: total of `max(0, value)`, or 1 when that is 0; radius `max(10, min(area) * 0.86 / 2)`;
  wedges clockwise from twelve o'clock with a 1 px white separator; a datum at 99.9 % or more
  draws a full circle.
- **Bar**: max of `max(0, value)` (or 1); side padding `min(20, area.w * 0.08)`; baseline at
  88 % of the area; slot width `innerW / n`, bar width `min(slot * 0.7, 48)`, corner radius
  `min(3, barW / 4)`; a slate-300 baseline.
- **Line**: categories and series fall back to the defaults when empty; the value range always
  includes 0 (an all-equal range widens by 1); each series a polyline with point markers;
  readouts read `category · series: value` (D106).
- The mark group carries `chartAnim(element, origin)`: pie origin its centre, bar the baseline
  centre. Axes, labels and the key stay still.

### Loop rule

`animLoops(pieAnim, pieAnimRepeat, PIE_LOOPING_ANIMS)`, `PIE_LOOPING_ANIMS = ['spin', 'pulse']`:
grow and pop play once, spin and pulse loop.

### Hover

`useChartHover` keys a pie or bar mark by index and a line point by `{ s, i }`; each mark enables
its own pointer events; the SVG stays `pointer-events-none` so drags reach the element.
`ChartReadout` shows `label: value` (a blank label shows a dash glyph) anchored above the mark,
independent of the key (D106).

### Edit

1. Tools flyout, **Data** section: pie and bar use `PieDataEditor` (swatch, label, value per row;
   `+ Add slice` appends `{ label: 'Item n', value: 10 }`; remove disabled at one row, `D102`);
   line uses `LineDataSummary` and an **Edit data** button opening `LineDataDialog`.
2. `LineDataDialog`: a row per category, a column per series, add and remove on both axes (never
   below one), **Import CSV** (`parseCsvLineData`), committing the whole dataset on each blur or
   structural change.
3. Tools flyout, **Chart** section: `LegendPositionTiles` (Off / Top / Left / Right / Below), then
   `LegendTextSize` while the key is on.
4. Animation section: `PieAnimTiles` replaces the boxed set.
5. Style band: Colours and Border are hidden; **Presets** shows `ChartPalettePresets` (eight
   tiles, hover previews, click commits `'ChartPalette'`) and a Reset that clears `chartPalette`
   [GE1].
6. Legend element, Tools flyout, **Legend** section: `LegendDataEditor` (rows) and
   `LegendTextSize`.

### Setters (`useChartSetters`, `makeShapePatcher({ matches: isChartShape })`)

| Setter                                    | Patch                                           | Telemetry     |
| ----------------------------------------- | ----------------------------------------------- | ------------- |
| `setPieDataSelected(slices)`              | `{ pieSlices }`                                 | `ChartData`   |
| `setLineDataSelected(categories, series)` | `{ lineCategories, lineSeries }`                | `LineData`    |
| `setPieAnimSelected(v)`                   | `{ pieAnim: v ?? undefined }`                   | `ChartAnim`   |
| `setPieAnimSpeedSelected(v)`              | `{ pieAnimSpeed }`                              | `ChartAnim`   |
| `setPieAnimRepeatSelected(v)`             | `{ pieAnimRepeat }`                             | `ChartAnim`   |
| `setChartLegendSelected(v)`               | `{ chartLegend: v }`                            | `ChartLegend` |
| `setChartLegendPositionSelected(p)`       | `{ chartLegend: true, chartLegendPosition: p }` | `ChartLegend` |
| `setLegendItemsSelected(items)` (legend)  | `{ legendItems }` capped to 40 rows, 120 chars  | `Legend`      |

The data setters match every chart kind, so a mixed pie and line selection writes both field sets
onto both [GE2].

## Interfaces and contracts

```ts
export type PieSlice = { label: string; value: number; color?: string };
export type PieAnim = 'grow' | 'pop' | 'spin' | 'pulse';
export type LineSeries = { name: string; color?: string; values: number[] };
export type LegendItem = { label: string; color?: string };
export type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'left';
export type ChartPaletteId =
  'vivid' | 'ocean' | 'forest' | 'sunset' | 'berry' | 'earth' | 'grey' | 'contrast';
export function chartFrame(
  element: ShapeElement,
  palette?: readonly string[],
): {
  w: number;
  h: number;
  data: readonly PieSlice[];
  showLegend: boolean;
  colorAt: (i: number, d: { color?: string }) => string;
  area: ChartRect;
  legend: ChartLegendRect;
};
export function chartPaletteColors(id: string | undefined): readonly string[] | undefined;
export function themeChartPalette(theme: ThemeDefinition): string[];
export function legendFontPx(textSize: TextSize | undefined): number;
export function parseCsvLineData(
  text: string,
): { categories: string[]; series: LineSeries[] } | null;
```

Validation (`isValidElement`): `pieSlices`, `lineCategories`, `lineSeries` bounded to
`MAX_DATA_ARRAY` entries; `chartPalette` must pass `isChartPaletteId`; `legendItems` bounded to
`LEGEND_MAX_ITEMS`, each `label` a string of at most `LEGEND_MAX_TEXT`, `color` a string when
present. Datum shapes, series values, `pieAnim*` and `chartLegendPosition` are not checked [GE5].

CSV contract: header row = category column label plus series names (blank names become
`Series n`); each later non-blank row = category label (blank becomes `#n`) plus values;
non-finite values become 0; at most 12 series and 200 categories; fewer than two rows or no
data rows → `null`.

## Data and persistence

| Field                                      | Class     | Absent means                   |
| ------------------------------------------ | --------- | ------------------------------ |
| `pieSlices`                                | persisted | `PIE_DEFAULT_SLICES` at render |
| `lineCategories`, `lineSeries`             | persisted | the line defaults at render    |
| `pieAnim`, `pieAnimSpeed`, `pieAnimRepeat` | persisted | static / `'slow'` / loop rule  |
| `chartLegend`, `chartLegendPosition`       | persisted | shown / `'bottom'`             |
| `chartPalette`                             | persisted | follow the tab theme           |
| `textSize`                                 | persisted | `'md'` (14 px key)             |
| `legendItems`                              | persisted | no rows                        |
| colour ramps, layout rects                 | derived   | recomputed per render          |

Field names keep the `pie*` prefix across all three charts so saved documents need no migration.
Palette ids are permanent; names may change.

## Errors and edge cases

| #   | Case                           | Handling                                                     |
| --- | ------------------------------ | ------------------------------------------------------------ |
| E1  | Empty `pieSlices`              | Sample data renders (`D101`)                                 |
| E2  | Negative value                 | Treated as 0 for size; the readout shows the stored value    |
| E3  | All values 0                   | Divisor 1: nothing drawn, the key still lists the rows       |
| E4  | One datum at 100 %             | Full circle, readout anchored at the top                     |
| E5  | Non-numeric value from the api | NaN geometry [GE5]                                           |
| E6  | Unknown `chartPalette`         | Rejected on write; at render falls through to the theme ramp |
| E7  | Key strip too small            | Key not rendered                                             |
| E8  | CSV with no usable rows        | `null`; the dialog does nothing and says nothing [GE9]       |
| E9  | Series shorter than categories | A missing value reads as 0 (`valAt`)                         |
| E10 | Custom tab theme in an export  | Export ramp from `getBuiltInTheme`, default scheme [GE3]     |

## Security and trust

Chart data arrives through the api or the MCP server and is length-bounded by `validate.ts`.
Labels are rendered as React text on the canvas and `xmlEscape`d in the export. Colours are
written into `fill` attributes and inline styles; an invalid colour string is ignored by SVG and
CSS. CSV import runs locally on a user-picked file; nothing is uploaded.

## Performance and limits

Worst case `MAX_DATA_ARRAY` (5 000) data per array: one path or rect per datum, one key row per
datum (clipped by `overflow-hidden`). CSV caps keep an import at 12 × 200. The layout is a pure
function per render; hover state is per view.

## Presentation and UX

- Defaults: key Below, Medium text, sample data, theme colours.
- Key rows show the label, or a dash glyph when blank; readouts `label: value`.
- The legend element card paints from the element's fill and stroke with rows of dot and label.
- No loading or error states; the CSV failure path is silent [GE9].

## Accessibility

- Reduced motion: `lvd-pie-*` classes are `animation: none`.
- Chart SVGs, the key and the readout are `aria-hidden`; values are reachable by pointer hover
  only. There is no text alternative for screen readers or keyboard users [GE10].
- The CSV import is a `label` wrapping a hidden file input, not keyboard-focusable [GE9].
- Palette colours are not contrast-checked against the card; the key text uses the element text
  colour.

## Web experience

Canvas-space only: no CLS. Data edits commit on blur, not per keystroke (INP). The line dialog
is lazy-loaded through `EditorElementDialogs` like the other element dialogs.

## Observability

Telemetry: `track('Element', 'Added', 'Pie-chart' | 'Bar-chart' | 'Line-chart' | 'Legend')` on
create; `track('Element', 'Changed', 'ChartData' | 'LineData' | 'ChartAnim' | 'ChartLegend' |
'ChartPalette' | 'Legend')` on edits. No log fingerprints; the CSV rejection and the value
fallbacks are silent [GE12].

## Testing

| Rule                                             | Test                                                             | File                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| `isChartShape` is the three kinds                | is exactly the three chart kinds                                 | `packages/document/src/data-shapes.test.ts`         |
| Key Below by default, side strip, hidden         | chartFrame layout cases (seven)                                  | `apps/live/lib/chart.test.ts`                       |
| Per-datum colour, else cycle the palette         | prefers an explicit slice colour, else cycles the palette        | `apps/live/lib/chart.test.ts`                       |
| Empty data falls back to samples                 | falls back to the default slices when the element has none       | `apps/live/lib/chart.test.ts`                       |
| Palettes: eight colours, unique, resolvable      | chart palettes cases                                             | `packages/document/src/chart-palettes.test.ts`      |
| Preset writes only the palette                   | sets the palette on a chart without touching its data            | `apps/live/lib/style-presets.test.ts`               |
| Key sizes 11 / 14 / 18, export parity            | legendFontPx cases                                               | `packages/document/src/label-font.test.ts`          |
| CSV parsing                                      | parseCsvLineData cases                                           | `apps/live/lib/csv.test.ts`                         |
| Data / anim / legend setters                     | pie chart setter cases                                           | `apps/live/hooks/canvas/useElementStyle.test.ts`    |
| Export draws charts unframed                     | leaves a chart unframed; draws more than a box                   | `packages/document/src/export-consistency.test.ts`  |
| Every kind renders without NaN                   | never emits NaN or undefined                                     | `packages/document/src/svg-render-coverage.test.ts` |
| Ladder: datum > chart palette > theme > built-in | partial (`chartFrame` only); none for `themeChartPalette` [GE11] |                                                     |
| Reset clears the palette                         | none [GE1]                                                       |                                                     |
| Legend matches an adjacent chart                 | none [QE3]                                                       |                                                     |
| Grow / pop once, spin / pulse loop               | none [GE11]                                                      |                                                     |
| Readout on hover regardless of the key           | none [GE11]                                                      |                                                     |

## Constants and configuration

| Name                                   | Value                                                 | Provenance / safe range              |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| `PIE_PALETTE`                          | 8 colours, `#0ea5e9` first                            | Built-in ramp; equals `vivid`        |
| `CHART_PALETTES`                       | 8 palettes × 8 colours                                | Spec                                 |
| `PIE_DEFAULT_SLICES`                   | A 40, B 30, C 20                                      | Sample data                          |
| `LINE_DEFAULT_CATEGORIES`              | Jan, Feb, Mar, Apr                                    | Sample data                          |
| `LEGEND_FONT_PX`                       | sm 11, md 14, lg 18, scale 14                         | Spec                                 |
| `LEGEND_MAX_ITEMS` / `LEGEND_MAX_TEXT` | 40 / 120                                              | Bounds; `validate.ts` and the setter |
| `MAX_DATA_ARRAY`                       | 5 000                                                 | `validate.ts` bound                  |
| Side key strip                         | `min(w * 0.4, 130)` px                                | Spec "up to 130 px"                  |
| Key band                               | `min(h * 0.32, 72)` px                                | `chartFrame`                         |
| Key render floor                       | 48 px wide / 18 px tall                               | `ChartLegend`                        |
| CSV caps                               | `MAX_SERIES` 12, `MAX_CATEGORIES` 200                 | `csv.ts` soft caps                   |
| Sizes                                  | pie / bar 260 × 220, line 300 × 240, legend 180 × 132 | `SHAPE_DEFAULT_SIZE`                 |
| Keyframe base durations                | grow 0.6 s, pop 0.5 s, spin 6 s, pulse 1.6 s          | `canvas-motion.css`                  |
