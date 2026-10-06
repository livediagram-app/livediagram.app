'use client';

// A board card's right-click menu (docs/specs/026-plan/plan-board.md "Working on a board"): Open,
// Duplicate, Add to Slides, Move to another column, Archive (or Restore), and Delete, at the click and clamped to the window. Someone who
// may only view gets Open alone. Built on the shared command menu, so the keyboard, focus and Escape
// behave as every other menu does.
import { useCallback, useEffect, useRef } from 'react';
import { DuplicateIcon, MenuTreeContext, PencilIcon, TrashIcon, useMenu } from '@livediagram/ui';
import { MenuActionRow, MenuGroupSeparator, MenuHeader } from '@/components/primitives/PortalMenu';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { isArchived, itemTitle, type PlanBoardSetup } from '@livediagram/items';
import { PlanBoardTileArt } from './plan-tile-art';
import { track } from '@/lib/telemetry';
import { Portal } from '@livediagram/ui';
import type { PlanContextValue } from './PlanContext';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

const WIDTH = 224;
const ROW_PX = 36;

export function PlanCardMenu({
  at,
  title,
  canEdit,
  columns,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
  onAddSlide,
  archived = false,
  onArchive,
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
  onDelete: () => void;
  // The card as a slide of the deck; absent where there is no deck.
  onAddSlide?: () => void;
  // Archive (or, for an archived card, Restore): kept, but off every board but an Archive board.
  archived?: boolean;
  onArchive: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { attach, tree, surfaceProps } = useMenu({ onClose });
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      attach(el);
    },
    [attach],
  );

  // Capture, as every canvas popover does: the canvas swallows pointerdown on its own surface.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  const rows = canEdit ? 7 + columns.length : 2;
  const left = Math.max(EDGE, Math.min(at.x, window.innerWidth - WIDTH - EDGE));
  const top = Math.max(EDGE, Math.min(at.y, window.innerHeight - rows * ROW_PX - EDGE));
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Portal>
      <MenuTreeContext.Provider value={tree}>
        <div
          ref={setRef}
          {...surfaceProps}
          // A portal's events still bubble up the React tree to the board and canvas.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{ left, top, width: WIDTH }}
          // The element menu's frame (EditorContextMenu), so a card's menu reads as one of the family.
          className="fixed z-[var(--z-popover)] flex animate-fade-in flex-col rounded-md border border-slate-200 bg-white/90 py-1 text-sm shadow-lg outline-none backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-slate-950/40"
        >
          <MenuHeader title={title} />
          <MenuActionRow label="Open" icon={<PencilIcon />} onClick={act(onOpen)} />
          {canEdit ? (
            <>
              <MenuActionRow
                label="Duplicate"
                icon={<DuplicateIcon />}
                onClick={act(onDuplicate)}
              />
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
                label={archived ? 'Restore' : 'Archive'}
                icon={<PlanBoardTileArt preset="archive" size={16} />}
                onClick={act(onArchive)}
              />
              <MenuActionRow label="Delete" icon={<TrashIcon />} danger onClick={act(onDelete)} />
            </>
          ) : null}
        </div>
      </MenuTreeContext.Provider>
    </Portal>
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
      onDuplicate={() => {
        // A copy right after the card, without its votes: they were for the original.
        const { votes: _votes, ...fields } = item.fields;
        void _votes;
        plan.addItem({ type: item.type, fields, status, after: item.id });
        plan.announce('Card duplicated');
      }}
      onMove={(to) => {
        plan.moveItem(item.id, { status: to, before: null });
        plan.announce(`Moved to ${setup.columns.find((c) => c.status === to)?.name ?? to}`);
      }}
      onDelete={() => {
        plan.deleteItem(item.id);
        plan.announce('Card deleted');
      }}
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
