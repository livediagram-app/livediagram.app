import {
  addTableColumn,
  addTableRow,
  CHECKLIST_MAX_ITEMS,
  LEGEND_MAX_ITEMS,
  LEGEND_MAX_TEXT,
  type LegendItem,
  CHECKLIST_MAX_TEXT,
  clampPercent,
  CODE_MAX_LENGTH,
  isProgressShape,
  type AnimationSpeed,
  type ChecklistItem,
  type CodeLanguage,
  type Element,
  type ProgressAnim,
} from '@livepages/document';
import { track } from '@/lib/telemetry';
import { useChartSetters } from '@/hooks/canvas/useChartSetters';
import { useWebComponentSetters } from '@/hooks/canvas/useWebComponentSetters';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';

// The kinds carrying masthead lines (see setPageHeading).
const MASTHEAD_SHAPES = new Set<string>(['page', 'banner', 'callout', 'card']);

type DataShapeSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The tab's elements, for the web components' row writes (useWebComponentSetters).
  elements: () => Element[];
};

// The selection-wide setters for the data-bearing shapes: progress bars,
// timeline rails, ratings, and pie / bar / line charts (values + per-kind
// looping animation + chart legend). Each kind has a private field setter the
// public ones delegate to; all resolve the selection and commit through the
// two shared handles, so they live together off useElementStyle.

export function useDataShapeSetters({
  currentSelectionIds,
  commit,
  elements,
}: DataShapeSetterDeps) {
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

  // Rating (docs/specs/009-elements/rating.md) + the charts (docs/specs/009-elements/pie-chart.md) — see useChartSetters.
  const chartSetters = useChartSetters({ currentSelectionIds, commit });
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md) — see useWebComponentSetters.
  const webSetters = useWebComponentSetters({ currentSelectionIds, commit, elements });

  return {
    ...chartSetters,
    ...webSetters,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setPageHeading,
    setChecklistItemsSelected,
  };
}
