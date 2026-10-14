'use client';

import { useRef, type ReactNode } from 'react';
import { IconButton } from './PaletteIconButton';
import { iconBrowseGroups } from './IconPickerTab';
import { stickerBrowseGroups } from './StickerPickerTab';
import { techBrowseGroups } from './TechPickerTab';

// The Toolbar strip's tiles for Icons, Stickers and Technology (docs/specs/007-editor/toolbar-layout.md "More"): the
// catalogue's browse groups, each opening a popover of its entries. The groups are the browse's own
// (PaletteCategoryBrowser), so the strip and the More body never disagree.

export type StripGroup = { id: string; label: string; icon: ReactNode };

/** The category's groups when it is a grouped catalogue, else null (its strip shows tiles). Empty groups (the
 *  catalogue chunk still in flight) are left out, so the strip shows nothing until there is something to open. */
export function catalogueStripGroups(categoryId: string): StripGroup[] | null {
  const groups =
    categoryId === 'icons'
      ? iconBrowseGroups()
      : categoryId === 'stickers'
        ? stickerBrowseGroups()
        : categoryId === 'technology'
          ? techBrowseGroups()
          : null;
  if (!groups) return null;
  return groups
    .filter((g) => g.items.length > 0)
    .map(({ id, label, icon }) => ({ id, label, icon }));
}

/** One group on the strip. Pressing it toggles its popover, hung from the tile; the wrapper carries the More
 *  button's marker so a press on it never counts as outside the popover it owns. */
export function CatalogueGroupTile({
  group,
  open,
  noTint = false,
  onToggle,
}: {
  group: StripGroup;
  open: boolean;
  // Brand marks keep their own colours (Technology).
  noTint?: boolean;
  onToggle: (anchor: HTMLElement) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} data-toolbar-more-button="" className="flex">
      <IconButton
        label={group.label}
        description={`Browse ${group.label}.`}
        hideCaption
        active={open}
        noTint={noTint}
        onClick={() => {
          if (ref.current) onToggle(ref.current);
        }}
      >
        {group.icon}
      </IconButton>
    </span>
  );
}
