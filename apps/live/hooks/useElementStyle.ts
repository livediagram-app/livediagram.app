// Element styling / layering actions, lifted out of editor-page.tsx.
// Every handler here mutates a field (or fields) on the *current
// selection* — single-selected element or the whole multi-select
// bag, resolved through `currentSelectionIds`. They share one shape:
// read the selection ids, bail when empty, then `commit` (or, for the
// debounced colour / opacity edits, `commitTabs` + a scheduled log
// entry).
//
// What's deliberately NOT here:
// - Structural ops (duplicate, group, delete, marquee) — those touch
//   selection-mode state + navigation and stay in the page.
// - Link actions + followLink — link picker domain.
//
// Colour + opacity setters bypass `commit` on purpose: they fire on
// every drag tick of a colour / slider control, so they write via
// `commitTabs` (no per-tick history snapshot or activity-log emit)
// and debounce a single log entry through `scheduleElementChangeLog`.
// Keeping that policy in one file makes it auditable.

import {
  ARROW_THICKNESS_PX,
  bringManyToFront,
  isBoxed,
  sendManyToBack,
  supportsBorder,
  type ArrowEnds,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type Padding,
  type ShapeKind,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { track } from '@/lib/telemetry';

type EditorElementStyleDeps = {
  // The active selection, resolved to a set of element ids (single
  // selection expands to its group members; multi-select returns the
  // marquee bag). Empty set = nothing selected.
  currentSelectionIds: () => Set<string>;
  // The "primary" element of the selection — the one whose current
  // value the toggles read to decide the next state (so a partially
  // applied group all jumps the same way).
  selectionPrimary: () => Element | null;
  // The single-selected element id (null in multi-select / none).
  // Shape-only setters (shape kind, border presets) target it
  // directly.
  selectedId: string | null;
  // The active tab — read for its theme (resetColors) and id.
  activeTab: Tab;
  activeId: string;
  // True when edits are disallowed (read-only role / locked tab). The
  // colour + opacity setters no-op when set.
  editsBlocked: boolean;
  // History-aware element mutator (snapshots + emits the log).
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Tab mutator that does NOT push history — used by the high-
  // frequency colour / opacity setters.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Debounced activity-log emit for the bypassed colour / opacity
  // edits, keyed by field name.
  scheduleElementChangeLog: (key: string) => void;
};

export function useElementStyle(deps: EditorElementStyleDeps) {
  const {
    currentSelectionIds,
    selectionPrimary,
    selectedId,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    commitTabs,
    scheduleElementChangeLog,
  } = deps;

  const toggleLockSelected = () => {
    if (!selectedId) return;
    const source = selectionPrimary();
    if (!source) return;
    const shouldLock = !(source.locked === true);
    const ids = currentSelectionIds();
    commit((els) => els.map((el) => (ids.has(el.id) ? { ...el, locked: shouldLock } : el)));
    track('Element', shouldLock ? 'Locked' : 'Unlocked');
  };

  const toggleAspectLockSelected = () => {
    if (!selectedId) return;
    const source = selectionPrimary();
    if (!source || !isBoxed(source)) return;
    const shouldLock = !(source.aspectLocked === true);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, aspectLocked: shouldLock } : el)),
    );
  };

  const bringSelectedToFront = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => bringManyToFront(els, ids));
    track('Element', 'Reordered', 'Front');
  };

  const sendSelectedToBack = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => sendManyToBack(els, ids));
    track('Element', 'Reordered', 'Back');
  };

  const setTextSizeSelected = (size: TextSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textSize: size } : el)),
    );
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
  };

  // Generic helper for the inline label styles. Each toggle flips the
  // matching boolean on every member of the current selection. We
  // derive the next value from the primary so a partially-applied
  // group all jumps to the same state.
  const toggleTextStyleSelected = (
    field: 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough',
  ) => {
    const primary = selectionPrimary();
    if (!primary || !isBoxed(primary)) return;
    const next = !(primary[field] ?? false);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, [field]: next } : el)),
    );
  };

  const setFillColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // State update inline (bypass `commit` so emitChange doesn't
    // fire per-tick); log entry debounced — same pattern as
    // opacity.
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) &&
                (el.type === 'shape' ||
                  el.type === 'sticky' ||
                  el.type === 'freehand' ||
                  el.type === 'table')
                  ? { ...el, fillColor: color }
                  : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('fillColor');
  };

  const setStrokeColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) &&
                (el.type === 'shape' ||
                  el.type === 'sticky' ||
                  el.type === 'arrow' ||
                  el.type === 'freehand' ||
                  el.type === 'table')
                  ? { ...el, strokeColor: color }
                  : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('strokeColor');
  };

  const setTextColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) && isBoxed(el) ? { ...el, textColor: color } : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('textColor');
  };

  const setOpacitySelected = (opacity: number) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) => (ids.has(el.id) ? { ...el, opacity } : el)),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('elementOpacity');
  };

  const setPaddingSelected = (padding: Padding) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, padding } : el)));
  };

  const setArrowEndsSelected = (arrowEnds: ArrowEnds) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowEnds } : el)),
    );
  };

  const setArrowThicknessSelected = (thickness: ArrowThickness) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const px = ARROW_THICKNESS_PX[thickness];
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, strokeWidth: px } : el)),
    );
  };

  const setArrowheadSizeSelected = (size: ArrowheadSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowheadSize: size } : el,
      ),
    );
  };

  // Toggle the header row / column band on the selected table(s).
  const setTableHeaderRowSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'table' ? { ...el, headerRow: !el.headerRow } : el,
      ),
    );
  };
  const setTableHeaderColumnSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'table' ? { ...el, headerColumn: !el.headerColumn } : el,
      ),
    );
  };

  const setArrowStyleSelected = (style: ArrowStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowStyle: style } : el)),
    );
  };

  const setArrowheadShapeSelected = (shape: ArrowheadShape) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowheadShape: shape } : el,
      ),
    );
  };

  // Line pattern (solid / dashed / dotted) on the selected arrow.
  // Reuses the BorderStyle union shapes already carry so future
  // pattern additions (e.g. 'long-dash') just need a single
  // BORDER_DASH_ARRAY entry to light up both surfaces.
  const setArrowStrokeStyleSelected = (style: BorderStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, strokeStyle: style } : el)),
    );
  };

  // Morph the selected shape into a different kind, preserving width /
  // height / label / colour overrides. Circle and diamond are 1:1
  // shapes — coming from a non-square box, snap to the larger side so
  // the result fits the original footprint.
  const setShapeKindSelected = (kind: ShapeKind) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) => {
        if (el.id !== selectedId || el.type !== 'shape') return el;
        const oneToOne = kind === 'circle' || kind === 'diamond';
        if (oneToOne) {
          const side = Math.max(el.width, el.height);
          return { ...el, shape: kind, width: side, height: side };
        }
        return { ...el, shape: kind };
      }),
    );
  };

  // Border-preset setters. Each writes the field on any element
  // that `supportsBorder` accepts (today: shapes + the freehand
  // pen tool); non-supporting elements are ignored. Routing
  // through the shared predicate keeps the four call sites of
  // this rule (these two setters plus the matching Canvas
  // paletteSelection.borderStroke / borderStyle derivations) in
  // step when a future element variant gains a border.
  const setBorderStrokeSelected = (value: BorderStroke) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) =>
        el.id === selectedId && supportsBorder(el) ? { ...el, strokeWidth: value } : el,
      ),
    );
  };
  const setBorderStyleSelected = (value: BorderStyle) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) =>
        el.id === selectedId && supportsBorder(el) ? { ...el, strokeStyle: value } : el,
      ),
    );
  };
  const setBorderRadiusSelected = (value: BorderRadius) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) =>
        el.id === selectedId && el.type === 'shape' ? { ...el, borderRadius: value } : el,
      ),
    );
  };

  // Clear per-element colour overrides so the element falls back to
  // whatever the current tab theme dictates. Each colour field is set
  // to undefined; the history hook snapshots the present so this is
  // undoable as one step.
  const resetColorsSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // "Reset to theme" applies the tab's current theme colours when
    // the tab has one set. Plain delete-the-override only works when
    // the theme is the brand default (its `elementFill / Stroke / Text`
    // are all null, so falling back to the type-default produces the
    // brand look). For any other theme we need to explicitly set the
    // colours since `addBoxed` is what normally writes them on create.
    const theme = getTheme(activeTab.theme);
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id)) return el;
        if (el.type === 'shape') {
          return {
            ...el,
            ...(theme.elementFill !== null
              ? { fillColor: theme.elementFill }
              : { fillColor: undefined }),
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
          };
        }
        if (el.type === 'text') {
          return {
            ...el,
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            fillColor: undefined,
            strokeColor: undefined,
          };
        }
        if (el.type === 'sticky') {
          // Sticky's amber palette is iconic — wipe any user overrides
          // but DON'T apply theme colours.
          const { fillColor: _f, strokeColor: _s, textColor: _t, ...rest } = el;
          return rest as typeof el;
        }
        if (el.type === 'arrow') {
          return {
            ...el,
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
          };
        }
        return el;
      }),
    );
  };

  return {
    toggleLockSelected,
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setTextSizeSelected,
    setTextAlignSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setPaddingSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setShapeKindSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    resetColorsSelected,
  };
}
