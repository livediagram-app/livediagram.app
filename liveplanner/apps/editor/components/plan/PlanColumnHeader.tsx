'use client';

// A column's head on a Plan board (docs/specs/026-plan/plan-board.md "What the board shows"): its colour
// bar, name, count (against its WIP limit), and, for someone who may edit, a cog at the far right that
// opens the column's settings (PlanColumnPopover). The cog shows on hover and focus, and always on a
// touch screen. Collapse Column (CollapsedColumn.tsx) sits before the cog (both always shown), for everyone, where the board offers it
// (docs/specs/026-plan/plan-board.md "Collapse Column"); the cog's toolbar has it too. A column just added from another column's settings opens its own, its name selected.
// For an Editor on a desktop (`reorder`), the head is the column's handle (plan-board.md "Drag a column"): the open hand
// on hover, a press that moves picks the column up (useColumnDrag), and focused, Alt+Shift+Left/Right move it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanBoardSetup, ProjectedColumn } from '@liveplanner/items';
import { CountBadge, SettingsIcon } from '@liveplanner/ui';
import { PlanColumnPopover } from './PlanColumnPopover';
import {
  subscribeColumnSettingsRequest,
  takeColumnSettingsRequestOf,
} from './column-settings-request';
import type { PlanPalette } from './plan-palette';
import { columnHeadStyle } from './column-part';
import { COLUMN_ATTR } from './column-move-flip';
import { COLUMN_HEAD_ATTR, columnMoveKey, type ColumnReorder } from './column-drag';
import { plural } from '@liveplanner/project';
import { CollapseColumnButton } from './CollapsedColumn';
import { PLAN_HEADING_STYLE } from '@/lib/plan-font';

export function PlanColumnHeader({
  col,
  setup,
  palette,
  canEdit,
  onChange,
  onMoveCards,
  onTrashCards,
  onDeleteStatus,
  onFrame,
  onCollapse,
  bar,
  reorder,
}: {
  col: ProjectedColumn & { count: number; overLimit: boolean };
  setup: PlanBoardSetup;
  palette: PlanPalette;
  canEdit: boolean;
  onChange: (next: PlanBoardSetup, part: string) => void;
  onMoveCards: (fromStatus: string, toStatus: string) => void;
  onTrashCards: (status: string) => void;
  onDeleteStatus?: ((status: string) => void) | undefined;
  // A tap on the header (a phone): the view frames this column, given the header. Absent, a tap does nothing.
  onFrame?: ((header: HTMLElement) => void) | undefined;
  // Collapse Column, for this person alone; absent where the board offers none (a phone).
  onCollapse?: (() => void) | undefined;
  // Its top bar's colour when the column has none of its own (a multi-colour theme's, column-tones.ts).
  bar?: string | undefined;
  // The head as the column's handle, for someone who may reorder the board's columns; absent, it is no handle.
  reorder?: ColumnReorder | undefined;
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
      // A column just added opens named fresh; a right-click on its background opens it as the cog does.
      const request = takeColumnSettingsRequestOf(column.id);
      if (!request) return;
      setFresh(request.fresh);
      setOpen(true);
    };
    take();
    return subscribeColumnSettingsRequest(take);
  }, [column.id, canEdit]);
  return (
    <div
      {...{ [COLUMN_ATTR]: column.id }}
      {...(reorder
        ? {
            role: 'group',
            tabIndex: 0,
            'aria-label': `${column.name} column, position ${reorder.position + 1} of ${reorder.total}`,
            'aria-keyshortcuts': 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight',
            [COLUMN_HEAD_ATTR]: column.id,
            onPointerDown: reorder.onPointerDown,
            onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
              const step = columnMoveKey(e);
              if (!step) return;
              e.preventDefault();
              e.stopPropagation();
              reorder.onMoveKey(step);
            },
          }
        : {})}
      className={`plan-col group sticky top-0 z-[1] rounded-[var(--plan-col-r,8px)] px-3 pb-1.5 pt-2 ${
        reorder
          ? 'cursor-grab outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--plan-col-focus)]'
          : ''
      }`}
      style={
        reorder
          ? ({
              ...columnHeadStyle(palette),
              '--plan-col-focus': palette.focus,
            } as React.CSSProperties)
          : columnHeadStyle(palette)
      }
      onClick={
        onFrame
          ? (e) => {
              // The cog and its popover keep their own presses.
              if ((e.target as HTMLElement).closest('button, [role="dialog"]')) return;
              onFrame(e.currentTarget);
            }
          : undefined
      }
    >
      <div
        className="mb-1.5 h-1 rounded-full"
        style={{ backgroundColor: column.color ?? bar ?? palette.border }}
        aria-hidden
      />
      <div className="flex items-center gap-2">
        {/* The count first, then the name (plan-board.md "Column heads"). */}
        <span className="flex shrink-0">
          <CountBadge
            size="md"
            background={col.overLimit ? palette.warningBg : palette.surface}
            color={col.overLimit ? palette.warning : palette.muted}
            label={
              column.wipLimit
                ? `${col.count} of a WIP limit of ${column.wipLimit}${col.overLimit ? ', over the limit' : ''}`
                : plural(col.count, 'item')
            }
          >
            {column.wipLimit ? `${col.count} / ${column.wipLimit}` : col.count}
          </CountBadge>
        </span>
        <span
          className="mr-auto truncate text-[length:calc(13px*var(--plan-text-scale,1))] font-semibold"
          style={PLAN_HEADING_STYLE}
        >
          {column.name}
        </span>
        {onCollapse ? (
          <CollapseColumnButton column={column} palette={palette} onCollapse={onCollapse} />
        ) : null}
        {canEdit ? (
          <button
            ref={cog}
            type="button"
            data-column-cog
            aria-label={`${column.name} column settings`}
            aria-haspopup="dialog"
            aria-expanded={open}
            // Always shown, so a column's settings are found without hunting for them.
            className={`touch-target relative -mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10 ${
              open ? 'bg-black/5 dark:bg-white/10' : ''
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
        <div
          className="text-[length:calc(10px*var(--plan-text-scale,1))] font-medium"
          style={{ color: palette.warning }}
        >
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
          onDeleteStatus={onDeleteStatus}
          onCollapse={onCollapse}
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
