'use client';

// A column's head on a Plan board (docs/specs/026-plan/plan-board.md "What the board shows"): its colour
// bar, name, count (against its WIP limit), and, for someone who may edit, a cog at the far right that
// opens the column's settings (PlanColumnPopover). The cog shows on hover and focus, and always on a
// touch screen. A column just added from another column's settings opens its own, its name selected.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanBoardSetup, ProjectedColumn } from '@livediagram/items';
import { CountBadge, SettingsIcon } from '@livediagram/ui';
import { PlanColumnPopover } from './PlanColumnPopover';
import {
  subscribeColumnSettingsRequest,
  takeColumnSettingsRequest,
} from './column-settings-request';
import type { PlanPalette } from './plan-palette';

export function PlanColumnHeader({
  col,
  setup,
  palette,
  canEdit,
  onChange,
  onMoveCards,
  onTrashCards,
}: {
  col: ProjectedColumn & { count: number; overLimit: boolean };
  setup: PlanBoardSetup;
  palette: PlanPalette;
  canEdit: boolean;
  onChange: (next: PlanBoardSetup, part: string) => void;
  onMoveCards: (fromStatus: string, toStatus: string) => void;
  onTrashCards: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Opened for a column just added: its name is selected, ready to type over.
  const [fresh, setFresh] = useState(false);
  const cog = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => cog.current, []);
  const { column } = col;
  useEffect(() => {
    if (!canEdit) return;
    const take = () => {
      if (!takeColumnSettingsRequest(column.id)) return;
      setFresh(true);
      setOpen(true);
    };
    take();
    return subscribeColumnSettingsRequest(take);
  }, [column.id, canEdit]);
  return (
    <div
      className="group sticky top-0 z-[1] rounded-t-lg px-3 pb-1.5 pt-2"
      style={{ backgroundColor: palette.column }}
    >
      <div
        className="mb-1.5 h-1 rounded-full"
        style={{ backgroundColor: column.color ?? palette.border }}
        aria-hidden
      />
      <div className="flex items-center gap-2">
        <span className="truncate text-[13px] font-semibold">{column.name}</span>
        <span className="ml-auto flex">
          <CountBadge
            size="md"
            background={col.overLimit ? palette.warningBg : palette.surface}
            color={col.overLimit ? palette.warning : palette.muted}
            label={
              column.wipLimit
                ? `${col.count} of a WIP limit of ${column.wipLimit}${col.overLimit ? ', over the limit' : ''}`
                : `${col.count} items`
            }
          >
            {column.wipLimit ? `${col.count} / ${column.wipLimit}` : col.count}
          </CountBadge>
        </span>
        {canEdit ? (
          <button
            ref={cog}
            type="button"
            data-column-cog
            aria-label={`${column.name} column settings`}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition hover:bg-black/5 focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
              open ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ color: palette.muted }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setFresh(false);
              setOpen((o) => !o);
            }}
          >
            <SettingsIcon size={14} />
          </button>
        ) : null}
      </div>
      {col.overLimit ? (
        <div className="text-[10px] font-medium" style={{ color: palette.warning }}>
          Over WIP limit
        </div>
      ) : null}
      {open ? (
        <PlanColumnPopover
          getAnchor={getAnchor}
          setup={setup}
          column={column}
          selectName={fresh}
          onChange={onChange}
          onMoveCards={onMoveCards}
          onTrashCards={onTrashCards}
          onClose={(restoreFocus) => {
            setOpen(false);
            setFresh(false);
            if (restoreFocus) cog.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
