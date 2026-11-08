import { firstDoneColumn, type PlanBoardSetup, type PlanColumn } from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideCheck } from '@liveworkspace/icons/lucide';

const CheckIcon = lucideGlyph(lucideCheck, 11);

// Where the Practice Sprint's cards ship (docs/specs/026-plan/plan-tour.md "Boards: Practice Sprint"): the board's
// first done column, else its rightmost. Undefined for a board with no columns.
export function practiceShipColumn(
  setup: Pick<PlanBoardSetup, 'columns' | 'doneColumnId'>,
): PlanColumn | undefined {
  return firstDoneColumn(setup) ?? setup.columns.at(-1);
}

// What marks a practice card on the board (plan-tour.md "Practice cards"): its Practice tag, and once it lands in the
// ship column, the Shipped stamp, pressed on as it arrives (canvas-motion.css practice-stamp). The dashed, see-through
// face is globals.css's `[data-practice]` rule. Neither takes a pointer: the card under them is the one dragged.
export function PracticeMarks({ shipped }: { shipped: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute -top-2 right-2 z-[1] rounded-full bg-brand-600 px-1.5 py-px text-[length:calc(10px*var(--plan-text-scale,1))] font-semibold leading-4 text-white shadow-[0_1px_2px_rgba(15,23,42,0.18)] dark:bg-brand-500"
      >
        Practice
      </span>
      {shipped ? (
        <span
          aria-hidden
          data-practice-stamp=""
          className="pointer-events-none absolute right-2.5 top-1/2 z-[1] inline-flex -translate-y-1/2 -rotate-[8deg] items-center gap-1 rounded-[5px] border-2 border-double border-emerald-600 bg-white/85 px-1.5 py-0.5 text-[length:calc(11px*var(--plan-text-scale,1))] font-bold tracking-wide text-emerald-700 dark:border-emerald-400 dark:bg-slate-900/85 dark:text-emerald-300"
        >
          <CheckIcon />
          Shipped
        </span>
      ) : null}
    </>
  );
}
