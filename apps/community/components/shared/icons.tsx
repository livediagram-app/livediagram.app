import {
  lucideArrowLeft,
  lucideArrowUpDown,
  lucideEyeOff,
  lucideFlag,
  lucideHash,
  lucideLayoutGrid,
  lucideMaximize2,
  lucideSparkles,
  lucideTriangleAlert,
  lucideUser,
  lucideUsers,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// The Community app's own chrome glyphs, all through lucideGlyph (docs/specs/004-interface-design/
// iconography.md).

// The heart is shared with the landing page.
export { HeartIcon } from '@livediagram/ui';
export const HashIcon = lucideGlyph(lucideHash, 15);
export const SortIcon = lucideGlyph(lucideArrowUpDown, 15);
export const CategoryIcon = lucideGlyph(lucideLayoutGrid, 15);
export const FlagIcon = lucideGlyph(lucideFlag, 14);
export const BackIcon = lucideGlyph(lucideArrowLeft, 16);
export const FullScreenIcon = lucideGlyph(lucideMaximize2, 14);
export const SparklesIcon = lucideGlyph(lucideSparkles, 16);
export const PeopleIcon = lucideGlyph(lucideUsers, 16);
export const AlertIcon = lucideGlyph(lucideTriangleAlert, 16);
export const MineIcon = lucideGlyph(lucideUser, 15);
export const HiddenIcon = lucideGlyph(lucideEyeOff, 12);
