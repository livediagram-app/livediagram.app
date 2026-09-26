import {
  addTableColumn,
  addTableRow,
  CHECKLIST_MAX_ITEMS,
  isMindNode,
  mindRootOf,
  type MindFlow,
  LEGEND_MAX_ITEMS,
  LEGEND_MAX_TEXT,
  type LegendItem,
  CHECKLIST_MAX_TEXT,
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_TEXT,
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  type AgendaItem,
  type ChairFacing,
  type DecisionStatus,
  type EstimateScale,
  type EntityField,
  clampPercent,
  CODE_MAX_LENGTH,
  isProgressShape,
  RAIL_DEFAULT_POINTS,
  RAIL_MAX_POINTS,
  RAIL_MIN_POINTS,
  RAIL_POINT_STEP_PX,
  type AnimationSpeed,
  type ChecklistItem,
  type SelectionMode,
  type CodeLanguage,
  type Element,
  type ProgressAnim,
  type ShapeElement,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { useChartSetters } from '@/hooks/canvas/useChartSetters';
import { useWebComponentSetters } from '@/hooks/canvas/useWebComponentSetters';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';

// The kinds carrying masthead lines (see setPageHeading).
const MASTHEAD_SHAPES = new Set<string>(['page', 'banner', 'callout']);

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
  // Progress elements (docs/specs/009-elements/progress.md): the percentage + how its fill animates, all
  // gated to progress shapes. The four setters differ only in the patched
  // field + telemetry type, so they share one body.
  const setProgressFieldSelected = makeShapePatcher({
    currentSelectionIds,
    commit,
    matches: isProgressShape,
  });
  const setProgressSelected = (value: number) =>
    setProgressFieldSelected({ progress: clampPercent(value) }, 'Progress');
  const setProgressAnimSelected = (value: ProgressAnim | null) =>
    setProgressFieldSelected({ progressAnim: value ?? undefined }, 'ProgressAnim');
  const setProgressAnimSpeedSelected = (value: AnimationSpeed) =>
    setProgressFieldSelected({ progressAnimSpeed: value }, 'ProgressAnim');
  const setProgressAnimRepeatSelected = (value: boolean) =>
    setProgressFieldSelected({ progressAnimRepeat: value }, 'ProgressAnim');

  // Timeline rail (docs/specs/009-elements/timeline-rail.md). Setting the point count also resizes the element
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
  // ring's structural adds (docs/specs/008-canvas/canvas-and-palette.md). The helper returns the spliced cells
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
  // Edit one rail point's label (docs/specs/009-elements/timeline-rail.md). Keyed by element id (the inline
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

  // Code block (docs/specs/009-elements/code-block.md): replace the snippet + language together (the edit
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

  // Long-line wrapping (docs/specs/009-elements/code-block.md). Its own setter rather than a third argument
  // to setCodeSelected: that one commits the dialog's Save, and a toggle in
  // the menu has nothing to do with the snippet's text.
  // Legend rows (docs/specs/009-elements/pie-chart.md): the whole array at once, like the checklist's
  // section, so an add / remove / retitle is one undo step.
  const setLegendItemsSelected = (items: LegendItem[]) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const clean = items
      .slice(0, LEGEND_MAX_ITEMS)
      .map((item) => ({ ...item, label: item.label.slice(0, LEGEND_MAX_TEXT) }));
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'legend'
          ? { ...el, legendItems: clean }
          : el,
      ),
    );
    track('Element', 'Changed', 'Legend');
  };

  // Mind-map flow (docs/specs/009-elements/mind-node.md). Written to the tree's ROOT, not the selected
  // node: the flow is the map's, and a map half tree and half bubble is not a
  // map anyone meant to draw. Selecting several nodes of one map therefore
  // sets it once.
  const setMindFlowSelected = (flow: MindFlow) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((all) => {
      // Resolved inside the updater, against the elements as they stand: the
      // walk up to the root has to read the same array it writes back.
      const roots = new Set(
        all
          .filter((el) => ids.has(el.id))
          .filter(isMindNode)
          .map((el) => mindRootOf(all, el).id),
      );
      return roots.size === 0
        ? all
        : all.map((el) => (roots.has(el.id) ? { ...el, mindFlow: flow } : el));
    });
    track('Element', 'Changed', 'MindFlow');
  };

  const setCodeWrapSelected = (wrap: boolean) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'code-block'
          ? { ...el, codeWrap: wrap }
          : el,
      ),
    );
    track('Element', 'Changed', 'CodeWrap');
  };

  // The masthead lines (docs/specs/009-elements/page-element.md): a page's heading + subtitle, and the same
  // two fields on a banner (its subtitle) and a callout (its heading),
  // docs/specs/009-elements/web-components-and-no-groups.md. One setter for both lines rather than two near-identical ones,
  // since the only difference is which field.
  const setPageHeading = (
    elementId: string,
    field: 'pageTitle' | 'pageSubtitle',
    value: string,
  ) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || el.type !== 'shape' || !MASTHEAD_SHAPES.has(el.shape)) return el;
        // An empty line stores as undefined rather than '', so a page that was
        // typed into and cleared serialises the same as one never touched.
        return { ...el, [field]: value.trim() ? value : undefined };
      }),
    );
  };

  // Entity fields (docs/specs/009-elements/entity.md). Bounded on write like the checklist's rows, so
  // a paste into the menu can't produce an element nobody can read.
  const setEntityFieldsSelected = (fields: EntityField[]) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const bounded = fields.slice(0, ENTITY_MAX_FIELDS).map((f) => ({
      name: f.name.slice(0, ENTITY_MAX_TEXT),
      ...(f.type ? { type: f.type.slice(0, ENTITY_MAX_TEXT) } : {}),
    }));
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'entity'
          ? { ...el, entityFields: bounded }
          : el,
      ),
    );
    track('Element', 'Changed', 'Entity');
  };

  // --- The collaboration elements (docs/specs/012-collaboration/estimate-card.md, 127, 128, 130) ----------------
  // Selection-wide like every other setter here, each gated to its own kind so
  // a multi-selection containing a chair and a chart only writes the chair.
  const setCollabFieldSelected = (
    kind: ShapeElement['shape'],
    patch: Partial<ShapeElement>,
    telemetryType: string,
  ) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === kind ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };

  const setEstimateScaleSelected = (scale: EstimateScale) =>
    setCollabFieldSelected('estimate', { estimateScale: scale }, 'Estimate');

  const setAgendaItemsSelected = (items: AgendaItem[]) =>
    setCollabFieldSelected(
      'agenda',
      {
        agendaItems: items.slice(0, AGENDA_MAX_ITEMS).map((item) => ({
          label: item.label.slice(0, AGENDA_MAX_TEXT),
          minutes: item.minutes,
        })),
      },
      'Agenda',
    );

  const setDecisionStatusSelected = (status: DecisionStatus) =>
    setCollabFieldSelected('decision', { decisionStatus: status }, 'Decision');

  // An empty date CLEARS the field, so an undated card renders nothing at all
  // rather than an empty slot (docs/specs/012-collaboration/decision-record.md).
  const setDecisionDateSelected = (date: string | undefined) =>
    setCollabFieldSelected('decision', { decisionDate: date || undefined }, 'Decision');

  const setDecisionDriversSelected = (drivers: string[]) =>
    setCollabFieldSelected(
      'decision',
      {
        decisionDrivers: drivers
          .slice(0, DECISION_MAX_DRIVERS)
          .map((d) => d.slice(0, DECISION_MAX_TEXT)),
      },
      'Decision',
    );

  const setChairFacingSelected = (facing: ChairFacing) =>
    setCollabFieldSelected('chair', { chairFacing: facing }, 'Chair');

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

  // Mode button (docs/specs/009-elements/mode-button.md): which selection mode the button hands whoever
  // presses it. Gated to the button kind, so a multi-selection of mixed
  // elements only rewrites the buttons in it.
  const setButtonModeSelected = (mode: SelectionMode) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'mode-button' ? { ...el, mode } : el,
      ),
    );
    track('Element', 'Changed', 'ModeButton');
  };

  // Rating (docs/specs/009-elements/rating.md) + the charts (docs/specs/009-elements/pie-chart.md) — see useChartSetters.
  const chartSetters = useChartSetters({ currentSelectionIds, commit });
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md) — see useWebComponentSetters.
  const webSetters = useWebComponentSetters({ currentSelectionIds, commit });

  return {
    ...chartSetters,
    ...webSetters,
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
    setCodeWrapSelected,
    setMindFlowSelected,
    setLegendItemsSelected,
    setPageHeading,
    setChecklistItemsSelected,
    setEntityFieldsSelected,
    setEstimateScaleSelected,
    setAgendaItemsSelected,
    setDecisionStatusSelected,
    setDecisionDateSelected,
    setDecisionDriversSelected,
    setChairFacingSelected,
    setButtonModeSelected,
  };
}
