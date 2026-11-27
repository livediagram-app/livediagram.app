// Describe a Page's hero art (docs/specs/007-editor/describe-a-page.md "The dialog"; liveworkspace/docs/specs/
// 004-index/dialog-hero-header.md), the Describe with AI family's drawing (@liveworkspace/ui/dialog-hero-art/
// describe-rule: the person's words in a speech bubble, the accent's sparkle on its corner, a dashed arrow) with an
// ending of its own: a page rising off the foot, its headline, two lines of text and a picture beside them.
import {
  DESCRIBE_INK as INK,
  DESCRIBE_PLATE as PLATE,
  describeHeroArt,
} from '@liveworkspace/ui/dialog-hero-art/describe-rule';

const PAGE = (
  <>
    <rect x="55" y="5" width="39" height="26" rx="4.5" {...PLATE} />
    <path d="M60 11.5h18" {...INK} />
    <path d="M60 18.5h12M60 24h9" {...INK} stroke="var(--hero-line)" strokeWidth="1.6" />
    <rect x="76.5" y="16" width="12.5" height="10.5" rx="2.2" fill="var(--hero-wash)" />
    <path d="M78.5 24.5l3-3.2 2.2 2.2 1.6-1.6 1.9 2.6" {...INK} strokeWidth="1.3" />
  </>
);

export const describePageHeroArt = describeHeroArt('describe-page', PAGE);
