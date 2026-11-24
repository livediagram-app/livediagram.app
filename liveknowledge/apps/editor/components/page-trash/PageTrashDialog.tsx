'use client';

// The knowledgebase's page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"): a
// centred dialog, a sheet on a phone. A note on how long pages wait, then each page put in the Trash with its
// subpages as one row: its name, the subpages it took, who put it there and when, the days it has left, Restore and,
// for an Editor, Delete Forever. Empty Trash in the foot for an Editor. Empty, an empty state.
import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { trashDaysLeft, type TrashedPage } from '@liveknowledge/api-schema';
import {
  Button,
  CompactEmptyState,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
} from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';
import { useToast } from '@/hooks/ui/useToast';
import { pageTrashStore, usePageTrashState } from '@/lib/knowledge/page-trash-store';
import { track } from '@/lib/telemetry';
import { DeleteIcon, PagesIcon } from '@/components/page-tree/page-tree-icons';
import type { PageTrashRights } from './usePageTrash';

const UNTITLED = 'Untitled Page';
const nameOf = (page: { name: string }) => page.name.trim() || UNTITLED;

/** "and 1 Subpage", "and 3 Subpages". */
export function subpagesLine(count: number): string {
  return count === 1 ? 'and 1 Subpage' : `and ${count} Subpages`;
}

/** "Deleted by Ana, 3 Nov · 12 days left". */
export function trashedLine(
  page: Pick<TrashedPage, 'trashedAt' | 'trashedBy'>,
  now: number,
): string {
  const on = DAY_MONTH.format(page.trashedAt);
  const left = trashDaysLeft(page.trashedAt, now);
  const days =
    left === 0 ? 'Removed at the next clean-up' : left === 1 ? '1 day left' : `${left} days left`;
  return `${page.trashedBy ? `Deleted by ${page.trashedBy}, ${on}` : `Deleted ${on}`} · ${days}`;
}

/** What a restore's refusal says. */
export function restoreFailure(error: unknown, name?: string): string {
  if (error instanceof ApiError && error.code === 'page_limit')
    return 'A knowledgebase holds 500 pages at most: delete a page before restoring this one.';
  return `Could not restore ${toastName(name) ?? 'the page'}. Try again.`;
}

export function PageTrashDialog({
  rights,
  onClose,
}: {
  rights: PageTrashRights;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const confirm = useConfirm();
  const { pages, loaded, failed, focus } = usePageTrashState();
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const focused = useRef<HTMLLIElement>(null);
  // A link to a trashed page opened the Trash: its row is scrolled to.
  useEffect(() => {
    focused.current?.scrollIntoView?.({ block: 'nearest' });
  }, [focus, loaded]);

  const restore = async (page: TrashedPage) => {
    setBusy(page.id);
    try {
      const answer = await pageTrashStore.restore(page.id);
      track('UI', 'Used', 'RestorePage');
      if (answer?.topLevel)
        toast.success(`Restored ${nameOf(page)} at the top level: its parent page is gone.`);
      else toast.success(`Restored ${nameOf(page)}.`);
    } catch (error) {
      toast.error(restoreFailure(error, nameOf(page)));
    } finally {
      setBusy(null);
    }
  };
  const deleteForever = async (page: TrashedPage) => {
    const ok = await confirm({
      title: `Delete ${nameOf(page)} Forever?`,
      message:
        page.subpages.length === 0
          ? 'The page is removed for good. This cannot be undone.'
          : 'The page and its subpages are removed for good. This cannot be undone.',
      confirmLabel: 'Delete Forever',
    });
    if (!ok) return;
    setBusy(page.id);
    try {
      await pageTrashStore.deleteForever(page.id);
      track('UI', 'Used', 'DeletePageForever');
    } catch {
      toast.error(`Could not delete ${toastName(nameOf(page)) ?? 'the page'}. Try again.`);
    } finally {
      setBusy(null);
    }
  };
  const empty = async () => {
    const ok = await confirm({
      title: 'Empty the Trash?',
      message: 'Every page in the Trash is removed for good. This cannot be undone.',
      confirmLabel: 'Empty Trash',
    });
    if (!ok) return;
    try {
      await pageTrashStore.empty();
      track('UI', 'Used', 'EmptyPageTrash');
    } catch {
      toast.error('Could not empty the Trash. Try again.');
    }
  };

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <DialogHeader title={<span id={titleId}>Trash</span>}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 pb-4 pt-1">
        <Callout tone="info">
          Deleted pages wait here for 30 days, then they are removed for good. Restoring one puts it
          back where it was.
        </Callout>
        <div className="max-h-[min(24rem,55vh)] min-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {!loaded ? (
            failed ? (
              <CompactEmptyState
                icon={<DeleteIcon />}
                title="Could Not Load the Trash"
                description="Check the connection and try again."
                action={
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => void pageTrashStore.refresh()}
                  >
                    Try Again
                  </Button>
                }
                className="h-full min-h-40"
              />
            ) : (
              <div role="status" className="flex flex-col gap-2 p-4" aria-label="Loading the Trash">
                <span className="h-4 w-2/3 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
                <span className="h-4 w-1/2 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
              </div>
            )
          ) : pages.length === 0 ? (
            <CompactEmptyState
              icon={<DeleteIcon />}
              title="No Pages in the Trash"
              description="Deleted pages wait here for 30 days."
              className="h-full min-h-40"
            />
          ) : (
            <ul
              className="divide-y divide-slate-100 dark:divide-slate-700/60"
              aria-label="Pages in the Trash"
            >
              {pages.map((page) => {
                const name = nameOf(page);
                const marked =
                  focus !== null &&
                  (focus === page.id || page.subpages.some((s) => s.id === focus));
                return (
                  <li
                    key={page.id}
                    ref={marked ? focused : undefined}
                    data-trash-page={page.id}
                    aria-current={marked ? true : undefined}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                      marked ? 'bg-brand-50 dark:bg-brand-500/15' : ''
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                    >
                      <PagesIcon />
                    </span>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {name}
                      </p>
                      {page.subpages.length > 0 ? (
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {subpagesLine(page.subpages.length)}:{' '}
                          {page.subpages.map(nameOf).join(', ')}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {trashedLine(page, now)}
                      </p>
                    </div>
                    <div className="ml-11 flex shrink-0 items-center gap-1.5 sm:ml-0">
                      <Button
                        variant="secondary"
                        size="xs"
                        aria-label={`Restore ${name}`}
                        busy={busy === page.id}
                        disabled={busy !== null}
                        onClick={() => void restore(page)}
                      >
                        Restore
                      </Button>
                      {rights.deleteForever ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label={`Delete Forever: ${name}`}
                          disabled={busy !== null}
                          onClick={() => void deleteForever(page)}
                        >
                          Delete Forever
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {/* Empty Trash is an Editor's, while there is something to empty; the header's button closes. */}
      {rights.deleteForever && pages.length > 0 ? (
        <DialogFooter>
          <Button variant="secondary" onClick={() => void empty()}>
            Empty Trash
          </Button>
        </DialogFooter>
      ) : null}
    </Dialog>
  );
}

/** The dialog while the Trash is open: mounted by the page tree's host, which knows the session's rights. */
export function PageTrashHost({ rights }: { rights: PageTrashRights }) {
  const { open } = usePageTrashState();
  if (!open || !rights.see) return null;
  return <PageTrashDialog rights={rights} onClose={() => pageTrashStore.close()} />;
}
