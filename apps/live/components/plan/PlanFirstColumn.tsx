'use client';

// A board with no columns (docs/specs/025-plan/plan-board.md "The board set-up"): in place of its columns, a
// field to name the first one. Enter (or Add Column) makes it; the board then grows from its cog's
// + Add Column After. Someone who may only view reads that the board has no columns yet.
import { useState } from 'react';
import { PlusIcon } from '@livediagram/ui';
import { COLUMN_NAME_MAX } from './board-setup-edits';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function PlanFirstColumn({
  palette,
  canEdit,
  onAdd,
}: {
  palette: PlanPalette;
  canEdit: boolean;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName('');
  };
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-6 text-center"
        style={{ borderColor: palette.border, color: palette.muted }}
      >
        <p className="text-[14px] font-semibold" style={{ color: palette.text }}>
          No columns yet
        </p>
        {canEdit ? (
          <>
            <p className="text-[12px]">Name the first stage your cards move through.</p>
            <div className="flex w-full gap-2" onPointerDown={stop}>
              <input
                aria-label="First column name"
                placeholder="To do"
                maxLength={COLUMN_NAME_MAX}
                value={name}
                className="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-2.5 text-[13px] outline-none focus:ring-2"
                style={{
                  borderColor: palette.border,
                  color: palette.text,
                  ['--tw-ring-color' as string]: palette.focus,
                }}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  stop(e);
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={add}
                className="flex h-9 shrink-0 items-center gap-1 rounded-md px-3 text-[13px] font-semibold text-white transition enabled:cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: palette.focus }}
              >
                <PlusIcon size={14} />
                Add Column
              </button>
            </div>
          </>
        ) : (
          <p className="text-[12px]">Someone who can edit the board names its first column.</p>
        )}
      </div>
    </div>
  );
}
