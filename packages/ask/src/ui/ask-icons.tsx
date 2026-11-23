'use client';

// Ask AI's glyphs, from the shared lucide set.
import {
  lucideArrowRight,
  lucideArrowUp,
  lucideCheck,
  lucideChevronUp,
  lucideCopy,
  lucideKey,
  lucideLogIn,
  lucideSquare,
  lucideTriangleAlert,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

export const SendIcon = /* @__PURE__ */ lucideGlyph(lucideArrowUp, 16);
export const StopIcon = /* @__PURE__ */ lucideGlyph(lucideSquare, 12);
export const CopyIcon = /* @__PURE__ */ lucideGlyph(lucideCopy, 15);
export const CopiedIcon = /* @__PURE__ */ lucideGlyph(lucideCheck, 15);
export const KeyIcon = /* @__PURE__ */ lucideGlyph(lucideKey, 13);
export const AlertIcon = /* @__PURE__ */ lucideGlyph(lucideTriangleAlert, 13);
export const MenuChevronIcon = /* @__PURE__ */ lucideGlyph(lucideChevronUp, 13);
export const GoIcon = /* @__PURE__ */ lucideGlyph(lucideArrowRight, 14);
export const SignInIcon = /* @__PURE__ */ lucideGlyph(lucideLogIn, 15);
