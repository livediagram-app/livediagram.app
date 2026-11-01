// An instance's drawing on the canvas (docs/specs/009-elements/components.md "How an instance draws"): its main's
// elements, overrides applied, placed in the instance's box at (0, 0) and drawn by the export's own element drawers,
// so the canvas and every export draw an instance the same. The canvas turns the box; the drawing is unturned.
import {
  arrowLabelFontStack,
  arrowLabelPass,
  resolveInstance,
  sketchBackdropIds,
  svgArrow,
  svgBoxed,
  svgShadowDefs,
  type CanvasSurface,
  type DesignComponent,
  type ShapeElement,
  type Tab,
} from '@livedesign/design';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { exportChartInk } from './export-chart-ink';

/** The SVG markup (no outer `<svg>`) of an instance's main in its box, the box's top-left at (0, 0). Boxes first,
 *  arrows over them, as the exports paint a band. Linear in the main's elements. */
export function instanceMarkup(
  instance: ShapeElement,
  main: DesignComponent,
  tab: Pick<Tab, 'font' | 'finish' | 'theme'>,
  surface: CanvasSurface,
  paper: string,
): string {
  const placed = resolveInstance({ ...instance, x: 0, y: 0, rotation: 0, opacity: 1 }, main);
  const labels = arrowLabelPass(placed, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const backdrops = sketchBackdropIds(placed, tab.finish);
  const chartInk = exportChartInk({ theme: tab.theme, elements: placed }, undefined);
  const parts: string[] = [];
  const shadows = svgShadowDefs(placed);
  if (shadows) parts.push(shadows);
  for (const el of placed) {
    if (el.type === 'arrow') continue;
    parts.push(
      svgBoxed(el, {
        resolveIconArt: resolveIconArtLoaded,
        resolveStickerArt: resolveStickerArtLoaded,
        tabFont: tab.font,
        tabFinish: tab.finish,
        sketchBackdrop: backdrops.has(el.id),
        surface,
        ...chartInk,
      }),
    );
  }
  for (const el of placed)
    if (el.type === 'arrow')
      parts.push(
        svgArrow(el, placed, surface, tab.font, labels, undefined, placed, paper, tab.finish),
      );
  return parts.join('\n');
}
