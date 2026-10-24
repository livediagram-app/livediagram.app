import type { Dispatch, SetStateAction } from 'react';
import {
  takesTypedLabel,
  type BoxedElement,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { deriveNewBoxedColours } from '@/lib/themes';
import { inheritedSizeFor } from '@/lib/canvas';
import { patchTab } from './editor-page-helpers';
import { selectionIds, type Selection } from '@/lib/selection-store';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Selection + placement helpers, lifted out of editor-page.tsx.
// These back the element-creation and selection handlers (addBoxed
// sizes/colours a new element from the selection + backdrop;
// currentSelectionIds / selectionPrimary resolve the working set). Returned so the
// still-inline handlers and the Canvas consume them.
export function useElementHelpers(opts: {
  // The selection, read where a helper acts (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  activeId: string;
  activeTab: Tab;
  editsBlocked: boolean;
  // The Format Panel's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, and whether the brush stays loaded.
  getViewportCenter: () => { x: number; y: number };
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
}) {
  const {
    readSelection,
    activeId,
    activeTab,
    editsBlocked,
    getViewportCenter,
    commitTabs,
    setSelectedId,
    setEditingId,
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
      /* inheritSize */ false,
      opts?.edit === true,
      opts?.style,
      opts?.select !== false,
    );
  };

  const placeBoxed = <T extends BoxedElement>(
    make: (x: number, y: number) => T,
    centre: { x: number; y: number },
    inheritSize = true,
    edit = false,
    style: <E extends BoxedElement>(el: E) => E = (el) => el,
    select = true,
  ) => {
    if (editsBlocked) return;
    const base = make(0, 0);
    // Inherit the selected element's size (shared with the combined add
    // gesture's tap branch via inheritedSizeFor); circles + diamonds stay
    // square so an inherited non-square size doesn't squash them. A
    // drag-drop (inheritSize=false) keeps the element's own default size.
    const { selectedId } = readSelection();
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

  return {
    addBoxed,
    addBoxedAt,
    currentSelectionIds,
    selectionPrimary,
  };
}
