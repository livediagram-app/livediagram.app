'use client';

// The page navigator (docs/specs/007-editor/pages-mode.md "Getting around the pages"): in the
// bottom-right cluster, right of Undo / Redo, while the tab has two pages or more: previous, the
// place of the page someone is on ("2 of 5"), next. An arrow fits the neighbouring page in the view,
// as a press on its label does. For everyone who can see the pages.
import { lucideChevronLeft, lucideChevronRight } from '@livedesign/icons/lucide';
import { HoverCard, lucideGlyph } from '@livedesign/ui';
import { CLUSTER_CONTROL_REST, CLUSTER_STRIP } from '@/components/canvas/cluster-strip';
import { useCurrentPageId } from '@/lib/current-page-kind';

const Prev = lucideGlyph(lucideChevronLeft, 18);
const Next = lucideGlyph(lucideChevronRight, 18);

const ARROW = `flex h-11 w-11 items-center justify-center transition disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent ${CLUSTER_CONTROL_REST}`;

export function PageNavigatorClusterStrip({
  pageIds,
  onGo,
}: {
  // The tab's pages, in order.
  pageIds: readonly string[];
  // Fits the page in the view and makes it the page someone is on.
  onGo: (pageId: string) => void;
}) {
  const current = useCurrentPageId();
  const at = Math.max(0, current ? pageIds.indexOf(current) : 0);
  const count = pageIds.length;
  const go = (to: number) => {
    const id = pageIds[to];
    if (id) onGo(id);
  };
  return (
    <div
      role="group"
      aria-label={`Page ${at + 1} of ${count}`}
      data-page-navigator=""
      data-dock-button=""
      className={CLUSTER_STRIP}
    >
      <HoverCard title="Previous Page" description="Go to the page before this one.">
        <button
          type="button"
          aria-label="Previous page"
          disabled={at <= 0}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => go(at - 1)}
          className={ARROW}
        >
          <Prev />
        </button>
      </HoverCard>
      <span className="flex min-w-[4.5rem] items-center justify-center border-x border-slate-100 px-2 text-[13px] font-medium tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300">
        {at + 1} of {count}
      </span>
      <HoverCard title="Next Page" description="Go to the page after this one.">
        <button
          type="button"
          aria-label="Next page"
          disabled={at >= count - 1}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => go(at + 1)}
          className={ARROW}
        >
          <Next />
        </button>
      </HoverCard>
    </div>
  );
}
