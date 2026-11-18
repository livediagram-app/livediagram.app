// Whether a text colour reads where the words sit (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one copy for every product, @liveworkspace/element-model/text-contrast, bound here to this model's pages
// and layers: text with nothing painted under it reads on its page's background.
import { textGroundIn, type TextGround } from '@liveworkspace/element-model/text-contrast';
import type { CanvasSurface } from './colors';
import { layerBands } from './layers';
import { layOutPages, pagesOf, rowPageAt } from './page';
import { pageGroundUnder } from './page-ink-ground';
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
  pages?: unknown;
  pageOrientation?: unknown;
  layers?: Tab['layers'];
};

/**
 * What the element's label is read against: its own fill; else the topmost element painted before it whose box
 * holds its centre and covers it (a filled box, a sticky note); else its page's background under it. Null where that
 * can't be judged: a picture (a page's picture background, an image or widget under it), or off every page.
 */
export function textGroundOf(
  el: BoxedElement,
  tab: GroundTab,
  surface: CanvasSurface,
): TextGround | null {
  const painted = layerBands(tab.elements, tab.layers).flatMap((b) => b.elements);
  return textGroundIn(el, painted, surface, (box) => {
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const page = rowPageAt(layOutPages(pagesOf(tab)), centre);
    if (!page || page.background?.fill?.kind === 'image') return null;
    return { tones: pageGroundUnder(page.background, page.rect, box).tones, on: 'page' };
  });
}
