import { MAX_SIZE_PX, MIN_SIZE_PX } from '@liveworkspace/workbench/lib/element-size-bounds';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  SHAPE_DEFAULT_SIZE,
  isRetiredElement,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type ShapeElement,
  type ShapeMarker,
  type Tab,
  type TextSizePreset,
} from '@livehuddle/document';
import { getTheme, type ShapeColorPreset } from '@/lib/themes';
import {
  applyRotationToEl,
  applyBorderStrokeToEl,
  applyBorderStyleToEl,
  applyColorPresetToEl,
  isStyleable,
} from '@/lib/style-presets';
import { track } from '@/lib/telemetry';

type ShapeStyleSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  activeTab: Tab;
  // Read when a setter runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
};

// Bounds for a typed-in size (docs/specs/008-canvas/element-size.md), shared with the Size section.
export { MAX_SIZE_PX, MIN_SIZE_PX };
const clampSizePx = (n: number): number =>
  Math.round(Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, Number.isFinite(n) ? n : MIN_SIZE_PX)));

// The selection-wide setters for shape geometry + styling: kind (morph),
// aspect-ratio reset, rotation, border weight / pattern / radius, status
// markers, and the one-click colour / border presets and reset. All resolve
// the selection and commit through the shared handles (resetShapeStyle also
// reads the active tab's theme for its defaults). Split out of useElementStyle.
export function useShapeStyleSetters({
  currentSelectionIds,
  commit,
  activeTab,
  readSelection,
}: ShapeStyleSetterDeps) {
  // Reset the selected shape to its kind's default aspect ratio. The
  // proportion comes from SHAPE_DEFAULT_SIZE (the canonical look each
  // shape ships with); we keep the element's current visual area so it
  // doesn't jump in size, just snaps the width:height back to default,
  // and recentre about the old centre so it doesn't drift. Every shape of a multi-selection resets (the
  // multi-selection menu offers it).
  const resetAspectRatioSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") keeps its stored
        // box: its kind has no default size.
        if (!ids.has(el.id) || el.type !== 'shape' || isRetiredElement(el)) return el;
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

  // Set the selected element's size in exact pixels (docs/specs/008-canvas/element-size.md).
  //
  // Canvas pixels at 100% zoom, which is the only unit the model has — a
  // floorplan drawn at "10px per cm" is the user's own scale, and inventing a
  // units system to hold it would be a much bigger feature than a number box.
  //
  // Anchored at the TOP-LEFT, not the centre, unlike the aspect reset above.
  // Typing a width is a layout act: you want the edge you are aligned to to
  // stay put. (The aspect reset is a proportion act, where holding the centre
  // is what stops it drifting.)
  //
  // Honours the aspect lock: with it on, changing one dimension carries the
  // other, so the lock means the same thing here as it does on a drag handle.
  const setSizeSelected = (size: { width?: number; height?: number }) => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    commit((els) =>
      els.map((el) => {
        // A retired element never resizes (docs/specs/002-project-scope/blueprints/element-engine.md).
        if (el.id !== selectedId || !isStyleable(el)) return el;
        const locked = (el as { aspectLocked?: boolean }).aspectLocked === true;
        const ratio = el.height > 0 ? el.width / el.height : 1;
        let width = size.width ?? el.width;
        let height = size.height ?? el.height;
        if (locked && ratio > 0) {
          if (size.width !== undefined && size.height === undefined) {
            height = Math.round(width / ratio);
          } else if (size.height !== undefined && size.width === undefined) {
            width = Math.round(height * ratio);
          }
        }
        return {
          ...el,
          width: clampSizePx(width),
          height: clampSizePx(height),
        };
      }),
    );
    track('Element', 'Changed', 'Size');
  };

  // Set the selected element's rotation to a fixed angle (degrees clockwise
  // about its centre), normalised to 0..359. Drives the context menu's
  // Rotation category + the search palette's Rotate actions — fixed 45°
  // steps, the only way to rotate (there's no free-drag handle). Boxed
  // elements only.
  const setRotationSelected = (deg: number) => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    commit((els) => els.map((el) => (el.id === selectedId ? applyRotationToEl(el, deg) : el)));
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
    commit((els) => els.map((el) => (ids.has(el.id) ? applyBorderStrokeToEl(el, value) : el)));
    track('Element', 'Changed', 'BorderStroke');
  };
  const setBorderStyleSelected = (value: BorderStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) ? applyBorderStyleToEl(el, value) : el)));
    track('Element', 'Changed', 'BorderStyle');
  };

  // Set a field on every selected shape (any shape kind livehuddle draws: a retired one keeps what it stored). The
  // icon / progress / rating helpers gate to their specific shape kinds; this is for fields any shape can carry.
  const setShapeFieldSelected = (patch: Partial<ShapeElement>, telemetryType: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && isStyleable(el) ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', telemetryType);
  };
  // Status markers (docs/specs/009-elements/shape-markers.md). A glyph shown inside the shape, left of its
  // label; `null` clears it. `markerSize` is a TextSize preset ('scale' tracks
  // the element's text). Shapes only.
  const setMarkerSelected = (marker: ShapeMarker | null) =>
    setShapeFieldSelected({ marker: marker ?? undefined }, 'Marker');
  const setMarkerSizeSelected = (size: TextSizePreset) =>
    setShapeFieldSelected({ markerSize: size }, 'MarkerSize');

  // A preset is one complete look (docs/specs/010-palette/style-presets.md): in a single history step it writes
  // fill + stroke + text + border weight / style / radius at once (unlike the
  // per-field setters above). Shapes only.
  const applyShapeColorPresetSelected = (preset: ShapeColorPreset) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) ? applyColorPresetToEl(el, preset) : el)));
    track('Element', 'Changed', 'StylePreset');
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
          // Reset style clears the drop shadow too (docs/specs/008-canvas/element-shadows.md): the plain
          // theme look carries none.
          shadow: undefined,
          // Drop the colour-preset binding too — reset returns to the plain
          // theme look, so there's no preset to re-derive on a theme change.
          // The same for quick-swatch bindings (docs/specs/008-canvas/quick-style-panel.md).
          colorPreset: undefined,
          strokeSwatch: undefined,
          fillSwatch: undefined,
        };
      }),
    );
    track('Element', 'Changed', 'StyleReset');
  };

  return {
    resetAspectRatioSelected,
    setSizeSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    applyShapeColorPresetSelected,
    resetShapeStyleSelected,
  };
}
