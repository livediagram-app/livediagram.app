'use client';

// Start Planning's Describe a Plan card picture (docs/specs/026-plan/describe-a-plan.md "Where it starts"): a note of
// words under the AI sparkle, flowing into a board in the tab's own colours, as Import's picture flows the tools' marks
// into one. On a phone, where the picture is a small square, the note alone.
import { SparkleIcon } from '@liveplanner/ui';
import type { PlanPalette } from '../../plan-palette';
import { BoardPreview } from '../../PlanBoardPicker';

// The note's lines of words, as widths of its row.
const LINES = ['w-full', 'w-4/5', 'w-11/12', 'w-3/5'] as const;

export function DescribePicture({ palette }: { palette: PlanPalette }) {
  return (
    <span aria-hidden className="flex w-full items-center justify-center gap-3">
      <span
        className="relative flex w-[34%] shrink-0 flex-col gap-1.5 rounded-lg border p-2 pt-3 max-sm:w-14 max-sm:gap-1 max-sm:p-1.5 max-sm:pt-2.5"
        style={{ backgroundColor: palette.surface, borderColor: palette.border }}
      >
        <span
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border"
          style={{
            backgroundColor: palette.card,
            borderColor: palette.border,
            color: palette.focus,
          }}
        >
          <SparkleIcon size={11} />
        </span>
        {LINES.map((w) => (
          <span
            key={w}
            className={`h-1 rounded-full ${w}`}
            style={{ backgroundColor: palette.muted, opacity: 0.45 }}
          />
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
