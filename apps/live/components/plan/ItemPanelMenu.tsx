'use client';

// The item panel's `⋯` menu (docs/specs/026-plan/plan-board.md "Open an item"): Duplicate, Flag (or Remove
// Flag), Archive (or Restore) and Trash, as icon-left rows beside the panel's Close, so the header keeps only the item's
// type, its key, Help and the two buttons.
import { useState } from 'react';
import { DuplicateIcon, TrashIcon } from '@livediagram/ui';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '@/components/primitives/PortalMenu';
import { PlanBoardTileArt } from './plan-tile-art';
import { PlanTypeGlyph } from './plan-type-glyph';

export function ItemPanelMenu({
  itemKey,
  archived,
  flagged,
  onDuplicate,
  onFlag,
  onArchive,
  onTrash,
}: {
  itemKey: number;
  archived: boolean;
  flagged: boolean;
  onDuplicate: () => void;
  onFlag: () => void;
  onArchive: () => void;
  onTrash: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Held in state so the menu anchors on its first render.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <>
      <EllipsisTriggerButton
        ref={setButton}
        size="lg"
        label={`More for #${itemKey}`}
        expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <PortalMenu anchor={button} placement="below" onClose={() => setOpen(false)}>
          <MenuActionRow
            plain
            label="Duplicate"
            icon={<DuplicateIcon />}
            onClick={run(onDuplicate)}
          />
          <MenuActionRow
            plain
            label={flagged ? 'Remove Flag' : 'Flag'}
            icon={<PlanTypeGlyph glyph="flag" size={14} />}
            onClick={run(onFlag)}
          />
          <MenuActionRow
            plain
            label={archived ? 'Restore' : 'Archive'}
            icon={<PlanBoardTileArt preset="archive" size={14} />}
            onClick={run(onArchive)}
          />
          <MenuGroupSeparator />
          <MenuActionRow plain danger label="Trash" icon={<TrashIcon />} onClick={run(onTrash)} />
        </PortalMenu>
      ) : null}
    </>
  );
}
