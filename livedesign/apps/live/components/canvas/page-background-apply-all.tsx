'use client';

// Apply to All at the foot of a page's Background tab (docs/specs/007-editor/pages-mode.md
// "Copying a background"): the page's background, its fill and its pattern, onto every other page
// of its kind in one edit. Shown only while there is another page of the kind to reach.
import { pageKindOf, type Page } from '@livedesign/design';
import { Button } from '@livedesign/ui';
import { kindPages } from '@/hooks/editor/pages-background-copy-edits';

export function ApplyBackgroundToAll({
  page,
  reach,
  onApply,
}: {
  page: Pick<Page, 'kind'>;
  // How many other pages of its kind it would reach.
  reach: number;
  onApply: () => void;
}) {
  if (reach === 0) return null;
  const label = `Apply to All ${kindPages(pageKindOf(page)).many}`;
  return (
    <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
      <Button
        variant="secondary"
        size="xs"
        className="w-full"
        onClick={onApply}
        data-apply-background-all=""
      >
        {label}
      </Button>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Gives the other {reach} this background and pattern. A locked one keeps its own.
      </p>
    </div>
  );
}
