'use client';

// The Trash (docs/specs/026-plan/items.md "Trash"): the cards moved there, newest change first, in one bordered
// list. Each row is the card's type tile, its title (two lines at most), a quiet line of its type, number and the
// status it came from, and a quieter one of when and by whom it was trashed; Restore and Delete Forever are icon
// buttons on its right. Delete Forever asks first (the workspace Trash's ConfirmPopover); Empty Trash, in the header
// row, deletes them all at once. An empty Trash is a small popover holding the small empty state. A popover above
// its button in Plan mode's bottom-right cluster.
import { useMemo, useState } from 'react';
import {
  TRASHED_FROM_FIELD,
  isTrashed,
  itemTitle,
  statusLabel,
  typeIn,
  type Item,
} from '@liveplanner/items';
import {
  Button,
  CompactEmptyState,
  CountBadge,
  relativeSince,
  Tooltip,
  TrashIcon,
  UndoIcon,
} from '@liveplanner/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { ConfirmPopover } from '@liveworkspace/workbench/components/primitives/ConfirmPopover';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { usePlan } from './PlanContext';
import { CardTypeTile } from './CardTypeTile';

// The row's icon buttons: one size, one hover, a pointer; Delete Forever turns red.
const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors motion-reduce:transition-none hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
const DANGER_HOVER =
  'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400';

// Who trashed it, as the row says it: "by you" for the person looking, "by Ana" for someone else, nothing unnamed.
function trashedBy(it: Item, selfId: string | undefined): string {
  if (selfId && it.updatedBy.id === selfId) return ' by you';
  const name = it.updatedBy.name.trim();
  return name ? ` by ${name}` : '';
}

export function TrashPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  // When the panel opened: each row says how long ago its card was trashed from here.
  const [now] = useState(() => Date.now());
  // The card whose Delete is asking "for good?", and the button it points at.
  const [purging, setPurging] = useState<{ id: string; key: number; anchor: HTMLElement } | null>(
    null,
  );
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
      helpArticle="planCards"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-96"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      // Sized to what it holds: the small empty state needs no more than 16rem.
      popoverWidth={trashed.length === 0 ? 'w-64' : 'w-[22rem]'}
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      {trashed.length === 0 ? (
        <CompactEmptyState
          size="small"
          icon={<TrashIcon />}
          title="No cards in the Trash"
          description="Drag a card onto Trash to put it here."
          className="pb-3 pt-1"
        />
      ) : (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="flex min-h-7 items-center justify-between gap-2 pl-0.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
              {/* Grey, as every neutral count: the Trash holds nothing urgent (destructive-actions.md). */}
              <CountBadge size="md" count={trashed.length} />
              {trashed.length === 1 ? 'card' : 'cards'}
            </span>
            {canEdit ? (
              <Button
                variant="ghost"
                size="xs"
                className={`gap-1.5 px-2 text-[12px] font-medium text-slate-600 dark:text-slate-300 ${DANGER_HOVER}`}
                // At once, no confirm: pressing Empty Trash in the Trash is the intent (items.md "Trash").
                onClick={() => {
                  plan.emptyTrash();
                  plan.announce('Trash emptied');
                  // Nothing left to show: the panel closes.
                  onPopoverClose();
                }}
              >
                <TrashIcon size={13} />
                Empty Trash
              </Button>
            ) : null}
          </div>
          <ul
            aria-label="Cards in the Trash"
            className="flex max-h-80 flex-col divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
          >
            {trashed.map((it) => {
              const type = typeIn(plan.types, it.type);
              const fromField = it.fields[TRASHED_FROM_FIELD];
              const from =
                typeof fromField === 'string' && plan.statusNames.has(fromField)
                  ? statusLabel(fromField, plan.statusNames)
                  : null;
              const title = itemTitle(it) || 'Untitled';
              const restoreLabel = from ? `Restore #${it.key} to ${from}` : `Restore #${it.key}`;
              const deleteLabel = `Delete #${it.key} Forever`;
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-2.5 bg-white py-2 pl-2.5 pr-1.5 transition-colors motion-reduce:transition-none hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                >
                  <CardTypeTile color={type.color} glyph={type.glyph} size={28} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`line-clamp-2 text-[13px] font-medium leading-snug [overflow-wrap:anywhere] ${
                        itemTitle(it)
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'italic text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      {type.label} #{it.key}
                      {from ? ` · from ${from}` : ''}
                    </p>
                    <p className="truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Trashed {relativeSince(it.updatedAt, now)}
                      {trashedBy(it, plan.self?.id)}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tooltip label={restoreLabel}>
                        <button
                          type="button"
                          aria-label={restoreLabel}
                          className={ICON_BUTTON}
                          onClick={() => {
                            plan.restoreItem(it.id);
                            plan.announce(`#${it.key} restored`);
                          }}
                        >
                          <UndoIcon size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip label={deleteLabel}>
                        <button
                          type="button"
                          aria-label={deleteLabel}
                          aria-haspopup="dialog"
                          aria-expanded={purging?.id === it.id}
                          className={`${ICON_BUTTON} ${DANGER_HOVER}`}
                          onClick={(e) =>
                            setPurging({ id: it.id, key: it.key, anchor: e.currentTarget })
                          }
                        >
                          <TrashIcon size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {purging ? (
        <ConfirmPopover
          anchor={purging.anchor}
          message={`Delete #${purging.key} for good? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => {
            plan.deleteItem(purging.id);
            setPurging(null);
          }}
          onCancel={() => setPurging(null)}
        />
      ) : null}
    </MovablePanel>
  );
}
