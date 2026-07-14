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
  bringElementsToFrontLayer,
  isBoxed,
  sendElementsToBackLayer,
  type AnimationSpeed,
  type ElementAnimation,
  type IconAnimation,
  type IconSize,
  type Element,
  type Padding,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { useArrowStyleSetters } from './useArrowStyleSetters';
import { useDataShapeSetters } from './useDataShapeSetters';
import { useShapeStyleSetters } from './useShapeStyleSetters';
import { useTextStyleSetters } from './useTextStyleSetters';
import { useColorStyleSetters } from './useColorStyleSetters';

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
  // History-aware ACTIVE-TAB mutator, for the layer-aware Bring to
  // Front / Send to Back (spec/74): they restack `tab.layers` as well
  // as the elements array, which element-level `commit` can't reach.
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
  // Non-history tab mutator + one-shot checkpoint for the high-
  // frequency colour / opacity setters: one undoable step per picker
  // gesture (a commit per onChange tick flooded the 3-deep undo stack
  // in a single drag). The checkpoint returns its undo-marker token so
  // the debounced log entry fills the gesture's own step.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markCheckpoint: () => number;
  // Debounced activity-log emit for the bypassed colour / opacity
  // edits, keyed by field name.
  scheduleElementChangeLog: (
    key: string,
    opts?: { fillToken?: number; onWindowStart?: () => number },
  ) => void;
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
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    scheduleElementChangeLog,
  } = deps;

  const {
    setArrowFieldSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowStyleSelected,
    setArrowheadShapeSelected,
    setArrowStrokeStyleSelected,
    applyArrowPresetSelected,
    resetArrowStyleSelected,
    setArrowFlowSelected,
  } = useArrowStyleSetters({ currentSelectionIds, commit });

  const {
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
  } = useDataShapeSetters({ currentSelectionIds, commit });

  const {
    setShapeKindSelected,
    resetAspectRatioSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    applyShapeColorPresetSelected,
    resetShapeStyleSelected,
  } = useShapeStyleSetters({ currentSelectionIds, commit, activeTab, selectedId });

  const { setTextSizeSelected, setFontSelected, setTextAlignSelected, toggleTextStyleSelected } =
    useTextStyleSetters({ currentSelectionIds, selectionPrimary, commit });

  // The debounced colour / opacity policy + Reset-to-theme — see
  // useColorStyleSetters (the fifth setter sibling).
  const {
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setTableHeaderFillSelected,
    setTableHeaderTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    resetColorsSelected,
  } = useColorStyleSetters({
    currentSelectionIds,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    tickTabs,
    markCheckpoint,
    scheduleElementChangeLog,
  });

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
    track('Element', 'Toggled', 'AspectLock');
  };

  // Bring to Front / Send to Back are LAYER moves (spec/74): the
  // selection lands on the top (resp. bottom) layer, minting a fresh
  // edge layer when the current one holds anything else and pruning any
  // layer the move emptied. These two buttons are how layers accrue for
  // users who never open the Layers panel.
  const bringSelectedToFront = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitActiveTab((t) => bringElementsToFrontLayer(t, ids));
    track('Element', 'Reordered', 'Front');
  };

  const sendSelectedToBack = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitActiveTab((t) => sendElementsToBackLayer(t, ids));
    track('Element', 'Reordered', 'Back');
  };

  const setPaddingSelected = (padding: Padding) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, padding } : el)));
    track('Element', 'Changed', 'Padding');
  };

  // A Technology icon's fixed tile-size preset (spec/41). Applies to every
  // selected icon element (a no-op field elsewhere).
  const setIconSizeSelected = (iconSize: IconSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon' ? { ...el, iconSize } : el,
      ),
    );
    track('Element', 'Changed', 'IconSize');
  };

  // Set arrow-only field(s) on every selected arrow. The straightforward
  // per-field arrow setters share this; setArrowStyleSelected stays separate
  // because it also has to drop curvePoints.

  // Toggle the header row / column band on the selected table(s).
  // Toggle a boolean structure flag on every selected table. The three table
  // toggles differ only in the field + telemetry type, so they share one body.
  const toggleTableFlag = (
    field: 'headerRow' | 'headerColumn' | 'zebra',
    telemetryType: 'TableHeaderRow' | 'TableHeaderColumn' | 'TableZebra',
  ) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    track('Element', 'Toggled', telemetryType);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'table' ? { ...el, [field]: !el[field] } : el,
      ),
    );
  };
  const setTableHeaderRowSelected = () => toggleTableFlag('headerRow', 'TableHeaderRow');
  const setTableZebraSelected = () => toggleTableFlag('zebra', 'TableZebra');
  const setTableHeaderColumnSelected = () => toggleTableFlag('headerColumn', 'TableHeaderColumn');

  // Animated elements (spec/09). A looping animation on the selected boxed
  // element(s); `null` clears it. Arrows take a separate `flow` (marching
  // dashes / travelling dot).
  const setAnimationSelected = (value: ElementAnimation | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, animation: value ?? undefined } : el,
      ),
    );
    track('Element', 'Changed', 'Animation');
  };
  // Per-icon glyph animation (spec/09), gated to icon shapes — its own set
  // instead of the boxed-element animation. The animation + its loop speed
  // differ only in the patched field, so they share one body.
  const setIconFieldSelected = (patch: Partial<ShapeElement>) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon' ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', 'IconAnimation');
  };
  // `null` clears the animation.
  const setIconAnimationSelected = (value: IconAnimation | null) =>
    setIconFieldSelected({ iconAnimation: value ?? undefined });
  // Loop speed (slow / normal / fast), mirroring setAnimationSpeedSelected.
  const setIconAnimationSpeedSelected = (value: AnimationSpeed) =>
    setIconFieldSelected({ iconAnimationSpeed: value });
  const setAnimationSpeedSelected = (value: AnimationSpeed) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, animationSpeed: value } : el)),
    );
    track('Element', 'Changed', 'AnimationSpeed');
  };
  const setFlowSpeedSelected = (value: AnimationSpeed) =>
    setArrowFieldSelected({ flowSpeed: value }, 'FlowSpeed');
  // Repeat toggles (spec/09): true (the default) loops the animation, false
  // plays it once and holds. Stored as `undefined` when true so the common
  // case adds no field to the element.
  const setAnimationRepeatSelected = (value: boolean) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, animationRepeat: value ? undefined : false } : el,
      ),
    );
    track('Element', 'Changed', 'AnimationRepeat');
  };
  const setIconAnimationRepeatSelected = (value: boolean) =>
    setIconFieldSelected({ iconAnimationRepeat: value ? undefined : false });
  const setFlowRepeatSelected = (value: boolean) =>
    setArrowFieldSelected({ flowRepeat: value ? undefined : false }, 'FlowRepeat');

  return {
    toggleLockSelected,
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setTextSizeSelected,
    setTextAlignSelected,
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    setPaddingSelected,
    setIconSizeSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setTableHeaderFillSelected,
    setTableHeaderTextColorSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
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
    applyShapeColorPresetSelected,
    resetShapeStyleSelected,
    applyArrowPresetSelected,
    resetArrowStyleSelected,
    setAnimationSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setAnimationSpeedSelected,
    setFlowSpeedSelected,
    setAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    resetColorsSelected,
  };
}
