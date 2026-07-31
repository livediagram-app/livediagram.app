import type { Dispatch, SetStateAction } from 'react';
import {
  isBoxed,
  joinGroups,
  selectionMembers,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { deriveNewBoxedColours } from '@/lib/themes';
import { inheritedSizeFor } from '@/lib/canvas';
import { paintableArrowFields, paintableBoxedFields } from '@/lib/format-painter';
import { filterPaintedFields, formatPaintsAnything, type FormatConfig } from '@/lib/format-config';
import { track } from '@/lib/telemetry';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Selection + placement + format/group helpers, lifted out of
// editor-page.tsx. These back the element-creation and selection
// handlers (addBoxed sizes/colours a new element from the selection +
// backdrop; memberIdsOf / currentSelectionIds / selectionPrimary resolve
// the working set; applyFormatFromSource / completeGrouping run the
// format-painter + group modes). Returned so the still-inline handlers
// and the Canvas consume them.
export function useElementHelpers(opts: {
  selectedId: string | null;
  // Drill-in selection (spec/09 groups): when equal to selectedId, the
  // selection is just that member, so member resolution must NOT expand
  // to the whole group.
  soloSelectedId: string | null;
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  multiSelectedIds: Set<string>;
  formatSourceId: string | null;
  // The Format Panel's settings (spec/117): which parts of a copied style
  // travel, and whether the brush stays loaded.
  formatConfig: FormatConfig;
  groupSourceId: string | null;
  getViewportCenter: () => { x: number; y: number };
  commit: (updater: (els: Element[]) => Element[]) => void;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  setSelectedId: SetState<string | null>;
  setFormatSourceId: SetState<string | null>;
  setGroupSourceId: SetState<string | null>;
}) {
  const {
    selectedId,
    soloSelectedId,
    activeId,
    activeTab,
    editsBlocked,
    multiSelectedIds,
    formatSourceId,
    formatConfig,
    groupSourceId,
    getViewportCenter,
    commit,
    commitTabs,
    emitChange,
    setSelectedId,
    setFormatSourceId,
    setGroupSourceId,
  } = opts;

  const addBoxed = <T extends BoxedElement>(make: (x: number, y: number) => T) => {
    placeBoxed(make, getViewportCenter());
  };

  // Drag-from-palette drop: same as addBoxed but centred on an explicit
  // canvas point (the drop position) instead of the viewport centre. Size
  // inheritance is skipped — a dropped element uses its own default size.
  const addBoxedAt = <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
  ) => {
    placeBoxed(make, { x: canvasX, y: canvasY }, /* inheritSize */ false);
  };

  const placeBoxed = <T extends BoxedElement>(
    make: (x: number, y: number) => T,
    centre: { x: number; y: number },
    inheritSize = true,
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
    const el: T = {
      ...base,
      ...colours,
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
      // Seed the tab's default text size onto the new element (spec/28).
      ...(activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {}),
    };
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
    // Activity-log the add. commit() (the element-only setter) does
    // this on every change; addBoxed bypasses commit because it also
    // touches templateChosen on the tab, so the emitChange call has
    // to be repeated here. Without it, palette adds never appear in
    // the Activity panel.
    emitChange(activeId, before, after);
    setSelectedId(el.id);
  };

  // Place ALREADY-BUILT elements, keeping every side effect a normal add has:
  // theme colours on the boxed ones, the template-picker dismissal, the
  // activity-log entry, and selecting the primary.
  //
  // placeBoxed above makes exactly one element and centres it on a point.
  // Mind-map growth (spec/118) makes a node AND its connector, at a position
  // it has already worked out from the branch, so it needs neither of those —
  // but it needs all of the rest, and re-implementing them at the call site is
  // how an add path ends up missing its activity-log entry.
  const placePrebuilt = (added: Element[], primaryId: string) => {
    if (editsBlocked) return;
    const themed = added.map((el) =>
      isBoxed(el)
        ? {
            ...el,
            ...deriveNewBoxedColours(el, {
              backgroundColor: activeTab.backgroundColor,
              patternColor: activeTab.patternColor,
              theme: activeTab.theme,
            }),
            ...(activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {}),
          }
        : el,
    );
    // Appends inside the updater, against whatever the tab holds NOW, rather
    // than against a captured `activeTab.elements`.
    //
    // This matters because of who calls it: the mind-map grower runs
    // immediately after the label editor commits the text you just typed
    // (spec/118), in the same tick. A snapshot taken at render time predates
    // that commit, so writing it back silently threw the label away — every
    // node in a chain came out blank.
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: [...t.elements, ...themed], templateChosen: true }
          : t,
      ),
    );
    // The log entry describes the ADD, which is correct even if `before` is a
    // beat stale: any label change committed just now emitted its own entry.
    const before = activeTab.elements;
    emitChange(activeId, before, [...before, ...themed]);
    setSelectedId(primaryId);
  };

  // --- Selection helpers ---------------------------------------------------

  const memberIdsOf = (id: string | null): Set<string> => {
    if (!id) return new Set();
    // A drilled-in group member stands alone: setters / delete / duplicate
    // act on just it, not its whole group.
    if (id === soloSelectedId && id === selectedId) return new Set([id]);
    return new Set(selectionMembers(activeTab.elements, id));
  };

  // Unified "what's the user editing right now?" id set. An active
  // marquee multi-selection wins; otherwise we fall back to the
  // single-id member-resolver (which expands a group selection
  // into its full membership). Every editor setter that used to
  // operate on `memberIdsOf(selectedId)` now uses this so shared
  // controls bulk-apply across either flavour of multi-selection.
  const currentSelectionIds = (): Set<string> => {
    if (multiSelectedIds.size > 0) return new Set(multiSelectedIds);
    return memberIdsOf(selectedId);
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

  const exitFormatPainter = () => setFormatSourceId(null);
  const exitGroupMode = () => setGroupSourceId(null);

  // `keepSource` (set by the persistent Format canvas tool) leaves the
  // source armed after a paint so the user can tap target after target;
  // the single-shot toolbar painter omits it and the source clears after
  // one apply.
  const applyFormatFromSource = (targetId: string, opts?: { keepSource?: boolean }) => {
    if (!formatSourceId) return;
    // Every toggle off means there is nothing to paint: leave the brush and
    // the target alone rather than committing an empty change per tap.
    if (!formatPaintsAnything(formatConfig)) return;
    // "Paint once" (spec/117) empties the brush after one apply, whatever the
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
      // The Format Panel (spec/117) decides which parts travel; the projection
      // above still decides which parts CAN.
      const projection = filterPaintedFields(paintableBoxedFields(source), formatConfig);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && isBoxed(el) ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      const projection = filterPaintedFields(paintableArrowFields(source), formatConfig);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow' ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    }
    if (!keepSource) setFormatSourceId(null);
  };

  const completeGrouping = (targetId: string) => {
    if (!groupSourceId) return;
    track('Element', 'Grouped'); // parity with the marquee-group path
    commit((els) => joinGroups(els, groupSourceId, targetId));
    setSelectedId(targetId);
  };

  return {
    addBoxed,
    addBoxedAt,
    placePrebuilt,
    memberIdsOf,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    exitGroupMode,
    applyFormatFromSource,
    completeGrouping,
  };
}
