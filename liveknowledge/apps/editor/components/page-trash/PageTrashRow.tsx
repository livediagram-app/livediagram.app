'use client';

// The page tree's Trash row (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"): at the foot
// of the tree, directly above New Page, in the sidebar and the phone's Pages sheet. Always there for a writer, so it
// is found when it is looked for: muted while empty, its count a badge at its right while it holds pages. On the
// rail, an icon button. Pressing it opens the Trash.
import { CountBadge, HoverCard } from '@liveknowledge/ui';
import { openPageTrash, trashedCount, usePageTrashState } from '@/lib/knowledge/page-trash-store';
import { track } from '@/lib/telemetry';
import { DeleteIcon } from '@/components/page-tree/page-tree-icons';
import { ROW, ROW_REST } from '@/components/page-tree/page-tree-row-styles';

const DESCRIPTION = 'Deleted pages wait here for 30 days.';

/** "Trash", or "Trash, 3 pages" for a screen reader. */
export function trashLabel(count: number): string {
  if (count === 0) return 'Trash, empty';
  return count === 1 ? 'Trash, 1 page' : `Trash, ${count} pages`;
}

function open(onOpen?: () => void) {
  track('UI', 'Opened', 'PageTrash');
  onOpen?.();
  openPageTrash();
}

export function PageTrashRow({
  touch = false,
  onOpen,
}: {
  // A phone's sheet: the row is 44 px tall.
  touch?: boolean;
  // Told as the Trash opens (the phone's sheet steps aside for its dialog).
  onOpen?: () => void;
}) {
  const { pages } = usePageTrashState();
  const count = trashedCount(pages);
  return (
    <HoverCard block title="Trash" description={DESCRIPTION}>
      <button
        type="button"
        data-page-trash-row=""
        aria-label={trashLabel(count)}
        aria-haspopup="dialog"
        onClick={() => open(onOpen)}
        style={{ paddingLeft: 10 }}
        className={`${ROW} ${ROW_REST} ${touch ? 'min-h-11' : 'min-h-8'} ${
          count === 0 ? 'text-slate-500 dark:text-slate-400' : ''
        }`}
      >
        <span aria-hidden className="flex w-5 shrink-0 items-center justify-center">
          <DeleteIcon />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">Trash</span>
        {count > 0 ? <CountBadge count={count} className="mr-1" /> : null}
      </button>
    </HoverCard>
  );
}

/** The rail's Trash: an icon button under New Page. */
export function PageTrashRailButton({ className }: { className: string }) {
  const { pages } = usePageTrashState();
  const count = trashedCount(pages);
  return (
    <HoverCard title="Trash" description={DESCRIPTION}>
      <button
        type="button"
        data-page-trash-rail=""
        aria-label={trashLabel(count)}
        aria-haspopup="dialog"
        onClick={() => open()}
        className={`${className} relative`}
      >
        <DeleteIcon />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400"
          />
        ) : null}
      </button>
    </HoverCard>
  );
}
