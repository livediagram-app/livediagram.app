// The page labels' chrome glyphs (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the meta
// row's, the tree heading's and the picker's sizes.
import {
  lucideCheck,
  lucideChevronDown,
  lucidePencil,
  lucidePlus,
  lucideSearch,
  lucideTag,
  lucideTrash2,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const LabelIcon = lucideGlyph(lucideTag, 14);
export const EditLabelIcon = lucideGlyph(lucidePencil, 14);
export const LabelTickIcon = lucideGlyph(lucideCheck, 14);
export const LabelSearchIcon = lucideGlyph(lucideSearch, 14);
export const LabelDeleteIcon = lucideGlyph(lucideTrash2, 14);
export const LabelRemoveIcon = lucideGlyph(lucideX, 12);
export const LabelChevronIcon = lucideGlyph(lucideChevronDown, 12);
export const CreateLabelIcon = lucideGlyph(lucidePlus, 14);
