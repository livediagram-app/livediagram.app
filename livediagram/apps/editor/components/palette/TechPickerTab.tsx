import { createTechPickerTab } from '@liveworkspace/workbench/components/palette/TechPickerTab';
import { TECH_ICON_DND_MIME } from '@/lib/icons';
import { IconButton } from '@/components/palette/palette-controls';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import { PaletteCategoryBrowser } from '@/components/palette/PaletteCategoryBrowser';

// The palette's Technology tab (docs/specs/010-palette/technology-icons.md), shared by the editors and bound to this
// one's controls.
export const { TechPickerTab, techBrowseGroups } = createTechPickerTab({
  dndMime: TECH_ICON_DND_MIME,
  IconButton,
  TechIconArt,
  PaletteCategoryBrowser,
});
