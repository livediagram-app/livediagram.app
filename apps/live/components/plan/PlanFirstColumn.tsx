'use client';

// A board with no columns (docs/specs/026-plan/plan-board.md "The board set-up"): in place of its columns, the
// column picker (AddColumnPicker): an existing status to use, or a new one to name. The board then grows from its
// cog's + Add Column After. Someone who may only view reads that the board has no columns yet.
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { PlanBoardSetup } from '@livediagram/items';
import { AddColumnPicker } from './AddColumnPicker';
import type { StatusPick } from './column-status-picks';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function PlanFirstColumn({
  palette,
  canEdit,
  setup,
  statusNames,
  onAdd,
  onPick,
  onPickAll,
}: {
  palette: PlanPalette;
  canEdit: boolean;
  setup: Pick<PlanBoardSetup, 'columns'>;
  // The document's statuses, offered as picks (docs/specs/026-plan/plan-board.md "The column picker").
  statusNames: ReadonlyMap<string, string>;
  onAdd: (name: string) => void;
  onPick: (pick: StatusPick) => void;
  onPickAll: (picks: StatusPick[]) => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-6 text-center"
        style={{ borderColor: palette.border, color: palette.muted }}
      >
        <div className="flex items-center gap-1.5" onPointerDown={stop}>
          <p className="text-[14px] font-semibold" style={{ color: palette.text }}>
            No columns yet
          </p>
          <HelpArticleLink article="planBoards" variant="icon" />
        </div>
        {canEdit ? (
          <>
            <p className="text-[12px]">Pick or name the first stage your cards move through.</p>
            <AddColumnPicker
              setup={setup}
              statusNames={statusNames}
              palette={palette}
              onPick={onPick}
              onPickAll={onPickAll}
              onName={onAdd}
            />
          </>
        ) : (
          <p className="text-[12px]">Someone who can edit the board names its first column.</p>
        )}
      </div>
    </div>
  );
}
