// The Library's glyphs (liveworkspace/docs/specs/006-media/libraries.md), on the 24-unit grid like every chrome icon
// (docs/specs/004-interface-design/iconography.md): Save to Library on the selection toolbar, the palette category,
// Personal and a team in the Save dialog and the palette's headings, a folder, and the tile's tidy actions.

import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideBookmarkPlus,
  lucideEllipsis,
  lucideFolder,
  lucideLibrary,
  lucidePencil,
  lucideTrash2,
  lucideUser,
  lucideUsers,
} from '@liveworkspace/icons/lucide';

// The selection toolbar's button, at the toolbar's icon size.
export const SaveToLibraryIcon = lucideGlyph(lucideBookmarkPlus, 16);
export const LibraryIcon = lucideGlyph(lucideLibrary, 16);
export const PersonalScopeIcon = lucideGlyph(lucideUser, 16);
export const TeamScopeIcon = lucideGlyph(lucideUsers, 16);
export const LibraryFolderIcon = lucideGlyph(lucideFolder, 12);
export const LibraryMoreIcon = lucideGlyph(lucideEllipsis, 14);
export const LibraryRenameIcon = lucideGlyph(lucidePencil, 14);
export const LibraryDeleteIcon = lucideGlyph(lucideTrash2, 14);
