import { createStickerPickerTab } from '@liveworkspace/workbench/components/palette/StickerPickerTab';
import { STICKER_DND_MIME } from '@/lib/icons';
import { StickerArt } from '@liveworkspace/workbench/components/canvas/StickerView';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

// The palette's sticker grid and browse groups (docs/specs/010-palette/stickers.md), shared by the editors and bound to
// this one's; the Icons category's Stickers side (IconsCategoryTab) shows them.
export const { StickerGrid, stickerBrowseGroups } = createStickerPickerTab({
  dndMime: STICKER_DND_MIME,
  StickerArt,
  PaletteCategoryBrowser,
});
