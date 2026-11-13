import { createStickerPickerTab } from '@liveworkspace/workbench/components/palette/StickerPickerTab';
import { STICKER_DND_MIME } from '@/lib/icons';
import { StickerArt } from '@/components/canvas/StickerView';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';
import { useTabFinish } from '@/components/canvas/CanvasFinishContext';
import { paletteFinishClass } from './palette-tile-finish';

// The palette's Stickers tab (docs/specs/010-palette/stickers.md), shared by the editors and bound to this one's.
export const { StickerPickerTab, stickerBrowseGroups } = createStickerPickerTab({
  dndMime: STICKER_DND_MIME,
  StickerArt,
  PaletteCategoryBrowser,
  useTabFinish,
  paletteFinishClass,
});
