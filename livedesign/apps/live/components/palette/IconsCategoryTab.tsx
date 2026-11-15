import { createIconsCategoryTab } from '@liveworkspace/workbench/components/palette/IconsCategoryTab';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';
import { IconGrid, iconBrowseGroups } from '@/components/palette/IconPickerTab';
import { StickerGrid, stickerBrowseGroups } from '@/components/palette/StickerPickerTab';

// The palette's Icons category, icons and stickers in one (docs/specs/008-canvas/canvas-and-palette.md "Icons
// category"), shared by the editors and bound to this one's catalogues and browse.
export const { IconsCategoryTab } = createIconsCategoryTab({
  PaletteCategoryBrowser,
  IconGrid,
  StickerGrid,
  iconBrowseGroups,
  stickerBrowseGroups,
});
