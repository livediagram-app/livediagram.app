import {
  chartTypeChange,
  clampRating,
  isChartShape,
  type ChartType,
  type AnimationSpeed,
  type ChartLegendPosition,
  type Element,
  type LineSeries,
  type PieAnim,
  type PieSlice,
  type RatingAnim,
} from '@livediagram/document';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';
import { track } from '@/lib/telemetry';

// THE DATA CATEGORY'S SETTERS: the star rating (docs/specs/009-elements/rating.md) and the charts
// (docs/specs/009-elements/pie-chart.md) — pie slices, line series, the legend and their animations.
//
// Split out of useDataShapeSetters, which is a catalogue of "change one field
// on the selected elements of kind X" and had grown to cover ten kinds. These
// are the ones whose field IS the data being visualised, rather than a label,
// a size or a mode.
//
// Every setter here is selection-wide and gated to its own shape kind, which is
// the invariant that matters: a multi-selection of a pie and a rating gets each
// change applied only to the elements it makes sense for.

export function useChartSetters({
  currentSelectionIds,
  commit,
}: {
  currentSelectionIds: () => ReadonlySet<string>;
  commit: (fn: (els: Element[]) => Element[]) => void;
}) {
  // Rating (docs/specs/009-elements/rating.md): the star score + its optional animation, gated to rating
  // shapes. The setters share one body (differing only in the patched field +
  // telemetry type), mirroring the progress setters.
  const setRatingFieldSelected = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: (kind) => kind === 'rating',
  });
  const setRatingSelected = (value: number) =>
    setRatingFieldSelected({ rating: clampRating(value) }, 'Rating');
  const setRatingAnimSelected = (value: RatingAnim | null) =>
    setRatingFieldSelected({ ratingAnim: value ?? undefined }, 'RatingAnim');
  const setRatingAnimSpeedSelected = (value: AnimationSpeed) =>
    setRatingFieldSelected({ ratingAnimSpeed: value }, 'RatingAnim');
  const setRatingAnimRepeatSelected = (value: boolean) =>
    setRatingFieldSelected({ ratingAnimRepeat: value }, 'RatingAnim');

  // Data charts (docs/specs/009-elements/pie-chart.md): the data + slice animation + legend toggle, gated to
  // chart shapes (pie + bar).
  const setPieFieldSelected = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: isChartShape,
  });
  // Replace the whole data array (the Data editor builds the next array from
  // the current one — add / remove / edit a row — and commits it).
  const setPieDataSelected = (slices: PieSlice[]) =>
    setPieFieldSelected({ pieSlices: slices }, 'ChartData');
  const setPieAnimSelected = (value: PieAnim | null) =>
    setPieFieldSelected({ pieAnim: value ?? undefined }, 'ChartAnim');
  const setPieAnimSpeedSelected = (value: AnimationSpeed) =>
    setPieFieldSelected({ pieAnimSpeed: value }, 'ChartAnim');
  const setPieAnimRepeatSelected = (value: boolean) =>
    setPieFieldSelected({ pieAnimRepeat: value }, 'ChartAnim');
  const setChartLegendSelected = (value: boolean) =>
    setPieFieldSelected({ chartLegend: value }, 'ChartLegend');
  // Show Values (docs/specs/009-elements/pie-chart.md): each mark's number on the chart.
  const setChartValuesSelected = (value: boolean) =>
    setPieFieldSelected({ chartValues: value }, 'ChartValues');
  // Legend placement (docs/specs/009-elements/pie-chart.md): picking a side also turns the legend on, so the
  // position tiles double as "on" while the Off tile uses setChartLegendSelected.
  const setChartLegendPositionSelected = (position: ChartLegendPosition) =>
    setPieFieldSelected({ chartLegend: true, chartLegendPosition: position }, 'ChartLegend');
  // Line chart (docs/specs/009-elements/pie-chart.md): replace the whole 2-D dataset (the grid editor / CSV
  // import builds the next categories + series and commits them together).
  const setLineDataSelected = (categories: string[], series: LineSeries[]) =>
    setPieFieldSelected({ lineCategories: categories, lineSeries: series }, 'LineData');
  // A chart drawn from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): Unlink keeps the data it last read
  // and makes it an ordinary chart, edited by hand.
  const unlinkChartSelected = () =>
    setPieFieldSelected({ chartSource: undefined, sheetAnchor: undefined }, 'ChartData');
  // Chart type (docs/specs/009-elements/pie-chart.md "Chart types"): each selected chart its own patch, since a
  // change across kinds moves that chart's own data. One commit, so one undo step, as the shape patcher's.
  const setChartTypeSelected = (type: ChartType) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || el.type !== 'shape') return el;
        const patch = chartTypeChange(el, type);
        return patch ? { ...el, ...patch } : el;
      }),
    );
    track('Element', 'Changed', 'ChartType');
  };
  return {
    setChartTypeSelected,
    unlinkChartSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartValuesSelected,
    setChartLegendPositionSelected,
    setLineDataSelected,
  };
}
