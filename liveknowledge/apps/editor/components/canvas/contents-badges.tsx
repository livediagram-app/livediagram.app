// A Contents row's marks of liveknowledge' own (docs/specs/007-editor/pages-mode.md "Contents"), after the
// page's name in both of Contents' homes: a slide's builds (docs/specs/012-collaboration/presentation-mode.md "Setting builds
// up"). A page hidden in Slides says so in its picture (the shared row's setAside).
import type { ContentsRow } from '@/lib/page-contents';

export function contentsBadges(row: ContentsRow) {
  if (!row.builds) return null;
  return (
    <span
      data-contents-builds=""
      className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400"
    >
      {row.builds}
    </span>
  );
}
