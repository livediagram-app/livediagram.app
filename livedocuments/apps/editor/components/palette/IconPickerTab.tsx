import { createIconPickerTab } from '@liveworkspace/workbench/components/palette/IconPickerTab';
import { ICON_CATEGORIES, ICON_DND_MIME, iconsInCategory } from '@/lib/icons';
import { IconButton } from '@/components/palette/palette-controls';
import { CatalogIconThumb } from '@/components/primitives/icon-glyph';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

// The palette's Icons tab (docs/specs/010-palette/palette-category-browse.md), shared by the editors and bound to this
// one's catalogue and controls.
export const { IconPickerTab, iconBrowseGroups } = createIconPickerTab({
  dndMime: ICON_DND_MIME,
  categories: ICON_CATEGORIES,
  iconsInCategory,
  IconButton,
  CatalogIconThumb,
  PaletteCategoryBrowser,
});
