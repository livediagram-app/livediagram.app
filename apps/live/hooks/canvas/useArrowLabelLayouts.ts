// The canvas's arrow label pass (docs/specs/008-canvas/arrow-labels.md): every label laid
// out once per element change, by the same engine the export uses, and handed
// to each ArrowView.
//
// Labels see each other, so one element change can move any label; but most
// changes move none. ArrowView's memo compares its render by value
// (sameLabelRender), so an arrow whose label did not move does not re-render.

import { useMemo, useState } from 'react';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import {
  DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS,
  arrowLabelFontStack,
  arrowLabelPass,
  layoutArrowLabel,
  type ArrowElement,
  type ArrowLabelLayout,
  type ArrowLabelLayoutOptions,
  type Element,
  type ElementId,
  type Rect,
} from '@livediagram/document';

export type ArrowLabelRender = { layout: ArrowLabelLayout | null; knockouts: Rect[] };

const NONE: ArrowLabelRender = { layout: null, knockouts: [] };

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export function sameLabelRender(a: ArrowLabelRender, b: ArrowLabelRender): boolean {
  if (a.knockouts.length !== b.knockouts.length) return false;
  if (!a.knockouts.every((k, i) => sameRect(k, b.knockouts[i]!))) return false;
  const x = a.layout;
  const y = b.layout;
  if (x === y) return true;
  if (!x || !y) return false;
  return (
    x.mode === y.mode &&
    x.center.x === y.center.x &&
    x.center.y === y.center.y &&
    x.width === y.width &&
    x.height === y.height &&
    x.fontPx === y.fontPx &&
    x.lines.length === y.lines.length &&
    x.lines.every((l, i) => l === y.lines[i]) &&
    sameRect(x.knockout, y.knockout)
  );
}

export function useArrowLabelLayouts(
  elements: Element[],
  hasArrows: boolean,
  tabFont: string | undefined,
  // Re-lay out once webfonts land: labels measured in a fallback face wrap
  // differently to the real one.
  fontsReady: boolean,
  options: Partial<ArrowLabelLayoutOptions> = {},
) {
  // `options` arrives as a fresh object every render. Hold one per value (by
  // its JSON), so the layout below re-runs only when the options change.
  const optionsKey = JSON.stringify(options);
  const [heldOptions, setHeldOptions] = useState({ key: optionsKey, options });
  if (heldOptions.key !== optionsKey) setHeldOptions({ key: optionsKey, options });
  const stableOptions = heldOptions.key === optionsKey ? heldOptions.options : options;
  const renders = useMemo(() => {
    const next = new Map<ElementId, ArrowLabelRender>();
    if (!hasArrows) return next;
    const fontFamilyOf = (a: ArrowElement) => arrowLabelFontStack(a, tabFont);
    // The font epoch makes words measured in a fallback face measure again once webfonts land.
    const pass = arrowLabelPass(elements, {
      ...stableOptions,
      fontFamilyOf,
      fontEpoch: fontsReady ? 1 : 0,
    });
    for (const el of elements) {
      if (el.type !== 'arrow') continue;
      const knockouts = pass.knockoutsOf(el.id);
      const layout = pass.layouts.get(el.id) ?? null;
      if (layout || knockouts.length > 0) next.set(el.id, { layout, knockouts });
    }
    return next;
  }, [elements, hasArrows, tabFont, fontsReady, stableOptions]);

  // Lays out an arrow's label for text being typed, against the other labels
  // as placed, so the editor sits and wraps where the label will land.
  const latestDraftLayout = useMemo(() => {
    const claimed = (id: ElementId) =>
      [...renders]
        .filter(([other]) => other !== id)
        .flatMap(([, r]) => (r.layout ? [r.layout.knockout ?? labelPlate(r.layout)] : []));
    return (arrow: ArrowElement, text: string): ArrowLabelLayout | null =>
      layoutArrowLabel(arrow, text, {
        elements,
        claimed: claimed(arrow.id),
        options: {
          ...DEFAULT_ARROW_LABEL_LAYOUT_OPTIONS,
          ...stableOptions,
          fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont),
          fontEpoch: fontsReady ? 1 : 0,
        },
      });
  }, [renders, elements, tabFont, stableOptions, fontsReady]);
  // One identity for the editor's lifetime, laying out against the newest pass, so every ArrowView's
  // memo holds across element changes (docs/specs/008-canvas/canvas-performance.md).
  const { draftLayout } = useStableHandlers({ draftLayout: latestDraftLayout });

  // Stable per layout pass: the selection derivation is memoised on it.
  return useMemo(
    () => ({
      renderOf: (id: ElementId): ArrowLabelRender => renders.get(id) ?? NONE,
      // Where an arrow's label is drawn, if it has one: the toolbars clear it
      // as part of its arrow.
      labelRectOf: (id: ElementId): Rect | null => {
        const layout = renders.get(id)?.layout;
        return layout ? labelPlate(layout) : null;
      },
      draftLayout,
    }),
    [renders, draftLayout],
  );
}

export type ArrowLabels = ReturnType<typeof useArrowLabelLayouts>;

// The label's drawn box: its plate, centred on the label anchor.
export function labelPlate(l: ArrowLabelLayout): Rect {
  return {
    x: l.center.x - l.width / 2,
    y: l.center.y - l.height / 2,
    width: l.width,
    height: l.height,
  };
}
