// The eye of watching (docs/specs/030-knowledgebase/watching.md "Where it shows"), at the menus' and the rail's size.
import {
  lucideChevronDown,
  lucideEye,
  lucideEyeOff,
  lucideListTree,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const EyeIcon = lucideGlyph(lucideEye, 16);
export const EyeOffIcon = lucideGlyph(lucideEyeOff, 16);
/** A section: the page and its subpages. */
export const SectionWatchIcon = lucideGlyph(lucideListTree, 16);
export const SmallEyeIcon = lucideGlyph(lucideEye, 14);
export const ChevronIcon = lucideGlyph(lucideChevronDown, 12);
