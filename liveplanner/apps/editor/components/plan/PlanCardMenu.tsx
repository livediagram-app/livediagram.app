'use client';

// A board card's right-click menu (docs/specs/026-plan/plan-board.md "Working on a board"): Open,
// Duplicate, Move to another column, Flag (or Remove Flag),
// Archive (or Restore), and Trash. Someone who
// may only view gets Open alone; a Participant gets Open, Duplicate, Move to and Flag, as the item panel's menu gives it. Built on the shared ContextMenu, so it opens at the click, re-clamps to
// the window as it grows, is a bottom sheet on a phone and keeps the long-press grace, like the element menu.
import type { SyntheticEvent } from 'react';
import { DuplicateIcon, PencilIcon, TrashIcon, PlanCardsIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideSquareCheck } from '@liveworkspace/icons/lucide';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { ContextMenu } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { isArchived, isFlagged, itemTitle, type PlanBoardSetup } from '@liveplanner/items';
import { PlanBoardTileArt } from './plan-tile-art';
import { duplicateItem } from './duplicate-item';
import { toggleFlag } from './item-flag';
import { PlanTypeGlyph } from './plan-type-glyph';
import { track } from '@/lib/telemetry';
import { typeStatusRefusal } from '@/hooks/plan/status-refusal';
import type { PlanContextValue } from './PlanContext';

// Select: starts picking several cards (docs/specs/026-plan/plan-board.md "Several cards at once").
const SelectIcon = lucideGlyph(lucideSquareCheck, 16);

// A portal's events still bubble up the React tree to the board and canvas.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function PlanCardMenu({
  at,
  title,
  canEdit,
  canRetire = canEdit,
  columns,
  onOpen,
  onDuplicate,
  onMove,
  onTrash,
  onEditType,
  archived = false,
  onArchive,
  flagged = false,
  onFlag,
  onSelect,
  onClose,
}: {
  // Viewport coordinates of the right-click.
  at: { x: number; y: number };
  // The card's title, naming the menu.
  title: string;
  // Works on the card: an Editor or a Participant (docs/specs/013-workspace/share-roles.md).
  canEdit: boolean;
  // Edit Card Type, Archive and Trash: an Editor's alone. Absent: as canEdit.
  canRetire?: boolean;
  // The board's other columns, to move the card to.
  columns: readonly { status: string; name: string; color?: string }[];
  onOpen: () => void;
  onDuplicate: () => void;
  onMove: (status: string) => void;
  // Moves the card to the Trash (docs/specs/026-plan/items.md "Trash"), where it can be restored.
  onTrash: () => void;
  // Opens the card's type in the type editor (docs/specs/026-plan/plan-board.md "Card menu").
  onEditType?: () => void;
  // Archive (or, for an archived card, Restore): kept, but off every board but an Archive board.
  archived?: boolean;
  onArchive: () => void;
  // Flag (or Remove Flag) (docs/specs/026-plan/items.md "Flags").
  flagged?: boolean;
  onFlag: () => void;
  // Select: starts select mode with this card picked. Absent where a board takes no selection (a Dashboard slot).
  onSelect?: () => void;
  onClose: () => void;
}) {
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    // display: contents, so it lays out nothing; it only catches what bubbles out of the portal.
    <div
      className="contents"
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ContextMenu position={at} label="Card menu" onClose={onClose}>
        <MenuHeader title={title} />
        <MenuActionRow plain label="Open" icon={<PencilIcon />} onClick={act(onOpen)} />
        {canEdit ? (
          <>
            <MenuActionRow
              plain
              label="Duplicate"
              icon={<DuplicateIcon />}
              onClick={act(onDuplicate)}
            />
            {canRetire && onEditType ? (
              <MenuActionRow
                plain
                label="Edit Card Type"
                icon={<PlanCardsIcon size={16} />}
                onClick={act(onEditType)}
              />
            ) : null}
            {columns.length > 0 ? (
              <>
                <MenuGroupSeparator />
                {columns.map((c) => (
                  <MenuActionRow
                    plain
                    key={c.status}
                    label={`Move to ${c.name}`}
                    icon={
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-slate-600"
                        style={
                          c.color ? { backgroundColor: c.color, borderColor: c.color } : undefined
                        }
                      />
                    }
                    onClick={act(() => onMove(c.status))}
                  />
                ))}
              </>
            ) : null}
            {onSelect ? (
              <>
                <MenuGroupSeparator />
                <MenuActionRow plain label="Select" icon={<SelectIcon />} onClick={act(onSelect)} />
              </>
            ) : null}
            <MenuGroupSeparator />
            <MenuActionRow
              plain
              label={flagged ? 'Remove Flag' : 'Flag'}
              icon={<PlanTypeGlyph glyph="flag" size={16} />}
              onClick={act(onFlag)}
            />
            {canRetire ? (
              <>
                <MenuActionRow
                  plain
                  label={archived ? 'Restore' : 'Archive'}
                  icon={<PlanBoardTileArt preset="archive" size={16} />}
                  onClick={act(onArchive)}
                />
                <MenuActionRow plain label="Trash" icon={<TrashIcon />} onClick={act(onTrash)} />
              </>
            ) : null}
          </>
        ) : null}
      </ContextMenu>
    </div>
  );
}

// The menu for one card of a board, with what each row does to its item.
export function PlanCardMenuHost({
  menu,
  plan,
  setup,
  canEdit,
  canRetire = canEdit,
  onSelect,
  onClose,
}: {
  menu: { itemId: string; at: { x: number; y: number } };
  plan: PlanContextValue;
  setup: PlanBoardSetup;
  canEdit: boolean;
  canRetire?: boolean;
  // Select in the menu: starts the board's select mode with this card (useBoardSelection).
  onSelect?: (itemId: string) => void;
  onClose: () => void;
}) {
  const item = plan.items.get(menu.itemId);
  if (!item) return null;
  const status = typeof item.fields['status'] === 'string' ? item.fields['status'] : '';
  return (
    <PlanCardMenu
      at={menu.at}
      title={itemTitle(item) || 'Card'}
      canEdit={canEdit}
      canRetire={canRetire}
      // The other columns, but none whose status the card's type leaves out (docs/specs/026-plan/item-types.md).
      columns={setup.columns
        .filter(
          (c) =>
            c.status !== status &&
            typeStatusRefusal(plan.types, item.type, c.status, () => c.name) === null,
        )
        .map((c) => ({ status: c.status, name: c.name, ...(c.color ? { color: c.color } : {}) }))}
      onOpen={() => plan.openItem(item.id)}
      onEditType={() => plan.editType({ id: item.type })}
      onDuplicate={() => duplicateItem(plan, item)}
      onMove={(to) => {
        plan.moveItem(item.id, { status: to, before: null });
        plan.announce(`Moved to ${setup.columns.find((c) => c.status === to)?.name ?? to}`);
      }}
      onTrash={() => {
        plan.trashItem(item.id);
        plan.announce('Card moved to the Trash');
      }}
      flagged={isFlagged(item)}
      onFlag={() => toggleFlag(plan, item)}
      {...(onSelect ? { onSelect: () => onSelect(item.id) } : {})}
      archived={isArchived(item)}
      onArchive={() => {
        const was = isArchived(item);
        void plan.patchItem(item.id, was ? { clear: ['archived'] } : { set: { archived: true } });
        plan.announce(was ? 'Card restored' : 'Card archived');
        if (was) track('Plan', 'Restored', 'Card');
        else track('Plan', 'Moved', 'Archive');
      }}
      onClose={onClose}
    />
  );
}
