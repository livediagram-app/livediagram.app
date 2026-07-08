'use client';

import { useMemo } from 'react';
import {
  contentBounds,
  isBoxed,
  layerBands,
  layerOpacityOf,
  r2,
  svgArrow,
  svgBoxed,
  type Element,
  type Layer,
} from '@livediagram/diagram';
import { resolveIconArtLoaded } from '@/lib/icon-registry';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

// Per-layer preview markup (spec/74), shared by the Layers panel rows and
// the context menu's Move-to-layer tiles: the SAME headless renderer the
// Map / exports use, split into one markup string per layer. Every
// preview shares the whole tab's content bounds as its viewBox, so each
// layer's elements show where they actually sit. Hidden layers keep
// their preview (that's how you see what you're missing); a layer's
// opacity dims it. The markup is our own renderer's output (user text is
// xmlEscaped inside it), so injecting it via an <svg> is safe.
export function useLayerThumbnails(
  elements: Element[],
  layers: Layer[],
): { thumbMarkup: Map<string, string>; thumbViewBox: string | null } {
  // Re-render once the async icon catalogues land so icon glyphs pop in.
  const iconsLoaded = useIconCatalogs();
  return useMemo(() => {
    if (elements.length === 0) {
      return { thumbMarkup: new Map<string, string>(), thumbViewBox: null };
    }
    const markup = new Map<string, string>();
    for (const band of layerBands(elements, layers, { includeHidden: true })) {
      const parts: string[] = [];
      for (const el of band.elements) {
        if (el.type !== 'arrow' && isBoxed(el)) {
          parts.push(svgBoxed(el, undefined, resolveIconArtLoaded));
        }
      }
      for (const el of band.elements) {
        if (el.type === 'arrow') parts.push(svgArrow(el, elements));
      }
      const opacity = layerOpacityOf(band.layer);
      markup.set(
        band.layer.id,
        opacity < 1 ? `<g opacity="${r2(opacity)}">${parts.join('')}</g>` : parts.join(''),
      );
    }
    const b = contentBounds(elements);
    const pad = 8;
    return {
      thumbMarkup: markup,
      thumbViewBox: `${r2(b.x - pad)} ${r2(b.y - pad)} ${r2(b.w + pad * 2)} ${r2(b.h + pad * 2)}`,
    };
    // iconsLoaded re-runs the build when the catalogue chunk lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, layers, iconsLoaded]);
}
