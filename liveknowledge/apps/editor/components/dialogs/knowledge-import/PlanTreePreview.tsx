import { useMemo } from 'react';
import type { PlannedPage } from '@liveknowledge/knowledge-import';
import { PagesIcon } from '@/components/page-tree/page-tree-icons';

/** Pages listed before the rest are counted ("and 312 more"). */
export const PLAN_PREVIEW_ROWS = 12;
// The deepest indent drawn: deeper pages line up there, so a narrow dialog still shows their names.
const MAX_INDENT_LEVELS = 6;

/** The first rows of a plan in tree order, each with its depth (0 at the top). One pass: a page's parent comes
 *  before it, so its depth is its parent's plus one. */
export function planPreviewRows(
  pages: readonly PlannedPage[],
  limit = PLAN_PREVIEW_ROWS,
): { key: string; title: string; depth: number }[] {
  const depths = new Map<string, number>();
  const rows: { key: string; title: string; depth: number }[] = [];
  for (const page of pages) {
    if (rows.length >= limit) break;
    const depth = page.parentKey === null ? 0 : (depths.get(page.parentKey) ?? -1) + 1;
    depths.set(page.key, depth);
    rows.push({ key: page.key, title: page.title, depth });
  }
  return rows;
}

// What an import found, as the tree it will make: the first pages indented by level, then how many more there are.
// A preview, not a control: it is a plain list, read in order.
export function PlanTreePreview({ pages }: { pages: readonly PlannedPage[] }) {
  const rows = useMemo(() => planPreviewRows(pages), [pages]);
  const more = pages.length - rows.length;
  return (
    <ul
      aria-label="Pages Found"
      className="rounded-lg border border-slate-200 py-1 dark:border-slate-700"
    >
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex min-w-0 items-center gap-2 px-3 py-1 text-xs text-slate-700 dark:text-slate-200"
          style={{ paddingLeft: 12 + Math.min(row.depth, MAX_INDENT_LEVELS) * 16 }}
        >
          <span className="shrink-0 text-slate-400 dark:text-slate-400">
            <PagesIcon size={14} />
          </span>
          <span className="truncate">{row.title}</span>
        </li>
      ))}
      {more > 0 ? (
        <li className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
          and {more.toLocaleString('en-GB')} more
        </li>
      ) : null}
    </ul>
  );
}
