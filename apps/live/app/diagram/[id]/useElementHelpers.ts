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
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  multiSelectedIds: Set<string>;
  formatSourceId: string | null;
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
    activeId,
    activeTab,
    editsBlocked,
    multiSelectedIds,
    formatSourceId,
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

  // Insert a pre-built composite (several elements sharing a groupId) at the
  // viewport centre as ONE action. Unlike addBoxed it neither derives colours
  // nor inherits the selection's size — the builder owns the full styling and
  // layout (the banner, spec/09, is the first caller). Mirrors placeBoxed's
  // commit + activity-log + select path. The builder receives the centre
  // point and lays its elements out around it. Selects the first element,
  // which (sharing the groupId) expands to the whole banner.
  const addBoxedGroup = (build: (cx: number, cy: number) => BoxedElement[]) => {
    if (editsBlocked) return;
    const centre = getViewportCenter();
    const made = build(centre.x, centre.y);
    if (made.length === 0) return;
    const before = activeTab.elements;
    const after = [...before, ...made];
    commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
    emitChange(activeId, before, after);
    setSelectedId(made[0]!.id);
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

  // --- Selection helpers ---------------------------------------------------

  const memberIdsOf = (id: string | null): Set<string> => {
    if (!id) return new Set();
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

  const applyFormatFromSource = (targetId: string) => {
    if (!formatSourceId) return;
    const source = activeTab.elements.find((el) => el.id === formatSourceId);
    const target = activeTab.elements.find((el) => el.id === targetId);
    if (!source || !target || source.id === target.id) {
      setFormatSourceId(null);
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
      const projection = paintableBoxedFields(source);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && isBoxed(el) ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      const projection = paintableArrowFields(source);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow' ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    }
    setFormatSourceId(null);
  };

  const completeGrouping = (targetId: string) => {
    if (!groupSourceId) return;
    commit((els) => joinGroups(els, groupSourceId, targetId));
    setSelectedId(targetId);
  };

  return {
    addBoxed,
    addBoxedAt,
    addBoxedGroup,
    memberIdsOf,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    exitGroupMode,
    applyFormatFromSource,
    completeGrouping,
  };
}
