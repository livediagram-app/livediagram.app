// Where an element's indicators go (docs/specs/008-canvas/element-indicators.md), worked out once
// per element so both the cluster and the label read it: the cluster to draw itself there, a
// scale-to-fit label to leave room for it.
import { useMemo } from 'react';
import {
  footerAnchor,
  indicatorRings,
  pipCornerInset,
  placeIndicators,
  type BoxedElement,
  type IndicatorBox,
} from '@livediagram/document';
import { useElementIndicatorStyle } from '@/components/canvas/ElementIndicatorStyleContext';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';
import { clusterSize, type IndicatorForm, type IndicatorItem } from './indicator-items';

export type IndicatorLayout = {
  form: IndicatorForm;
  box: IndicatorBox | null;
  // The pip's point on the outline, inset from the top-right; null when the outline gives none.
  pip: { x: number; y: number } | null;
};

/** The first form that fits: Corner, or Footer with words then without, else the pip. */
export function placeCluster(
  element: BoxedElement,
  cornerPx: number,
  items: readonly IndicatorItem[],
  style: ElementIndicatorStyle,
): IndicatorLayout {
  const rings = indicatorRings(element, cornerPx);
  const forms: Exclude<IndicatorForm, 'pip'>[] =
    style === 'corner' ? ['corner'] : ['footer', 'footer-compact'];
  const anchor = style === 'corner' ? 'top-right' : footerAnchor(element);
  for (const form of forms) {
    const size = clusterSize(items, form);
    const box = placeIndicators(rings, element.width, element.height, size, anchor);
    if (box) return { form, box, pip: null };
  }
  return { form: 'pip', box: null, pip: pipCornerInset(rings, element.width, element.height) };
}

/**
 * How far a scale-to-fit label pulls in from the top AND the bottom (so it stays centred) to clear
 * a cluster inside the element: the band the cluster takes, less the label's own padding. 0 for
 * the pip, which sits on the outline.
 */
export function labelReserveY(layout: IndicatorLayout | null, height: number, padding: number) {
  const box = layout?.box;
  if (!box) return 0;
  const band = layout.form === 'corner' ? box.y + box.height : height - box.y;
  return Math.max(0, band - padding);
}

export function useIndicatorLayout(
  element: BoxedElement,
  cornerPx: number,
  items: readonly IndicatorItem[],
): IndicatorLayout | null {
  const style = useElementIndicatorStyle();
  const shape = element.type === 'shape' ? element.shape : undefined;
  const borderRadius = element.type === 'shape' ? element.borderRadius : undefined;
  const strokeWidth = element.type === 'shape' ? element.strokeWidth : undefined;
  const layoutKey = items.map((i) => `${i.kind}${i.count ?? ''}`).join(' ');
  return useMemo(
    () => (items.length === 0 ? null : placeCluster(element, cornerPx, items, style)),
    // The outline's inputs and what the cluster holds; not the handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, element.width, element.height, cornerPx, borderRadius, strokeWidth, layoutKey, style],
  );
}
