import {
  addTableColumn,
  addTableRow,
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_MAX_TEXT,
  clampPercent,
  clampRating,
  CODE_MAX_LENGTH,
  isChartShape,
  isProgressShape,
  RAIL_DEFAULT_POINTS,
  RAIL_MAX_POINTS,
  RAIL_MIN_POINTS,
  RAIL_POINT_STEP_PX,
  type AnimationSpeed,
  type ChartLegendPosition,
  type ChecklistItem,
  type CodeLanguage,
  type Element,
  type LineSeries,
  type PieAnim,
  type PieSlice,
  type ProgressAnim,
  type RatingAnim,
  type ShapeElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type DataShapeSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
};

// The selection-wide setters for the data-bearing shapes: progress bars,
// timeline rails, ratings, and pie / bar / line charts (values + per-kind
// looping animation + chart legend). Each kind has a private field setter the
// public ones delegate to; all resolve the selection and commit through the
// two shared handles, so they live together off useElementStyle.
export function useDataShapeSetters({ currentSelectionIds, commit }: DataShapeSetterDeps) {
  // Progress elements (spec/46): the percentage + how its fill animates, all
  // gated to progress shapes. The four setters differ only in the patched
  // field + telemetry type, so they share one body.
  const setProgressFieldSelected = (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && isProgressShape(el.shape)
          ? { ...el, ...patch }
          : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
  const setProgressSelected = (value: number) =>
    setProgressFieldSelected({ progress: clampPercent(value) }, 'Progress');
  const setProgressAnimSelected = (value: ProgressAnim | null) =>
    setProgressFieldSelected({ progressAnim: value ?? undefined }, 'ProgressAnim');
  const setProgressAnimSpeedSelected = (value: AnimationSpeed) =>
    setProgressFieldSelected({ progressAnimSpeed: value }, 'ProgressAnim');
  const setProgressAnimRepeatSelected = (value: boolean) =>
    setProgressFieldSelected({ progressAnimRepeat: value }, 'ProgressAnim');

  // Timeline rail (spec/51). Setting the point count also resizes the element
  // so the per-point spacing stays constant (count × step), keeping the rail
  // neat as points are added / removed. Applies to selected rail shapes.
  const setRailCountSelected = (count: number) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const n = Math.max(RAIL_MIN_POINTS, Math.min(RAIL_MAX_POINTS, Math.round(count)));
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'timeline-rail'
          ? { ...el, railCount: n, width: n * RAIL_POINT_STEP_PX }
          : el,
      ),
    );
    track('Element', 'Changed', 'TimelineRail');
  };
  // Append a point to each selected rail (the canvas "+" affordance), capped at
  // RAIL_MAX_POINTS; widens each by one step so spacing holds.
  const addRailPointSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'shape' && el.shape === 'timeline-rail')) return el;
        const n = Math.min(RAIL_MAX_POINTS, (el.railCount ?? RAIL_DEFAULT_POINTS) + 1);
        return { ...el, railCount: n, width: n * RAIL_POINT_STEP_PX };
      }),
    );
    track('Element', 'Changed', 'TimelineRail');
  };

  // Append a row / column to each selected table — the table quick-connect
  // ring's structural adds (spec/09). The helper returns the spliced cells
  // PLUS the realigned side arrays; apply them together so pinned sizes and
  // per-cell styles can't drift onto the wrong track.
  const appendTableRowSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    track('Element', 'Added', 'TableRow');
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'table')) return el;
        const next = addTableRow(el, el.cells.length);
        return {
          ...el,
          cells: next.cells,
          ...(next.rowHeights ? { rowHeights: next.rowHeights } : {}),
          ...(next.cellStyles ? { cellStyles: next.cellStyles } : {}),
        };
      }),
    );
  };
  const appendTableColumnSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    track('Element', 'Added', 'TableColumn');
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'table')) return el;
        const next = addTableColumn(el, el.cells[0]?.length ?? 0);
        return {
          ...el,
          cells: next.cells,
          ...(next.colWidths ? { colWidths: next.colWidths } : {}),
          ...(next.cellStyles ? { cellStyles: next.cellStyles } : {}),
        };
      }),
    );
  };
  // Edit one rail point's label (spec/51). Keyed by element id (the inline
  // editor lives on the element itself), committed on blur so it's one undo
  // step. Grows the labels array as needed; trailing empties are harmless.
  const setRailLabelSelected = (elementId: string, index: number, text: string) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || el.type !== 'shape' || el.shape !== 'timeline-rail') return el;
        const labels = [...(el.railLabels ?? [])];
        while (labels.length <= index) labels.push('');
        labels[index] = text;
        return { ...el, railLabels: labels };
      }),
    );
    track('Element', 'Changed', 'TimelineRail');
  };

  // Code block (spec/82): replace the snippet + language together (the edit
  // dialog commits once on Save — one undo step), gated to code-block shapes.
  const setCodeSelected = (code: string, language: CodeLanguage) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'code-block'
          ? { ...el, code: code.slice(0, CODE_MAX_LENGTH), codeLanguage: language }
          : el,
      ),
    );
    track('Element', 'Changed', 'CodeBlock');
  };

  // Checklist (spec/83). The on-canvas checkbox toggles one row by element
  // id (like the rail's inline label editor); the context-menu section
  // replaces the whole rows array (add / remove / retitle).
  const toggleChecklistItem = (elementId: string, index: number) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || el.type !== 'shape' || el.shape !== 'checklist') return el;
        const items = (el.checklistItems ?? []).map((item, i) =>
          i === index ? { ...item, done: !item.done } : item,
        );
        return { ...el, checklistItems: items };
      }),
    );
    // Box ticks deliberately don't track: high-frequency, low-signal,
    // matching spec/39's vote-cast precedent.
  };
  const setChecklistItemsSelected = (items: ChecklistItem[]) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const bounded = items
      .slice(0, CHECKLIST_MAX_ITEMS)
      .map((i) => ({ text: i.text.slice(0, CHECKLIST_MAX_TEXT), done: i.done }));
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'checklist'
          ? { ...el, checklistItems: bounded }
          : el,
      ),
    );
    track('Element', 'Changed', 'Checklist');
  };

  // Rating (spec/52): the star score + its optional animation, gated to rating
  // shapes. The setters share one body (differing only in the patched field +
  // telemetry type), mirroring the progress setters.
  const setRatingFieldSelected = (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'rating' ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
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
  const setPieFieldSelected = (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && isChartShape(el.shape) ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
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
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setRailCountSelected,
    addRailPointSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setRailLabelSelected,
    setCodeSelected,
    toggleChecklistItem,
    setChecklistItemsSelected,
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
