// Where an element's indicators go (docs/specs/008-canvas/element-indicators.md), worked out once
// per element so both the cluster and the content read it: the cluster to draw itself there, the
// content (label and inline icon) to move out of its way when it would sit underneath.
import { useMemo } from 'react';
import {
  centredIndicators,
  contentBox,
  contentShift,
  footerAnchor,
  indicatorRings,
  pipInset,
  placeIndicators,
  topAnchor,
  type BoxedElement,
  type IndicatorBox,
} from '@livediagram/document';
import { useElementIndicatorStyle } from '@/components/canvas/ElementIndicatorStyleContext';
import type { ElementIndicatorStyle } from '@/lib/element-indicator-style';
import { clusterSize, type IndicatorForm, type IndicatorItem } from './indicator-items';

// What the cluster needs to know about the content: everything contentBox reads but the size.
export type ContentLayout = Omit<Parameters<typeof contentBox>[0], 'width' | 'height'>;

// How far the content area pulls in from the element's top and bottom.
export type ContentInset = { top: number; bottom: number };

export type IndicatorLayout = {
  form: IndicatorForm;
  box: IndicatorBox | null;
  // The pip's point on the outline, inset from the top-right; null when the outline gives none.
  pip: { x: number; y: number } | null;
  // Where the content moves to clear the cluster; zero when it already does.
  inset: ContentInset;
};

const NO_INSET: ContentInset = { top: 0, bottom: 0 };

/**
 * The first form that fits: Top, or Footer with words then without, else the pip. Each form first
 * tries a spot clear of the content; failing that, a spot clear of the middle band with the
 * content moved out of the way; failing both, the next form.
 */
export function placeCluster(
  element: BoxedElement,
  cornerPx: number,
  items: readonly IndicatorItem[],
  style: Exclude<ElementIndicatorStyle, 'off'>,
  content: ContentLayout | null = null,
): IndicatorLayout {
  const { width, height } = element;
  const fixed = content ? contentBox({ width, height, ...content }) : null;
  const rings = indicatorRings(element, cornerPx);
  const footer = style === 'footer';
  const forms: Exclude<IndicatorForm, 'pip'>[] = footer ? ['footer', 'footer-compact'] : ['top'];
  const anchor = footer ? footerAnchor(element) : topAnchor(element);
  for (const form of forms) {
    const size = clusterSize(items, form);
    if (fixed) {
      const clear = placeIndicators(rings, width, height, size, anchor, fixed);
      if (clear) return { form, box: clear, pip: null, inset: NO_INSET };
    }
    const box = placeIndicators(rings, width, height, size, anchor);
    if (!box) continue;
    if (!fixed) {
      // A scale-to-fit label pulls in from both sides by the band the cluster takes, so it shrinks
      // and stays centred.
      const band = Math.max(
        0,
        (footer ? height - box.y : box.y + box.height) - (content?.padding ?? 0),
      );
      return { form, box, pip: null, inset: { top: band, bottom: band } };
    }
    const shift = contentShift(box, fixed, height, content!.padding, content!.alignY, footer);
    if (shift) return { form, box, pip: null, inset: shift };
  }
  const pip = pipInset(rings, width, height, centredIndicators(element));
  return { form: 'pip', box: null, pip, inset: NO_INSET };
}

export function useIndicatorLayout(
  element: BoxedElement,
  cornerPx: number,
  items: readonly IndicatorItem[],
  content: ContentLayout | null = null,
): IndicatorLayout | null {
  const style = useElementIndicatorStyle();
  const shape = element.type === 'shape' ? element.shape : undefined;
  const borderRadius = element.type === 'shape' ? element.borderRadius : undefined;
  const strokeWidth = element.type === 'shape' ? element.strokeWidth : undefined;
  const layoutKey = items.map((i) => `${i.kind}${i.count ?? ''}`).join(' ');
  const icon = content?.icon;
  return useMemo(
    // Off draws nothing, so the content keeps its whole box too.
    () =>
      items.length === 0 || style === 'off'
        ? null
        : placeCluster(element, cornerPx, items, style, content),
    // The outline's inputs, the content's and what the cluster holds; not the handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shape,
      element.width,
      element.height,
      cornerPx,
      borderRadius,
      strokeWidth,
      layoutKey,
      style,
      content?.label,
      content?.textSize,
      content?.padding,
      content?.alignX,
      content?.alignY,
      content?.fontPx,
      icon?.size,
      icon?.position,
      icon?.gap,
    ],
  );
}
