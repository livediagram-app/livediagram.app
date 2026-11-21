// The Knowledgebase Home's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs.
import {
  lucideArrowRight,
  lucideBookOpen,
  lucideCircleCheck,
  lucideCode,
  lucideFileInput,
  lucideFileText,
  lucideGraduationCap,
  lucideHandshake,
  lucideLibrary,
  lucidePlus,
  lucideSearch,
  lucideSparkles,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const SearchIcon = lucideGlyph(lucideSearch, 18);
export const AskIcon = lucideGlyph(lucideSparkles, 16);
export const ArrowIcon = lucideGlyph(lucideArrowRight, 14);
export const KnowledgebaseIcon = lucideGlyph(lucideLibrary, 18);
export const PageIcon = lucideGlyph(lucideFileText, 16);
export const ReviewIcon = lucideGlyph(lucideCircleCheck, 16);
export const NewIcon = lucideGlyph(lucidePlus, 16);
export const HandbookIcon = lucideGlyph(lucideGraduationCap, 22);
export const EngineeringIcon = lucideGlyph(lucideCode, 22);
export const SupportIcon = lucideGlyph(lucideHandshake, 22);
export const ImportIcon = lucideGlyph(lucideFileInput, 22);
export const RecentIcon = lucideGlyph(lucideBookOpen, 18);
