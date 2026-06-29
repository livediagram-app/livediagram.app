import {
  ARROW_THICKNESS_PX,
  type ArrowElement,
  type ArrowEnds,
  type ArrowFlow,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderStyle,
  type Element,
} from '@livediagram/diagram';
import { applyArrowPresetToEl } from '@/lib/style-presets';
import { track } from '@/lib/telemetry';

type ArrowStyleSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
};

// The selection-wide arrow styling setters (ends / thickness / arrowhead /
// line style / curve style / flow + the one-click presets and reset). All
// resolve the current selection and commit through the two shared handles, so
// they live together off the main useElementStyle hook.
export function useArrowStyleSetters({ currentSelectionIds, commit }: ArrowStyleSetterDeps) {
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
    commit((els) => els.map((el) => (ids.has(el.id) ? applyArrowPresetToEl(el, preset) : el)));
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

  const setArrowFlowSelected = (value: ArrowFlow | null) =>
    setArrowFieldSelected({ flow: value ?? undefined }, 'ArrowFlow');

  return {
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
  };
}
