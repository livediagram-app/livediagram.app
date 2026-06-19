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
  clampPercent,
  isBoxed,
  isProgressShape,
  sendManyToBack,
  SHAPE_DEFAULT_SIZE,
  supportsBorder,
  type ArrowElement,
  type ArrowEnds,
  type ArrowheadShape,
  type ArrowheadSize,
  type AnimationSpeed,
  type ArrowFlow,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type ElementAnimation,
  type IconAnimation,
  type ProgressAnim,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type Padding,
  type ShapeElement,
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

  // Debounced field write shared by the colour / opacity pickers: goes
  // straight through commitTabs (bypassing commit's per-tick emitChange,
  // see the file header) with a single debounced change-log entry, so
  // dragging a picker doesn't spam the realtime channel. `update` maps one
  // already-selected element, returning it unchanged for the element types
  // the field doesn't apply to.
  const commitSelectedStyle = (logField: string, update: (el: Element) => Element) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: t.elements.map((el) => (ids.has(el.id) ? update(el) : el)) }
          : t,
      ),
    );
    scheduleElementChangeLog(logField);
  };

  const setFillColorSelected = (color: string) =>
    commitSelectedStyle('fillColor', (el) =>
      el.type === 'shape' || el.type === 'sticky' || el.type === 'freehand' || el.type === 'table'
        ? { ...el, fillColor: color }
        : el,
    );

  const setStrokeColorSelected = (color: string) =>
    commitSelectedStyle('strokeColor', (el) =>
      el.type === 'shape' ||
      el.type === 'sticky' ||
      el.type === 'arrow' ||
      el.type === 'freehand' ||
      el.type === 'table'
        ? { ...el, strokeColor: color }
        : el,
    );

  const setTextColorSelected = (color: string) =>
    commitSelectedStyle('textColor', (el) =>
      isBoxed(el) || el.type === 'arrow' ? { ...el, textColor: color } : el,
    );

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

  // Set arrow-only field(s) on every selected arrow. The straightforward
  // per-field arrow setters share this; setArrowStyleSelected stays separate
  // because it also has to drop curvePoints.
  const setArrowFieldSelected = (patch: Partial<ArrowElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, ...patch } : el)),
    );
    track('Element', 'Changed', telemetryType);
  };

  const setArrowEndsSelected = (arrowEnds: ArrowEnds) =>
    setArrowFieldSelected({ arrowEnds }, 'ArrowEnds');

  const setArrowThicknessSelected = (thickness: ArrowThickness) =>
    setArrowFieldSelected({ strokeWidth: ARROW_THICKNESS_PX[thickness] }, 'ArrowThickness');

  const setArrowheadSizeSelected = (size: ArrowheadSize) =>
    setArrowFieldSelected({ arrowheadSize: size }, 'ArrowheadSize');

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

  const setArrowStyleSelected = (style: ArrowStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!(ids.has(el.id) && el.type === 'arrow')) return el;
        // Start the arrow from the new style's clean default shape. The
        // multi-bend control points are shared by the curved (spline) and
        // angled (polyline) renderers, so carried across a style switch they
        // draw a stray polyline whose final segment no longer ends at the
        // element (the arrowhead detaches into a stray bend). Drop them on an
        // explicit style change; adding/moving a point keeps the style as
        // before. The single-bow / single-elbow offsets are each style-local,
        // so they can stay harmlessly.
        const { curvePoints: _drop, ...rest } = el;
        return { ...rest, arrowStyle: style };
      }),
    );
    track('Element', 'Changed', 'ArrowStyle');
  };

  const setArrowheadShapeSelected = (shape: ArrowheadShape) =>
    setArrowFieldSelected({ arrowheadShape: shape }, 'ArrowheadShape');

  // Line pattern (solid / dashed / dotted) on the selected arrow.
  // Reuses the BorderStyle union shapes already carry so future
  // pattern additions (e.g. 'long-dash') just need a single
  // BORDER_DASH_ARRAY entry to light up both surfaces.
  const setArrowStrokeStyleSelected = (style: BorderStyle) =>
    setArrowFieldSelected({ strokeStyle: style }, 'ArrowLineStyle');

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
    track('Element', 'Changed', 'ShapeMorph');
  };

  // Reset the selected shape to its kind's default aspect ratio. The
  // proportion comes from SHAPE_DEFAULT_SIZE (the canonical look each
  // shape ships with); we keep the element's current visual area so it
  // doesn't jump in size, just snaps the width:height back to default,
  // and recentre about the old centre so it doesn't drift.
  const resetAspectRatioSelected = () => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) => {
        if (el.id !== selectedId || el.type !== 'shape') return el;
        const def = SHAPE_DEFAULT_SIZE[el.shape];
        const ratio = def.width / def.height;
        const area = el.width * el.height;
        const height = Math.round(Math.sqrt(area / ratio));
        const width = Math.round(height * ratio);
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        return { ...el, width, height, x: cx - width / 2, y: cy - height / 2 };
      }),
    );
    track('Element', 'Changed', 'AspectRatioReset');
  };

  // Set the selected element's rotation to a fixed angle (degrees clockwise
  // about its centre), normalised to 0..359. Drives the context menu's
  // Rotation category — the freeform rotate handle still covers arbitrary
  // angles; these are the common snap points. Boxed elements only.
  const setRotationSelected = (deg: number) => {
    if (!selectedId) return;
    const next = ((Math.round(deg) % 360) + 360) % 360;
    commit((els) =>
      els.map((el) =>
        el.id === selectedId && isBoxed(el)
          ? { ...el, rotation: next === 0 ? undefined : next }
          : el,
      ),
    );
    track('Element', 'Changed', 'Rotation');
  };

  // Border-preset setters. Each writes the field on any element
  // that `supportsBorder` accepts (today: shapes + the freehand
  // pen tool); non-supporting elements are ignored. Routing
  // through the shared predicate keeps the four call sites of
  // this rule (these two setters plus the matching Canvas
  // paletteSelection.borderStroke / borderStyle derivations) in
  // step when a future element variant gains a border.
  // Border presets apply to every border-bearing member of the selection
  // (currentSelectionIds is just {selectedId} for a single select, so this
  // is unchanged there but also drives the multi-selection menu).
  const setBorderStrokeSelected = (value: BorderStroke) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (supportsBorder(el) || el.type === 'table')
          ? { ...el, strokeWidth: value }
          : el,
      ),
    );
    track('Element', 'Changed', 'BorderStroke');
  };
  const setBorderStyleSelected = (value: BorderStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (supportsBorder(el) || el.type === 'table')
          ? { ...el, strokeStyle: value }
          : el,
      ),
    );
    track('Element', 'Changed', 'BorderStyle');
  };
  const setBorderRadiusSelected = (value: BorderRadius) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' ? { ...el, borderRadius: value } : el,
      ),
    );
    track('Element', 'Changed', 'BorderRadius');
  };

  // Style presets (spec/48). One-click looks for the selected shape(s),
  // applied in a single history step (unlike the per-field setters above, a
  // preset writes fill+stroke+text — or width+style+radius — at once).
  // Colour and border presets are independent: each touches only its own
  // fields so the two combine. Shapes only.
  const applyShapeColorPresetSelected = (preset: {
    fill: string;
    stroke: string;
    text: string;
  }) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape'
          ? { ...el, fillColor: preset.fill, strokeColor: preset.stroke, textColor: preset.text }
          : el,
      ),
    );
    track('Element', 'Changed', 'StylePreset');
  };
  const applyShapeBorderPresetSelected = (preset: {
    stroke: BorderStroke;
    style: BorderStyle;
    radius: BorderRadius;
  }) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape'
          ? {
              ...el,
              strokeWidth: preset.stroke,
              strokeStyle: preset.style,
              borderRadius: preset.radius,
            }
          : el,
      ),
    );
    track('Element', 'Changed', 'BorderPreset');
  };
  // Reset a preset-styled shape back to its theme default: colour overrides
  // fall back to the theme (mirroring resetColorsSelected's shape branch) and
  // the border weight / pattern / radius overrides are cleared. One step.
  const resetShapeStyleSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const theme = getTheme(activeTab.theme);
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || el.type !== 'shape') return el;
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
          strokeWidth: undefined,
          strokeStyle: undefined,
          borderRadius: undefined,
        };
      }),
    );
    track('Element', 'Changed', 'StyleReset');
  };

  // Arrow style presets (spec/48). A one-click line look — pattern + thickness
  // + optional flow animation — applied in a single step. A preset without a
  // `flow` clears any existing animation; one with a flow defaults its speed to
  // normal when the arrow had none. Arrows only.
  const applyArrowPresetSelected = (preset: {
    style: BorderStyle;
    thickness: ArrowThickness;
    flow?: ArrowFlow;
  }) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const px = ARROW_THICKNESS_PX[preset.thickness];
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'arrow'
          ? {
              ...el,
              strokeStyle: preset.style,
              strokeWidth: px,
              flow: preset.flow,
              flowSpeed: preset.flow ? (el.flowSpeed ?? 'normal') : el.flowSpeed,
            }
          : el,
      ),
    );
    track('Element', 'Changed', 'ArrowPreset');
  };
  // Reset a preset-styled arrow: drop its line pattern / thickness / flow
  // overrides so it falls back to the defaults. One step.
  const resetArrowStyleSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || el.type !== 'arrow') return el;
        const { strokeWidth: _w, strokeStyle: _s, flow: _f, flowSpeed: _fs, ...rest } = el;
        return rest as typeof el;
      }),
    );
    track('Element', 'Changed', 'StyleReset');
  };

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
  const setArrowFlowSelected = (value: ArrowFlow | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'arrow' ? { ...el, flow: value ?? undefined } : el,
      ),
    );
    track('Element', 'Changed', 'ArrowFlow');
  };
  // Per-icon glyph animation (spec/09). Applies only to icon shapes; `null`
  // clears it. Icons use this set instead of the boxed-element animation set.
  const setIconAnimationSelected = (value: IconAnimation | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon'
          ? { ...el, iconAnimation: value ?? undefined }
          : el,
      ),
    );
    track('Element', 'Changed', 'IconAnimation');
  };
  // Loop speed for an icon's animation (slow / normal / fast), mirroring
  // setAnimationSpeedSelected for boxed elements.
  const setIconAnimationSpeedSelected = (value: AnimationSpeed) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon'
          ? { ...el, iconAnimationSpeed: value }
          : el,
      ),
    );
    track('Element', 'Changed', 'IconAnimation');
  };
  // Progress elements (spec/46): the percentage + how its fill animates, all
  // gated to progress shapes. The four setters differ only in the patched
  // field + telemetry type, so they share one body.
  const setProgressFieldSelected = (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && isProgressShape(el.shape)
          ? { ...el, ...patch }
          : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
  const setProgressSelected = (value: number) =>
    setProgressFieldSelected({ progress: clampPercent(value) }, 'Progress');
  const setProgressAnimSelected = (value: ProgressAnim | null) =>
    setProgressFieldSelected({ progressAnim: value ?? undefined }, 'ProgressAnim');
  const setProgressAnimSpeedSelected = (value: AnimationSpeed) =>
    setProgressFieldSelected({ progressAnimSpeed: value }, 'ProgressAnim');
  const setProgressAnimRepeatSelected = (value: boolean) =>
    setProgressFieldSelected({ progressAnimRepeat: value }, 'ProgressAnim');
  const setAnimationSpeedSelected = (value: AnimationSpeed) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, animationSpeed: value } : el)),
    );
    track('Element', 'Changed', 'AnimationSpeed');
  };
  const setFlowSpeedSelected = (value: AnimationSpeed) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, flowSpeed: value } : el)),
    );
    track('Element', 'Changed', 'FlowSpeed');
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
    applyShapeColorPresetSelected,
    applyShapeBorderPresetSelected,
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
