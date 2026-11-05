// A Contents row's marks of livedocuments' own (docs/specs/007-editor/pages-mode.md "Contents"), after the
// page's name in both of Contents' homes: a card's speaking time (docs/specs/007-editor/flashcards.md "Card
// number and speaking time"). A page hidden in Slides says so in its picture (the shared row's setAside).
import type { ContentsRow } from '@/lib/page-contents';

export function contentsBadges(row: ContentsRow) {
  if (!row.speakingTime) return null;
  return (
    <span
      data-contents-speaking-time=""
      className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400"
    >
      {row.speakingTime}
    </span>
  );
}
