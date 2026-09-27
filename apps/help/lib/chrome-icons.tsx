import {
  lucideArrowRight,
  lucideChevronUp,
  lucideClock,
  lucideExternalLink,
  lucideFile,
  lucideInfo,
  lucideLightbulb,
  lucideMail,
  lucideTextAlignStart,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// The help centre's own chrome icons (docs/specs/004-interface-design/iconography.md). Icons shared with
// another app live in @livediagram/ui instead (CloseIcon, SearchIcon).
export const ClockIcon = lucideGlyph(lucideClock, 14);
export const ContentsIcon = lucideGlyph(lucideTextAlignStart, 16);
export const ChevronUpIcon = lucideGlyph(lucideChevronUp, 16);
export const FileIcon = lucideGlyph(lucideFile, 12);
export const ArrowRightIcon = lucideGlyph(lucideArrowRight, 14);
export const MailIcon = lucideGlyph(lucideMail, 16);
export const ExternalLinkIcon = lucideGlyph(lucideExternalLink, 16);
export const TipIcon = lucideGlyph(lucideLightbulb, 20);
export const NoteIcon = lucideGlyph(lucideInfo, 20);
