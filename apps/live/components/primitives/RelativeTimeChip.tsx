import { relativeSince } from '@/lib/relative-time';

// The small uppercase "when was this last touched" stamp on an Explorer row,
// card, or panel entry.
//
// Five places rendered this exact span — the two diagram rows, the folder row,
// the card grid and the shared-with-me list — differing only in which
// timestamp they read. The styling is the whole component: five copies of a
// class string is five chances for one of them to miss a change, and the
// Explorer's rows are meant to read as one family.
//
// Deliberately NOT in packages/ui. Only the editor app shows relative times,
// and `relativeSince` lives in apps/live/lib beside it; moving the wrapper
// alone would split the pair across workspaces to satisfy a rule about code
// two apps share. If a second app ever grows a timestamp, both move together.
export function RelativeTimeChip({ at }: { at: number }) {
  return (
    <span className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {relativeSince(at)}
    </span>
  );
}
