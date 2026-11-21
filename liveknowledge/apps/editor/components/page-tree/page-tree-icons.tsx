// The page tree's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the chrome's size.
import {
  lucideAppWindow,
  lucideArrowDown,
  lucideArrowUpRight,
  lucideChevronDown,
  lucideExternalLink,
  lucideFilePlus,
  lucideRefreshCw,
  lucideUnlink,
  lucideArrowUp,
  lucideArrowUpDown,
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
export const MoveIcon = lucideGlyph(lucideArrowUpDown, 14);
export const MoveDownIcon = lucideGlyph(lucideArrowDown, 16);
export const IndentIcon = lucideGlyph(lucideIndentIncrease, 16);
export const OutdentIcon = lucideGlyph(lucideIndentDecrease, 16);
export const DeleteIcon = lucideGlyph(lucideTrash2, 16);
export const CollapseIcon = lucideGlyph(lucidePanelLeftClose, 16);
export const ExpandIcon = lucideGlyph(lucidePanelLeftOpen, 16);
export const PagesIcon = lucideGlyph(lucideFileText, 16);
// A connected file's row (links-and-embeds.md "Connected files in the sidebar"): the arrow-out mark after its name,
// and its menu's verbs; the sidebar's Add to Sidebar menu.
export const ArrowOutIcon = lucideGlyph(lucideArrowUpRight, 12);
export const OpenIcon = lucideGlyph(lucideExternalLink, 16);
export const ConnectFileIcon = lucideGlyph(lucideAppWindow, 16);
export const RemoveFromSidebarIcon = lucideGlyph(lucideUnlink, 16);
export const ConnectAgainIcon = lucideGlyph(lucideRefreshCw, 16);
export const NewPageIcon = lucideGlyph(lucideFilePlus, 16);
export const MoreToAddIcon = lucideGlyph(lucideChevronDown, 16);
