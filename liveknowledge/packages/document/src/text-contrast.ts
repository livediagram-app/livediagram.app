// Whether a text colour reads where the words sit (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): one copy for every product, @liveworkspace/element-model/text-contrast, bound here to this model's pages
// and layers: text with nothing painted under it reads on its page's background.
import { pagedTextGroundFor } from '@liveworkspace/element-model/text-ground-pages';
import { layerBands } from './layers';
import { layOutPages, pagesOf, rowPageAt } from './page';
import { pageGroundUnder } from './page-ink-ground';

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

/**
 * What the element's label is read against: its own fill; else the topmost element painted before it whose box
 * holds its centre and covers it (a filled box, a sticky note); else its page's background under it. Null where that
 * can't be judged: a picture (a page's picture background, an image or widget under it), or off every page.
 */
export const textGroundOf = pagedTextGroundFor({
  layerBands,
  pagesOf,
  layOutPages,
  rowPageAt,
  pageGroundUnder,
});
