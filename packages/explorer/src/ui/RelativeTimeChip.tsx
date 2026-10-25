import { relativeSince, useNow } from '../time';

// The small uppercase "last touched" stamp on a row, card or panel entry.
export function RelativeTimeChip({ at }: { at: number }) {
  const now = useNow();
  return (
    <span
      data-relative-time=""
      className="max-w-full truncate text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400"
    >
      {now ? relativeSince(at, now) : ''}
    </span>
  );
}
