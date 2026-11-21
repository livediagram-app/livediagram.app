'use client';

// The top row of the content area (docs/specs/030-knowledgebase/page-surface.md "The footer"): one row, the same
// height in the three views. Its left is the view's own (a page's formatting controls, Ask's or AI Knowledge's title
// and buttons); its right end is always Share and the account button, which the editor draws into the row's slot
// (TopRowActions, lib/page-surface/top-row-slot.ts). A real row with a hairline under it: nothing here floats.
import { useCallback, type CSSProperties, type ReactNode } from 'react';
import { setTopRowSlot, type TopRowRank } from '@/lib/page-surface/top-row-slot';

/** The row's height: 48 px, 56 px on a phone (`--knowledge-top-row`, app/globals.css), whose 44 px targets need it. */
export const TOP_ROW_HEIGHT_VAR = 'var(--knowledge-top-row)';

export function KnowledgeTopRow({
  rank,
  leading,
  trailing,
  children,
  className = '',
  style,
}: {
  rank: TopRowRank;
  // Ahead of the row's own controls: a phone's menu and Pages buttons.
  leading?: ReactNode;
  // After them, before Share: the Page Info button.
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const slot = useCallback((el: HTMLDivElement | null) => setTopRowSlot(rank, el), [rank]);
  return (
    <div
      data-knowledge-top-row={rank}
      // No `data-app-chrome`: the row follows the knowledgebase's theme (page-surface.md "The chrome follows the
      // theme"), so the formatting bar's active state and Share take its accent.
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{ height: TOP_ROW_HEIGHT_VAR, ...style }}
      className={`pointer-events-auto flex shrink-0 cursor-default items-center gap-1 border-b border-slate-200 bg-white pl-3 pr-2 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 phone:pl-2 phone:pr-1.5 ${className}`}
    >
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
      {trailing}
      {/* Share and the account button (TopRowActions). `data-corner-actions` is what the shared account control is
          redrawn as a button under (@liveworkspace/workbench styles/corner-actions.css). */}
      <div
        ref={slot}
        data-corner-actions=""
        data-top-row-actions=""
        data-region="header"
        className="flex shrink-0 items-center gap-1 empty:hidden"
      />
    </div>
  );
}
