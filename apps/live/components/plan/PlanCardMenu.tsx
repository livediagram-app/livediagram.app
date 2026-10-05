'use client';

// A board card's right-click menu (docs/specs/025-plan/plan-board.md "Working on a board"): Open,
// Duplicate, Move to another column, and Delete, at the click and clamped to the window. Someone who
// may only view gets Open alone. Built on the shared command menu, so the keyboard, focus and Escape
// behave as every other menu does.
import { useCallback, useEffect, useRef } from 'react';
import { MENU_LABEL_ATTR, MenuTreeContext, TrashIcon, useMenu } from '@livediagram/ui';
import { itemTitle, type PlanBoardSetup } from '@livediagram/items';
import { Portal } from '@/components/primitives/Portal';
import type { PlanContextValue } from './PlanContext';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

const WIDTH = 220;
const ROW_PX = 30;

const ROW =
  'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800';

export function PlanCardMenu({
  at,
  title,
  canEdit,
  columns,
  onOpen,
  onDuplicate,
  onMove,
  onDelete,
  onClose,
}: {
  // Viewport coordinates of the right-click.
  at: { x: number; y: number };
  // The card's title, naming the menu.
  title: string;
  canEdit: boolean;
  // The board's other columns, to move the card to.
  columns: readonly { status: string; name: string }[];
  onOpen: () => void;
  onDuplicate: () => void;
  onMove: (status: string) => void;
  onDelete: () => void;
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

  const rows = canEdit ? 4 + columns.length : 1;
  const left = Math.max(EDGE, Math.min(at.x, window.innerWidth - WIDTH - EDGE));
  const top = Math.max(EDGE, Math.min(at.y, window.innerHeight - rows * ROW_PX - 48 - EDGE));
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
          className="fixed z-[var(--z-overlay,50)] rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          <p
            {...{ [MENU_LABEL_ATTR]: '' }}
            className="truncate px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {title}
          </p>
          <button type="button" role="menuitem" tabIndex={-1} className={ROW} onClick={act(onOpen)}>
            Open
          </button>
          {canEdit ? (
            <>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={ROW}
                onClick={act(onDuplicate)}
              >
                Duplicate
              </button>
              {columns.length > 0 ? (
                <>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Move to
                  </p>
                  {columns.map((c) => (
                    <button
                      key={c.status}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={ROW}
                      onClick={act(() => onMove(c.status))}
                    >
                      {c.name}
                    </button>
                  ))}
                </>
              ) : null}
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${ROW} text-rose-600 dark:text-rose-400`}
                onClick={act(onDelete)}
              >
                <TrashIcon />
                Delete
              </button>
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
        .map((c) => ({ status: c.status, name: c.name }))}
      onOpen={() => plan.openItem(item.id)}
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
      onClose={onClose}
    />
  );
}
