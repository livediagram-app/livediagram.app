'use client';

// The Trash (docs/specs/025-plan/items.md "Trash"): the cards moved there, newest change first, each with
// Restore (back to the status it came from) and Delete (for good), and Empty Trash, which deletes them all
// after asking. A popover above its button in Plan mode's bottom-right cluster, like Card Types.
import { useMemo } from 'react';
import { isTrashed, itemTitle, typeIn } from '@livediagram/items';
import { TrashIcon } from '@livediagram/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';

const ROW_BUTTON =
  'rounded-md px-2 py-1 text-[12px] font-medium transition enabled:cursor-pointer disabled:opacity-40';

export function TrashPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  const confirm = useConfirm();
  const trashed = useMemo(
    () =>
      [...(plan?.items.values() ?? [])].filter(isTrashed).sort((a, b) => b.updatedAt - a.updatedAt),
    [plan?.items],
  );
  if (!plan) return null;
  const { canEdit } = plan;
  return (
    <MovablePanel
      title="Trash"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-80"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        {trashed.length === 0 ? (
          <p className="px-1 py-4 text-center text-[13px] text-slate-500 dark:text-slate-400">
            The Trash is empty. Drag a card here to put it out of the way.
          </p>
        ) : (
          <ul
            aria-label="Cards in the Trash"
            className="flex max-h-80 flex-col gap-1 overflow-y-auto"
          >
            {trashed.map((it) => {
              const type = typeIn(plan.types, it.type);
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-1.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className={ACCENT_TEXT} style={accentVars(type.color)} aria-hidden>
                    <PlanTypeGlyph glyph={type.glyph} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-100">
                    <span className="text-slate-500 dark:text-slate-400">#{it.key}</span>{' '}
                    {itemTitle(it) || 'Untitled'}
                  </span>
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className={`${ROW_BUTTON} text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10`}
                        onClick={() => {
                          plan.restoreItem(it.id);
                          plan.announce(`#${it.key} restored`);
                        }}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete #${it.key} for good`}
                        className={`${ROW_BUTTON} text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300`}
                        onClick={() => plan.deleteItem(it.id)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && trashed.length > 0 ? (
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-md border border-rose-200 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-500/15"
            onClick={async () => {
              const ok = await confirm({
                title: 'Empty the Trash?',
                message: `${trashed.length} ${trashed.length === 1 ? 'card is' : 'cards are'} deleted for good. This can't be undone.`,
                confirmLabel: 'Empty Trash',
                variant: 'danger',
              });
              if (!ok) return;
              plan.emptyTrash();
              plan.announce('Trash emptied');
            }}
          >
            <TrashIcon size={14} />
            Empty Trash
          </button>
        ) : null}
      </div>
    </MovablePanel>
  );
}
