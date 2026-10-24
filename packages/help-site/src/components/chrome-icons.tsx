import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideChevronUp,
  lucideClock,
  lucideExternalLink,
  lucideFile,
  lucideInfo,
  lucideLightbulb,
  lucideMail,
  lucideMessageCircle,
  lucideSearch,
  lucideTextAlignStart,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';

// The help centre's chrome icons (docs/specs/004-interface-design/iconography.md in each product), on the
// shared Glyph base. Search and Close match the product ui packages' SearchIcon and CloseIcon glyph for glyph.
export const ClockIcon = lucideGlyph(lucideClock, 14);
export const ContentsIcon = lucideGlyph(lucideTextAlignStart, 16);
export const ChevronUpIcon = lucideGlyph(lucideChevronUp, 16);
export const FileIcon = lucideGlyph(lucideFile, 12);
export const ArrowRightIcon = lucideGlyph(lucideArrowRight, 14);
export const ArrowLeftIcon = lucideGlyph(lucideArrowLeft, 14);
export const MailIcon = lucideGlyph(lucideMail, 16);
export const MessageIcon = lucideGlyph(lucideMessageCircle, 16);
export const ExternalLinkIcon = lucideGlyph(lucideExternalLink, 16);
export const TipIcon = lucideGlyph(lucideLightbulb, 20);
export const NoteIcon = lucideGlyph(lucideInfo, 20);
export const SearchIcon = lucideGlyph(lucideSearch, 16);
export const CloseIcon = lucideGlyph(lucideX, 14);
