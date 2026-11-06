'use client';

// Start Planning's Import card picture (docs/specs/026-plan/plan-mode.md "Starting a board"): the four tools' marks,
// as the Import dialog's rows draw them, flowing into a board in the tab's own colours. On a phone, where the picture
// is a small square, the marks alone.
import { TRACKER_SOURCES } from '@liveplanner/items';
import { ToolMark } from '@/components/dialogs/import/tool-marks';
import type { PlanPalette } from '../plan-palette';
import { BoardPreview } from '../PlanBoardPicker';

export function ImportPicture({ palette }: { palette: PlanPalette }) {
  return (
    <span aria-hidden className="flex w-full items-center justify-center gap-3">
      <span className="grid shrink-0 grid-cols-2 gap-1.5 max-sm:scale-[0.8]">
        {TRACKER_SOURCES.map((source) => (
          <ToolMark key={source} source={source} />
        ))}
      </span>
      <svg
        viewBox="0 0 20 12"
        className="h-3 w-5 shrink-0 max-sm:hidden"
        fill="none"
        stroke={palette.muted}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 6h16M12.5 1.5 17 6l-4.5 4.5" />
      </svg>
      <span className="flex w-[46%] shrink-0 items-center max-sm:hidden">
        <BoardPreview preset="kanban" palette={palette} />
      </span>
    </span>
  );
}
