'use client';

// A board card's right-click menu (docs/specs/026-plan/plan-board.md "Working on a board"): Open,
// Duplicate, Add to Slides, Move to another column, Flag (or Remove Flag),
// Archive (or Restore), and Trash. Someone who
// may only view gets Open alone. Built on the shared ContextMenu, so it opens at the click, re-clamps to
// the window as it grows, is a bottom sheet on a phone and keeps the long-press grace, like the element menu.
import type { SyntheticEvent } from 'react';
import { DuplicateIcon, PencilIcon, TrashIcon } from '@livediagram/ui';
import { MenuActionRow, MenuGroupSeparator, MenuHeader } from '@/components/primitives/PortalMenu';
import { ContextMenu } from '@/components/palette/ContextMenu';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { isArchived, isFlagged, itemTitle, type PlanBoardSetup } from '@livediagram/items';
import { PlanBoardTileArt } from './plan-tile-art';
import { duplicateItem } from './duplicate-item';
import { toggleFlag } from './item-flag';
import { PlanTypeGlyph } from './plan-type-glyph';
import { track } from '@/lib/telemetry';
import type { PlanContextValue } from './PlanContext';

// A portal's events still bubble up the React tree to the board and canvas.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function PlanCardMenu({
  at,
  title,
  canEdit,
  columns,
  onOpen,
  onDuplicate,
  onMove,
  onTrash,
  onAddSlide,
  archived = false,
  onArchive,
  flagged = false,
  onFlag,
  onClose,
}: {
  // Viewport coordinates of the right-click.
  at: { x: number; y: number };
  // The card's title, naming the menu.
  title: string;
  canEdit: boolean;
  // The board's other columns, to move the card to.
  columns: readonly { status: string; name: string; color?: string }[];
  onOpen: () => void;
  onDuplicate: () => void;
  onMove: (status: string) => void;
  // Moves the card to the Trash (docs/specs/026-plan/items.md "Trash"), where it can be restored.
  onTrash: () => void;
  // The card as a slide of the deck; absent where there is no deck.
  onAddSlide?: () => void;
  // Archive (or, for an archived card, Restore): kept, but off every board but an Archive board.
  archived?: boolean;
  onArchive: () => void;
  // Flag (or Remove Flag) (docs/specs/026-plan/items.md "Flags").
  flagged?: boolean;
  onFlag: () => void;
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
        <MenuActionRow label="Open" icon={<PencilIcon />} onClick={act(onOpen)} />
        {canEdit ? (
          <>
            <MenuActionRow label="Duplicate" icon={<DuplicateIcon />} onClick={act(onDuplicate)} />
            {onAddSlide ? (
              <MenuActionRow
                label="Add to Slides"
                icon={<SlideDeckIcon />}
                onClick={act(onAddSlide)}
              />
            ) : null}
            {columns.length > 0 ? (
              <>
                <MenuGroupSeparator />
                {columns.map((c) => (
                  <MenuActionRow
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
            <MenuGroupSeparator />
            <MenuActionRow
              label={flagged ? 'Remove Flag' : 'Flag'}
              icon={<PlanTypeGlyph glyph="flag" size={16} />}
              onClick={act(onFlag)}
            />
            <MenuActionRow
              label={archived ? 'Restore' : 'Archive'}
              icon={<PlanBoardTileArt preset="archive" size={16} />}
              onClick={act(onArchive)}
            />
            <MenuActionRow label="Trash" icon={<TrashIcon />} danger onClick={act(onTrash)} />
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
  onClose,
}: {
  menu: { itemId: string; at: { x: number; y: number } };
  plan: PlanContextValue;
  setup: PlanBoardSetup;
  canEdit: boolean;
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
      columns={setup.columns
        .filter((c) => c.status !== status)
        .map((c) => ({ status: c.status, name: c.name, ...(c.color ? { color: c.color } : {}) }))}
      onOpen={() => plan.openItem(item.id)}
      {...(plan.addItemSlide
        ? {
            onAddSlide: () => {
              plan.addItemSlide?.(item.id);
              plan.announce('Card added to the slides');
            },
          }
        : {})}
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
      archived={isArchived(item)}
      onArchive={() => {
        const was = isArchived(item);
        plan.patchItem(item.id, was ? { clear: ['archived'] } : { set: { archived: true } });
        plan.announce(was ? 'Card restored' : 'Card archived');
        if (was) track('Plan', 'Restored', 'Card');
        else track('Plan', 'Moved', 'Archive');
      }}
      onClose={onClose}
    />
  );
}
