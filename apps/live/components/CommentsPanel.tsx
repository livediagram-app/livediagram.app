'use client';

import type { BoxedElement } from '@livediagram/diagram';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import { MovablePanel } from './MovablePanel';

export type CommentRow = {
  // Element id; click jumps to it and opens the thread.
  elementId: string;
  // Display label for the element, "Untitled" when missing so the
  // row never reads as blank.
  label: string;
  // Number of unresolved + resolved comments together. Resolved
  // threads still appear in the list, with a dimmed treatment, so
  // the user can jump back to them.
  count: number;
  // True when the thread has been resolved. Drives the dimmed row
  // treatment + the "resolved" tag.
  resolved: boolean;
  // Newest comment's author identity for the leading dot. Reused
  // from Comment.authorName / authorColor (denormalised on write
  // so the panel renders without joining the participant list).
  latestAuthorName: string;
  latestAuthorColor: string;
  // Newest comment's text + ts for the row preview + timestamp.
  latestText: string;
  latestAt: number;
};

type CommentsPanelProps = {
  position: { x: number; y: number } | null;
  // Pre-filtered + sorted rows the caller computes from
  // activeTab.elements. Caller decides not to mount the panel at
  // all when the list is empty, so the panel itself can assume
  // there's content to render.
  rows: CommentRow[];
  // ContextPanel's reported bottom Y. Drives top-right-stacked
  // positioning so the panel sits directly under the Editor pane
  // and slides with it as Editor expands / collapses.
  stackBelowY?: number;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Row click: the editor selects the element + opens its comment
  // thread popover. Bound here as a single callback so the panel
  // doesn't have to know about either piece of editor state.
  onRowClick: (elementId: string) => void;
};

// Floating "Comments" panel. Only mounted (by the caller) when the
// active tab has at least one element with comments, so it stays out
// of the user's way on diagrams that don't carry discussion. Same
// MovablePanel shape language as the Activity panel so the editor's
// chrome reads consistently. Click any row to jump to the underlying
// element and open its thread popover for replies.
export function CommentsPanel({
  position,
  rows,
  stackBelowY,
  onMoveTo,
  onReset,
  onRowClick,
}: CommentsPanelProps) {
  // Refresh "X mins ago" strings every 30s. Cheap, see spec/07's
  // useRelativeTimeTick singleton.
  useRelativeTimeTick();
  return (
    <MovablePanel
      title="Comments"
      headerExtra={
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
          {rows.length}
        </span>
      }
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      stackBelowY={stackBelowY}
      onReset={onReset}
      onMoveTo={onMoveTo}
      collapsible
      // Default collapsed: an open Comments panel would compete with
      // the always-visible Editor pane right above it. Users open
      // the panel deliberately when they want to scan comments;
      // until then it banner-collapses to its title row so the
      // canvas stays as roomy as possible.
      defaultCollapsed
    >
      <ul className="flex flex-col divide-y divide-slate-100 px-2 pb-2 dark:divide-slate-800">
        {rows.map((row) => (
          <li key={row.elementId}>
            <button
              type="button"
              onClick={() => onRowClick(row.elementId)}
              className={`group flex w-full flex-col gap-1 rounded px-1.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                row.resolved ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.latestAuthorColor }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {row.label}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {row.count}
                </span>
              </div>
              <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {row.latestText}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span className="truncate">{row.latestAuthorName}</span>
                <span className="flex items-center gap-1">
                  {row.resolved ? (
                    <span className="rounded bg-emerald-100 px-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Resolved
                    </span>
                  ) : null}
                  <span>{formatRelativeTimeShort(Date.now() - row.latestAt)}</span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </MovablePanel>
  );
}

// Helper the caller uses to derive the panel's rows from the active
// tab's elements. Exported so editor-page builds the list once + can
// short-circuit the panel mount when it's empty. Sorted newest-first
// on latestAt so the active discussion sits at the top.
export function commentRowsFromElements(elements: BoxedElement[]): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const el of elements) {
    const thread = (el as { commentThread?: { comments: unknown[]; resolved: boolean } })
      .commentThread;
    if (!thread || thread.comments.length === 0) continue;
    const comments = thread.comments as {
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    }[];
    const latest = comments[comments.length - 1]!;
    const labelSource = (el as { label?: string }).label;
    // Tables have no single label (the cells carry the text), so describe
    // them as "Table" plus the first non-empty cell rather than a stray
    // fallback.
    let label: string;
    if (el.type === 'table') {
      const firstCell = el.cells.flat().find((c) => c.trim().length > 0);
      label = firstCell ? `Table: ${firstCell.trim()}` : 'Table';
    } else {
      label = labelSource && labelSource.trim().length > 0 ? labelSource.trim() : 'Untitled';
    }
    rows.push({
      elementId: el.id,
      label,
      count: comments.length,
      resolved: !!thread.resolved,
      latestAuthorName: latest.authorName,
      latestAuthorColor: latest.authorColor,
      latestText: latest.text,
      latestAt: latest.createdAt,
    });
  }
  rows.sort((a, b) => b.latestAt - a.latestAt);
  return rows;
}
