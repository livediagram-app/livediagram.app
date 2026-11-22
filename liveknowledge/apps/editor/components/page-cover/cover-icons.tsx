// The cover's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the meta row's and
// the band's sizes.
import {
  lucideArrowUpDown,
  lucideImage,
  lucideImagePlus,
  lucideImages,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const AddCoverIcon = lucideGlyph(lucideImagePlus, 14);
export const ChangeCoverIcon = lucideGlyph(lucideImages, 14);
export const RepositionIcon = lucideGlyph(lucideArrowUpDown, 14);
export const RemoveCoverIcon = lucideGlyph(lucideTrash2, 14);
export const PictureIcon = lucideGlyph(lucideImage, 16);
