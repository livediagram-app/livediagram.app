import {
  clampRating,
  isChartShape,
  type AnimationSpeed,
  type ChartLegendPosition,
  type Element,
  type LineSeries,
  type PieAnim,
  type PieSlice,
  type RatingAnim,
} from '@livediagram/diagram';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';

// THE DATA CATEGORY'S SETTERS: the star rating (spec/52) and the charts
// (spec/53) — pie slices, line series, the legend and their animations.
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
  // Rating (spec/52): the star score + its optional animation, gated to rating
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

  // Data charts (spec/53): the data + slice animation + legend toggle, gated to
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
  // Legend placement (spec/53): picking a side also turns the legend on, so the
  // position tiles double as "on" while the Off tile uses setChartLegendSelected.
  const setChartLegendPositionSelected = (position: ChartLegendPosition) =>
    setPieFieldSelected({ chartLegend: true, chartLegendPosition: position }, 'ChartLegend');
  // Line chart (spec/53): replace the whole 2-D dataset (the grid editor / CSV
  // import builds the next categories + series and commits them together).
  const setLineDataSelected = (categories: string[], series: LineSeries[]) =>
    setPieFieldSelected({ lineCategories: categories, lineSeries: series }, 'LineData');
  return {
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartLegendPositionSelected,
    setLineDataSelected,
  };
}
