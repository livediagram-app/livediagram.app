import type { Dispatch, SetStateAction } from 'react';
import {
  takesTypedLabel,
  isBoxed,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { insertElementAt, type InsertionSlot } from '@/lib/insert-between';
import { deriveNewBoxedColours } from '@/lib/themes';
import { inheritedSizeFor } from '@/lib/canvas';
import { applyPaint, paintableArrowFields, paintableBoxedFields } from '@/lib/format-painter';
import { filterPaintedFields, formatPaintsAnything, type FormatConfig } from '@/lib/format-config';
import { track } from '@/lib/telemetry';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Selection + placement + format helpers, lifted out of editor-page.tsx.
// These back the element-creation and selection handlers (addBoxed
// sizes/colours a new element from the selection + backdrop;
// currentSelectionIds / selectionPrimary resolve the working set;
// applyFormatFromSource runs the format painter). Returned so the
// still-inline handlers and the Canvas consume them.
// The selection as one set: the multi-selection when there is one, else the single selected id.
export function selectionIds(
  selectedId: string | null,
  multiSelectedIds: ReadonlySet<string>,
): Set<string> {
  if (multiSelectedIds.size > 0) return new Set(multiSelectedIds);
  return selectedId ? new Set([selectedId]) : new Set();
}

export function useElementHelpers(opts: {
  selectedId: string | null;
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  multiSelectedIds: Set<string>;
  formatSourceId: string | null;
  // The Format Panel's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, and whether the brush stays loaded.
  formatConfig: FormatConfig;
  getViewportCenter: () => { x: number; y: number };
  commit: (updater: (els: Element[]) => Element[]) => void;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  setFormatSourceId: SetState<string | null>;
}) {
  const {
    selectedId,
    activeId,
    activeTab,
    editsBlocked,
    multiSelectedIds,
    formatSourceId,
    formatConfig,
    getViewportCenter,
    commit,
    commitTabs,
    emitChange,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
  } = opts;

  const addBoxed = <T extends BoxedElement>(make: (x: number, y: number) => T) => {
    placeBoxed(make, getViewportCenter());
  };

  // Drag-from-palette drop: same as addBoxed but centred on an explicit
  // canvas point (the drop position) instead of the viewport centre. Size
  // inheritance is skipped — a dropped element uses its own default size.
  // `edit` puts the new element straight into label editing. Dropping a
  // sticky is the start of writing on it, not an end in itself — the drag
  // said WHERE and WHAT, and the only thing left is the words, so making the
  // user double-click their own fresh note is a step that answers nothing.
  const addBoxedAt = <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    // `insertion` is the slot an event-storming drag was offering (docs/specs/021-event-storming/event-storming.md):
    // the drop then ripples the board open and adds the note as ONE change.
    // `style` dresses the built element last, after the theme colours: style
    // memory (docs/specs/008-canvas/quick-style-panel.md) for a palette drop.
    opts?: {
      edit?: boolean;
      insertion?: InsertionSlot | null;
      style?: <E extends BoxedElement>(el: E) => E;
    },
  ) => {
    placeBoxed(
      make,
      { x: canvasX, y: canvasY },
      /* inheritSize */ false,
      opts?.edit === true,
      opts?.insertion ?? null,
      opts?.style,
    );
  };

  const placeBoxed = <T extends BoxedElement>(
    make: (x: number, y: number) => T,
    centre: { x: number; y: number },
    inheritSize = true,
    edit = false,
    insertion: InsertionSlot | null = null,
    style: <E extends BoxedElement>(el: E) => E = (el) => el,
  ) => {
    if (editsBlocked) return;
    const base = make(0, 0);
    // Inherit the selected element's size (shared with the combined add
    // gesture's tap branch via inheritedSizeFor); circles + diamonds stay
    // square so an inherited non-square size doesn't squash them. A
    // drag-drop (inheritSize=false) keeps the element's own default size.
    const sel =
      inheritSize && selectedId ? activeTab.elements.find((el) => el.id === selectedId) : null;
    const { width, height } = inheritSize
      ? inheritedSizeFor(base, sel)
      : { width: base.width, height: base.height };
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
    const after = insertion ? insertElementAt(before, insertion, el) : [...before, el];
    // Insert between (docs/specs/021-event-storming/event-storming.md): the ripple runs against whatever the tab
    // holds NOW, not the snapshot the drag started with, so a peer's mid-drag
    // move isn't reverted by the drop that follows it. One commitTabs = one
    // history entry, so a single Undo takes the ripple AND the note back.
    commitTabs((ts) =>
      insertion
        ? ts.map((t) =>
            t.id === activeId
              ? { ...t, elements: insertElementAt(t.elements, insertion, el), templateChosen: true }
              : t,
          )
        : patchTab(ts, activeId, { elements: after, templateChosen: true }),
    );
    // Activity-log the add. commit() (the element-only setter) does
    // this on every change; addBoxed bypasses commit because it also
    // touches templateChosen on the tab, so the emitChange call has
    // to be repeated here. Without it, palette adds never appear in
    // the Activity panel.
    emitChange(activeId, before, after);
    setSelectedId(el.id);
    // Only kinds that take typed text: a sticker or a session button renders
    // its own face from its setting, so a caret there edits nothing.
    if (edit && takesTypedLabel(el)) setEditingId(el.id);
  };

  // --- Selection helpers ---------------------------------------------------

  // Unified "what's the user editing right now?" id set: an active
  // marquee multi-selection, else the single selection. Every editor
  // setter resolves through this so shared controls bulk-apply across a
  // multi-selection exactly as they apply to one element.
  const currentSelectionIds = (): Set<string> => selectionIds(selectedId, multiSelectedIds);

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

  const exitFormatPainter = () => setFormatSourceId(null);

  // `keepSource` (set by the persistent Format canvas tool) leaves the
  // source armed after a paint so the user can tap target after target;
  // the single-shot toolbar painter omits it and the source clears after
  // one apply.
  const applyFormatFromSource = (targetId: string, opts?: { keepSource?: boolean }) => {
    if (!formatSourceId) return;
    // Every toggle off means there is nothing to paint: leave the brush and
    // the target alone rather than committing an empty change per tap.
    if (!formatPaintsAnything(formatConfig)) return;
    // "Paint once" (docs/specs/008-canvas/format-panel.md) empties the brush after one apply, whatever the
    // caller asked for; the single-shot toolbar painter never asks to keep it.
    const keepSource = opts?.keepSource === true && formatConfig.mode === 'keep';
    const source = activeTab.elements.find((el) => el.id === formatSourceId);
    const target = activeTab.elements.find((el) => el.id === targetId);
    if (!source || !target || source.id === target.id) {
      if (!keepSource) setFormatSourceId(null);
      return;
    }
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
      const projection = filterPaintedFields(paintableBoxedFields(source), formatConfig);
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
    addBoxed,
    addBoxedAt,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    applyFormatFromSource,
  };
}
