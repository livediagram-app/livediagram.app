'use client';

// The item panel's `⋯` menu (docs/specs/026-plan/plan-board.md "Open an item"): Duplicate, Flag (or Remove
// Flag), Archive (or Restore) and Edit Card Type for someone who may edit, then Help for everyone, then Trash last
// for an editor, as icon-left rows beside
// the panel's Close, so the header keeps only the item's type, its key and the two buttons.
import { useState } from 'react';
import { DuplicateIcon, PlanCardsIcon, TrashIcon } from '@livediagram/ui';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { HelpMarkIcon, openHelpArticle } from '@/components/primitives/HelpArticleLink';
import { MenuActionRow, MenuGroupSeparator, PortalMenu } from '@/components/primitives/PortalMenu';
import { PlanBoardTileArt } from './plan-tile-art';
import { PlanTypeGlyph } from './plan-type-glyph';

export function ItemPanelMenu({
  itemKey,
  canEdit,
  canRetire = canEdit,
  archived,
  flagged,
  onDuplicate,
  onFlag,
  onArchive,
  onTrash,
  onEditType,
}: {
  itemKey: number;
  // Someone who may only view gets Help alone.
  canEdit: boolean;
  // Archive, Trash and the type editor are an Editor's; a Participant duplicates and flags
  // (docs/specs/013-workspace/share-roles.md). Absent: as canEdit.
  canRetire?: boolean;
  archived: boolean;
  flagged: boolean;
  onDuplicate: () => void;
  onFlag: () => void;
  onArchive: () => void;
  onTrash: () => void;
  // Opens the card's type in the type editor; absent, no row.
  onEditType?: (() => void) | undefined;
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
          {canEdit ? (
            <>
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
              {canRetire ? (
                <MenuActionRow
                  plain
                  label={archived ? 'Restore' : 'Archive'}
                  icon={<PlanBoardTileArt preset="archive" size={14} />}
                  onClick={run(onArchive)}
                />
              ) : null}
              {onEditType && canRetire ? (
                <MenuActionRow
                  plain
                  label="Edit Card Type"
                  icon={<PlanCardsIcon size={16} />}
                  onClick={run(onEditType)}
                />
              ) : null}
              <MenuGroupSeparator />
            </>
          ) : null}
          <MenuActionRow
            plain
            label="Help"
            icon={<HelpMarkIcon />}
            onClick={run(() => openHelpArticle('planCards'))}
          />
          {/* Trash last, at the bottom of the list, after a separator. */}
          {canRetire ? (
            <>
              <MenuGroupSeparator />
              <MenuActionRow plain label="Trash" icon={<TrashIcon />} onClick={run(onTrash)} />
            </>
          ) : null}
        </PortalMenu>
      ) : null}
    </>
  );
}
