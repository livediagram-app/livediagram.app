'use client';

// A citation in an answer (liveworkspace/docs/specs/019-ask/ask.md "What an answer shows"): a small numbered square
// that goes to its source card. brand-900 on brand-100 is over 4.5:1. Shared by liveknowledge's Ask and every other
// app's Ask AI.
export const NUMBER_CHIP =
  'inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-brand-100 px-1 text-[11px] font-semibold leading-none tabular-nums text-brand-900 dark:bg-brand-500/25 dark:text-brand-100';

export function CitationChip({
  number,
  title,
  onPress,
}: {
  number: number;
  // What the passage is of (a page, an element), for the chip's name.
  title: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-citation={number}
      aria-label={`Source ${number}: ${title}`}
      onClick={onPress}
      className={`${NUMBER_CHIP} touch-target relative mx-0.5 cursor-pointer align-[1px] motion-safe:transition-colors motion-safe:duration-micro hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:hover:bg-brand-500/40`}
    >
      <span className="text-optical-centre">{number}</span>
    </button>
  );
}
