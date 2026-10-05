'use client';

// A Plan board's header (docs/specs/025-plan/plan-board.md "What the board shows"): title, count and
// progress, the quick filter, the unplaced count, votes left, Reveal and the set-up cog. The header's
// own background is the board's handle: a press there moves the board, its controls do not.
import { useState } from 'react';
import { SettingsIcon } from '@livediagram/ui';
import type { BoardProjection, Item, PlanBoardSetup, QuickFilter } from '@livediagram/items';
import { itemTitle } from '@livediagram/items';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function PlanBoardHeader({
  setup,
  projection,
  palette,
  quick,
  onQuick,
  canFilterMine,
  canEdit,
  votesLeft,
  loadFailed,
  onRetry,
  onReveal,
  onSetup,
  onMoveUnplaced,
}: {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  canFilterMine: string | null;
  canEdit: boolean;
  votesLeft: number | null;
  loadFailed: boolean;
  onRetry: () => void;
  onReveal: () => void;
  onSetup: () => void;
  onMoveUnplaced: (item: Item, status: string) => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const done = setup.doneColumnId !== undefined;
  const pct = projection.total ? Math.round((projection.doneCount / projection.total) * 100) : 0;
  const button =
    'rounded-md border px-2 py-1 text-[12px] font-medium transition enabled:cursor-pointer disabled:opacity-50';
  return (
    <div
      className="relative flex h-[52px] shrink-0 items-center gap-3 px-4"
      style={{ color: palette.text }}
    >
      <div className="flex min-w-0 flex-col">
        <div className="truncate text-[17px] font-bold leading-tight">{setup.title}</div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: palette.muted }}>
          <span>
            {projection.total} {projection.total === 1 ? 'item' : 'items'}
          </span>
          {done && projection.total > 0 ? (
            <span className="inline-flex items-center gap-1.5" aria-label={`${pct}% done`}>
              <span
                className="h-1.5 w-20 overflow-hidden rounded-full"
                style={{ backgroundColor: palette.column }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: '#16a34a' }}
                />
              </span>
              {pct}% done
            </span>
          ) : null}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2" onPointerDown={stop}>
        {loadFailed ? (
          <button
            type="button"
            className={button}
            style={{ borderColor: palette.warning, color: palette.warning }}
            onClick={onRetry}
          >
            Couldn&rsquo;t load items · Retry
          </button>
        ) : null}
        {projection.unplaced.length > 0 ? (
          <button
            type="button"
            className={button}
            style={{ borderColor: palette.border, color: palette.muted }}
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen((o) => !o)}
          >
            {projection.unplaced.length} not on this board
          </button>
        ) : null}
        {votesLeft !== null ? (
          <span className="text-[12px] font-medium" style={{ color: palette.muted }}>
            Votes left: {votesLeft}
          </span>
        ) : null}
        <input
          type="search"
          value={quick.text ?? ''}
          onChange={(e) => onQuick({ ...quick, text: e.target.value })}
          onKeyDown={stop}
          placeholder="Filter"
          aria-label="Filter this board"
          className="h-7 w-28 rounded-md border bg-transparent px-2 text-[12px] outline-none"
          style={{ borderColor: palette.border, color: palette.text }}
        />
        {canFilterMine ? (
          <button
            type="button"
            className={button}
            aria-pressed={quick.mine !== undefined}
            style={{
              borderColor: quick.mine ? palette.focus : palette.border,
              color: quick.mine ? palette.focus : palette.muted,
            }}
            onClick={() =>
              onQuick(quick.mine ? { text: quick.text } : { ...quick, mine: canFilterMine })
            }
          >
            Only mine
          </button>
        ) : null}
        {setup.hideWriting && canEdit ? (
          <button
            type="button"
            className={button}
            style={{ borderColor: palette.focus, color: palette.focus }}
            onClick={onReveal}
          >
            Reveal
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border transition enabled:cursor-pointer"
            style={{ borderColor: palette.border, color: palette.muted }}
            aria-label="Board set-up"
            onClick={onSetup}
          >
            <SettingsIcon size={14} />
          </button>
        ) : null}
      </div>
      {trayOpen && projection.unplaced.length > 0 ? (
        <div
          className="absolute right-4 top-12 z-10 max-h-72 w-80 overflow-y-auto rounded-lg border p-2 shadow-lg"
          style={{ backgroundColor: palette.card, borderColor: palette.border }}
          onPointerDown={stop}
          role="dialog"
          aria-label="Items not on this board"
        >
          <div className="mb-1 px-1 text-[11px]" style={{ color: palette.muted }}>
            Their status is none of this board&rsquo;s columns.
          </div>
          {projection.unplaced.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded px-1 py-1 text-[12px]">
              <span className="min-w-0 flex-1 truncate">
                #{item.key} {itemTitle(item)}
              </span>
              {canEdit ? (
                <select
                  aria-label={`Move #${item.key} to`}
                  className="rounded border bg-transparent px-1 text-[12px]"
                  style={{ borderColor: palette.border, color: palette.text }}
                  value=""
                  onChange={(e) => e.target.value && onMoveUnplaced(item, e.target.value)}
                >
                  <option value="">Move to</option>
                  {setup.columns.map((c) => (
                    <option key={c.id} value={c.status}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
