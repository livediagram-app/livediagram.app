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
  bringManyToFront,
  isBoxed,
  sendManyToBack,
  type AnimationSpeed,
  type ElementAnimation,
  type IconAnimation,
  type IconSize,
  type Element,
  type Padding,
  type ShapeElement,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { applyFillColorToEl, applyStrokeColorToEl, applyTextColorToEl } from '@/lib/style-presets';
import { track } from '@/lib/telemetry';
import { useArrowStyleSetters } from './useArrowStyleSetters';
import { useDataShapeSetters } from './useDataShapeSetters';
import { useShapeStyleSetters } from './useShapeStyleSetters';

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
      els.map((el) =>
        ids.has(el.id) && (isBoxed(el) || el.type === 'arrow') ? { ...el, textSize: size } : el,
      ),
    );
    track('Element', 'Changed', 'TextSize');
  };

  // Font (spec/28). Passing a font id sets it on every text-bearing
  // member of the selection; passing null clears the override so they
  // fall back to the tab's default font.
  const setFontSelected = (font: string | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || !(isBoxed(el) || el.type === 'arrow')) return el;
        if (!font) {
          const copy = { ...el };
          delete (copy as { font?: string }).font;
          return copy;
        }
        return { ...el, font };
      }),
    );
    track('Element', 'Changed', 'Font');
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
    track('Element', 'Changed', 'TextAlign');
  };

  // Generic helper for the inline label styles. Each toggle flips the
  // matching boolean on every member of the current selection. We
  // derive the next value from the primary so a partially-applied
  // group all jumps to the same state.
  const toggleTextStyleSelected = (
    field: 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough',
  ) => {
    const primary = selectionPrimary();
    if (!primary || !(isBoxed(primary) || primary.type === 'arrow')) return;
    const next = !(primary[field] ?? false);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (isBoxed(el) || el.type === 'arrow') ? { ...el, [field]: next } : el,
      ),
    );
    // Telemetry type is the style name (Bold / Italic / Underline /
    // Strikethrough) — `field` minus its 'text' prefix, title-cased.
    track('Element', 'Toggled', field.replace(/^text/, ''));
  };

  // Debounced field write shared by the colour / opacity pickers:
  // one undoable step per gesture — the debounce window opening runs
  // the checkpoint (its token routes the flushed log entry to this
  // gesture's undo marker), then every tick mutates without history,
  // so dragging a picker doesn't spam the realtime channel or flood
  // the bounded undo stack. `update` maps one already-selected
  // element, returning it unchanged for the element types the field
  // doesn't apply to.
  const commitSelectedStyle = (logField: string, update: (el: Element) => Element) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    scheduleElementChangeLog(logField, { onWindowStart: markCheckpoint });
    tickTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: t.elements.map((el) => (ids.has(el.id) ? update(el) : el)) }
          : t,
      ),
    );
  };

  // Hand-editing any colour breaks a shape's colour-preset binding (spec/48):
  // the user has diverged from the preset, so a later theme change must NOT
  // pull the shape back onto the preset's variant. Clearing `colorPreset` on a
  // shape (a no-op field on other types) keeps that invariant in one place.
  const setFillColorSelected = (color: string) =>
    commitSelectedStyle('fillColor', (el) => applyFillColorToEl(el, color));

  const setStrokeColorSelected = (color: string) =>
    commitSelectedStyle('strokeColor', (el) => applyStrokeColorToEl(el, color));

  const setTextColorSelected = (color: string) =>
    commitSelectedStyle('textColor', (el) => applyTextColorToEl(el, color));

  // Table header-band colours (debounced like the other colour
  // pickers). Apply only to selected tables.
  const setTableHeaderFillSelected = (color: string) =>
    commitSelectedStyle('headerFill', (el) =>
      el.type === 'table' ? { ...el, headerFill: color } : el,
    );
  const setTableHeaderTextColorSelected = (color: string) =>
    commitSelectedStyle('headerTextColor', (el) =>
      el.type === 'table' ? { ...el, headerTextColor: color } : el,
    );

  const setOpacitySelected = (opacity: number) =>
    commitSelectedStyle('elementOpacity', (el) => ({ ...el, opacity }));

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
            // Reset-to-theme also drops any colour-preset binding (spec/48).
            colorPreset: undefined,
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
        if (el.type === 'table') {
          // Reset to theme grid + text; clear cell fill + header overrides.
          return {
            ...el,
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            fillColor: undefined,
            headerFill: undefined,
            headerTextColor: undefined,
          };
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
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
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
    resetColorsSelected,
  };
}
