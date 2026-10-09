'use client';

// Setup Board's Fill Tab (docs/specs/026-plan/plan-board.md "Setup Board", "Fill Tab"): a switch row at the end of the
// Columns step, and, while it is on and the tab holds anything else, a warning naming how many elements creating
// (or saving) the board will delete. In the board's colours.
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { fillTabWarning } from './fill-tab';
import type { PlanPalette } from './plan-palette';

export function SetupFillTabOption({
  on,
  others,
  saving,
  palette,
  onChange,
}: {
  on: boolean;
  // The other elements on the tab: what turning it on deletes.
  others: number;
  // Run again on a board that has columns (Save Board), rather than Create Board.
  saving: boolean;
  palette: PlanPalette;
  onChange: (on: boolean) => void;
}) {
  const warning = on ? fillTabWarning(others, saving) : null;
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: palette.border }}>
      <SwitchRow checked={on} onChange={onChange} className="cursor-pointer">
        <span className="block text-[13px] font-semibold" style={{ color: palette.text }}>
          Fill Tab
        </span>
        <span className="block text-[12px]" style={{ color: palette.muted }}>
          The board always fills this tab, so the rest of the canvas can’t be used.
        </span>
      </SwitchRow>
      {warning ? (
        <p
          role="alert"
          // A plain notice, not red: a delete is never painted red (docs/specs/004-interface-design/destructive-actions.md).
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
        >
          {warning}
        </p>
      ) : null}
    </div>
  );
}
