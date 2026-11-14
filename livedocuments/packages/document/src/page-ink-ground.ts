// What an element on a page sits on, as re-inking measures it (docs/specs/007-editor/pages-mode.md "Re-inking"):
// one copy for every product, @liveworkspace/element-model/page-ink-ground, bound to this model's fill tone.
import { pageGroundFor } from '@liveworkspace/element-model/page-ink-ground';
import { pageFillTone } from './page-content';

export {
  PAPER_TONE,
  gradientPosition,
  type PageGround,
} from '@liveworkspace/element-model/page-ink-ground';

/** The page's tones under a box, for a page whose background is `background` and whose rectangle is `rect`. */
export const pageGroundUnder = pageGroundFor(pageFillTone);
