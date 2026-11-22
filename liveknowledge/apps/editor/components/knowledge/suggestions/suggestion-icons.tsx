// Suggested edits' icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs.
import {
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideGitPullRequest,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const PrevIcon = lucideGlyph(lucideChevronLeft, 16);
export const NextIcon = lucideGlyph(lucideChevronRight, 16);
export const CloseIcon = lucideGlyph(lucideX, 16);
export const CheckIcon = lucideGlyph(lucideCheck, 14);
export const SuggestionMarkIcon = lucideGlyph(lucideGitPullRequest, 14);
