// The page tree's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the chrome's size.
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideChevronRight,
  lucideCopy,
  lucideEllipsis,
  lucideFileText,
  lucideIndentDecrease,
  lucideIndentIncrease,
  lucideLink,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
  lucidePencil,
  lucidePlus,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const ChevronIcon = lucideGlyph(lucideChevronRight, 14);
export const AddIcon = lucideGlyph(lucidePlus, 16);
export const MoreIcon = lucideGlyph(lucideEllipsis, 16);
export const RenameIcon = lucideGlyph(lucidePencil, 16);
export const DuplicateIcon = lucideGlyph(lucideCopy, 16);
export const LinkIcon = lucideGlyph(lucideLink, 16);
export const MoveUpIcon = lucideGlyph(lucideArrowUp, 16);
export const MoveDownIcon = lucideGlyph(lucideArrowDown, 16);
export const IndentIcon = lucideGlyph(lucideIndentIncrease, 16);
export const OutdentIcon = lucideGlyph(lucideIndentDecrease, 16);
export const DeleteIcon = lucideGlyph(lucideTrash2, 16);
export const CollapseIcon = lucideGlyph(lucidePanelLeftClose, 16);
export const ExpandIcon = lucideGlyph(lucidePanelLeftOpen, 16);
export const PagesIcon = lucideGlyph(lucideFileText, 16);
