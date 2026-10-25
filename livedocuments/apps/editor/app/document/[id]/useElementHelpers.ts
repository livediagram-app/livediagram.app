import type { Dispatch, SetStateAction } from 'react';
import {
  takesTypedLabel,
  isBoxed,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { deriveNewBoxedColours } from '@/lib/themes';
import {
  applyPaint,
  fitPaintToTarget,
  paintableArrowFields,
  paintableBoxedFields,
} from '@/lib/format-painter';
import {
  filterPaintedFields,
  formatPaintsAnything,
  type FormatConfig,
} from '@liveworkspace/workbench/lib/format-config';
import { track } from '@/lib/telemetry';
import { brushPageId } from '@liveworkspace/workbench/lib/format-page-brush';
import { patchTab } from './editor-page-helpers';
import { selectionIds, type Selection } from '@liveworkspace/workbench/lib/selection-store';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Selection + placement + format helpers, lifted out of editor-page.tsx.
// These back the element-creation and selection handlers (addBoxedAt
// colours a new element from the backdrop;
// currentSelectionIds / selectionPrimary resolve the working set;
// applyFormatFromSource runs the format painter). Returned so the
// still-inline handlers and the Canvas consume them.
export function useElementHelpers(opts: {
  // The selection, read where a helper acts (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  formatSourceId: string | null;
  // The Format Panel's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, and whether the brush stays loaded.
  formatConfig: FormatConfig;
  commit: (updater: (els: Element[]) => Element[]) => void;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  setFormatSourceId: SetState<string | null>;
}) {
  const {
    readSelection,
    activeId,
    activeTab,
    editsBlocked,
    formatSourceId,
    formatConfig,
    commit,
    commitTabs,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
  } = opts;

  // Drag-from-palette drop: an element centred on an explicit canvas point (the drop position).
  // Size inheritance is skipped — a dropped element uses its own default size.
  // `edit` puts the new element straight into label editing. Dropping a
  // sticky is the start of writing on it, not an end in itself — the drag
  // said WHERE and WHAT, and the only thing left is the words, so making the
  // user double-click their own fresh note is a step that answers nothing.
  const addBoxedAt = <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    // `style` dresses the built element last, after the theme colours: style
    // memory (docs/specs/008-canvas/quick-style-panel.md) for a palette drop.
    opts?: {
      edit?: boolean;
      style?: <E extends BoxedElement>(el: E) => E;
      // false: added without selecting it on the canvas (a chart that sits in a Sheet, selected there instead).
      select?: boolean;
    },
  ) => {
    placeBoxed(
      make,
      { x: canvasX, y: canvasY },
      opts?.edit === true,
      opts?.style,
      opts?.select !== false,
    );
  };

  const placeBoxed = <T extends BoxedElement>(
    make: (x: number, y: number) => T,
    centre: { x: number; y: number },
    edit = false,
    style: <E extends BoxedElement>(el: E) => E = (el) => el,
    select = true,
  ) => {
    if (editsBlocked) return;
    const base = make(0, 0);
    // A dropped element keeps its own default size.
    const { width, height } = base;
    // Derive colours from the active tab's backdrop + theme. The
    // two-pass projection (background-derived then theme-override)
    // lives in lib/themes.ts so the rule is testable in isolation
    // and stays in sync with the other theme helpers
    // (recolourElementForTheme etc).
    const colours = deriveNewBoxedColours(base, {
      backgroundColor: activeTab.backgroundColor,
      patternColor: activeTab.patternColor,
      theme: activeTab.theme,
    });
    const el: T = style({
      ...base,
      ...colours,
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
      // Seed the tab's default text size onto the new element (docs/specs/004-interface-design/fonts.md).
      ...(activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {}),
    });
    // Single commit that both adds the element and marks the template
    // picker as dismissed for this tab (if it was still showing).
    // Append (not prepend) so new elements land at the FRONT of the
    // z-order: rendering is by array index, lowest first, so the last
    // entry paints on top. Landing new content where the user can see
    // and immediately work with it matches every other editor; the
    // Layer accordion's "Send to back" covers the rarer reverse case.
    const before = activeTab.elements;
    const after = [...before, el];
    commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
    if (select) setSelectedId(el.id);
    // Only kinds that take typed text: a sticker or a session button renders
    // its own face from its setting, so a caret there edits nothing.
    if (edit && takesTypedLabel(el)) setEditingId(el.id);
  };

  // --- Selection helpers ---------------------------------------------------

  // Unified "what's the user editing right now?" id set: an active
  // marquee multi-selection, else the single selection. Every editor
  // setter resolves through this so shared controls bulk-apply across a
  // multi-selection exactly as they apply to one element.
  const currentSelectionIds = (): Set<string> => {
    const { selectedId, multiSelectedIds } = readSelection();
    return selectionIds(selectedId, multiSelectedIds);
  };

  // First element in `activeTab.elements` (DOM/z-order) that's in
  // the current selection. Used as the "primary" for toggle setters
  // (lock, bold, etc.) — read its current value, apply the inverse
  // to every selected element. Returns null when nothing is selected.
  const selectionPrimary = (): Element | null => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return null;
    return activeTab.elements.find((el) => ids.has(el.id)) ?? null;
  };

  // --- Modes ---------------------------------------------------------------

  // The Format tool's paint (docs/specs/008-canvas/format-panel.md): "Keep
  // painting" leaves the source armed after a paint so the user can tap
  // target after target; "Paint once" empties the brush after one apply.
  const applyFormatFromSource = (targetId: string) => {
    if (!formatSourceId) return;
    // Every toggle off means there is nothing to paint: leave the brush and
    // the target alone rather than committing an empty change per tap.
    if (!formatPaintsAnything(formatConfig)) return;
    // A page's background in the brush paints pages, not elements: the brush is kept
    // (docs/specs/007-editor/pages-mode.md "Copying a background").
    if (brushPageId(formatSourceId)) return;
    const keepSource = formatConfig.mode === 'keep';
    const source = activeTab.elements.find((el) => el.id === formatSourceId);
    // The source is gone (deleted, or another tab): the brush holds nothing any more.
    if (!source) {
      setFormatSourceId(null);
      return;
    }
    const target = activeTab.elements.find((el) => el.id === targetId);
    // Only an apply empties a Paint once brush (or counts as a paint): a tap on the source itself, or on an
    // element of the other kind (a shape's look onto an arrow, a no-op), leaves the brush loaded.
    const boxedPair = !!target && isBoxed(source) && isBoxed(target);
    const arrowPair = source.type === 'arrow' && target?.type === 'arrow';
    if (!target || source.id === target.id || !(boxedPair || arrowPair)) return;
    track('Element', 'Changed', 'FormatPainter');
    // Field projections live in lib/format-painter.ts so the list
    // of painted fields (and the rule that future additions to
    // BoxedElement / ArrowElement must be opted into the painter
    // by hand) is one tested source of truth. Boxed-to-arrow and
    // arrow-to-boxed paints are no-ops: the two kinds share
    // almost no formattable fields.
    if (isBoxed(source) && isBoxed(target)) {
      // The Format Panel (docs/specs/008-canvas/format-panel.md) decides which parts travel; the projection
      // above still decides which parts CAN.
      const projection = fitPaintToTarget(
        source,
        target,
        filterPaintedFields(paintableBoxedFields(source), formatConfig),
      );
      commit((els) =>
        els.map((el) => (el.id === targetId && isBoxed(el) ? applyPaint(el, projection) : el)),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      const projection = filterPaintedFields(paintableArrowFields(source), formatConfig);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow' ? applyPaint(el, projection) : el,
        ),
      );
    }
    if (!keepSource) setFormatSourceId(null);
  };

  return {
    addBoxedAt,
    currentSelectionIds,
    selectionPrimary,
    applyFormatFromSource,
  };
}
