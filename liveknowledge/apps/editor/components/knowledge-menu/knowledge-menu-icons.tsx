// The knowledgebase menu's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the
// chrome's size.
import {
  lucideChevronDown,
  lucideFileDown,
  lucideFileUp,
  lucideGlobe,
  lucidePalette,
  lucidePencil,
  lucideSparkles,
  lucideTrash2,
  lucideWandSparkles,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const MenuChevronIcon = lucideGlyph(lucideChevronDown, 14);
export const RenameIcon = lucideGlyph(lucidePencil, 16);
export const StyleIcon = lucideGlyph(lucidePalette, 16);
export const DescribeIcon = lucideGlyph(lucideWandSparkles, 16);
export const ImportIcon = lucideGlyph(lucideFileUp, 16);
export const ExportIcon = lucideGlyph(lucideFileDown, 16);
export const PublishIcon = lucideGlyph(lucideGlobe, 16);
export const AiIcon = lucideGlyph(lucideSparkles, 16);
export const DeleteIcon = lucideGlyph(lucideTrash2, 16);
