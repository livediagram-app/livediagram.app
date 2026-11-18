// Whether a text colour reads where the words sit (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one copy for every product, @liveworkspace/element-model/text-contrast, bound here to this model's
// canvas: text with nothing painted under it reads on the tab's canvas colour. A diagram has no pages, so it is judged
// as saved: on the canvas colour it stores (the paper by default), its boxes' default fills for that canvas, whichever
// appearance the person sees it in.
import { DEFAULT_BACKGROUND_COLOR } from '@liveworkspace/model-core/canvas-colors';
import { canvasSurface, normaliseHex } from '@liveworkspace/element-model/colour-math';
import { textGroundIn, type TextGround } from '@liveworkspace/element-model/text-contrast';
import { layerBands } from './layers';
import type { BoxedElement, Tab } from './index';

export {
  cellTextGround,
  cellTextSize,
  isLargeText,
  labelDrawnPx,
  labelIsBold,
  LARGE_BOLD_TEXT_PX,
  LARGE_TEXT_CONTRAST,
  LARGE_TEXT_PX,
  TEXT_CONTRAST,
  textContrast,
  type TextContrast,
  type TextGround,
} from '@liveworkspace/element-model/text-contrast';

// The picker's probes over this model's grounds, and their cache: bound in the editor's lib/text-contrast-probe.ts.
export {
  textContrastProbesFor,
  type TextContrastProbe,
  type TextProbeModel,
} from '@liveworkspace/element-model/text-contrast-probe';
export {
  textGroundMemo as textGroundMemoFor,
  type GroundOf as TextGroundOf,
  type ProbeTab as TextProbeTab,
} from '@liveworkspace/element-model/text-ground-memo';

type GroundTab = Pick<Tab, 'elements'> & {
  layers?: Tab['layers'];
  backgroundColor?: unknown;
};

/** The canvas colour a tab is saved with, as `#rrggbb`: its own, else the paper. Null for one that can't be read. */
export function savedCanvasTone(tab: { backgroundColor?: unknown }): string | null {
  const stored = typeof tab.backgroundColor === 'string' ? tab.backgroundColor : undefined;
  return normaliseHex(stored ?? DEFAULT_BACKGROUND_COLOR);
}

/**
 * What the element's label is read against: its own fill; else the topmost element painted before it whose box
 * holds its centre and covers it (a filled box, a sticky note); else the tab's canvas. Null where that can't be
 * judged: an image or widget under it, or a canvas colour that can't be read.
 */
export function textGroundOf(el: BoxedElement, tab: GroundTab): TextGround | null {
  const canvas = savedCanvasTone(tab);
  if (!canvas) return null;
  const painted = layerBands(tab.elements, tab.layers).flatMap((b) => b.elements);
  return textGroundIn(el, painted, canvasSurface(canvas), () => ({
    tones: [canvas],
    on: 'canvas',
  }));
}
