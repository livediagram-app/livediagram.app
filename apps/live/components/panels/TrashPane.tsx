'use client';

// The Explorer's Trash view (docs/specs/013-workspace/trash.md, "The Trash
// view"): what the person may restore, grouped as their own diagrams, each
// joined team, then this browser only. Each row offers Restore and Delete
// permanently; each group Empty Trash. The two destructive actions confirm in
// a popover beside the button, as the Explorer's delete does. Reached from
// the sidebar's Library section and from Settings › Account.
import { useState } from 'react';
import { Button, EmptyState, TrashIcon } from '@livediagram/ui';
import { TRASH_RETENTION_DAYS } from '@livediagram/api-schema';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { InfoNote } from '@/components/primitives/InfoNote';
import { DiagramIcon } from '@/components/primitives/explorer-icons';
import { daysLeftLabel, trashGroups, type TrashGroup } from '@/lib/trash-groups';
import type { TrashController } from '@/hooks/persistence/useTrash';

type Confirming =
  | { kind: 'purge'; id: string; name: string; group: TrashGroup; anchor: HTMLElement }
  | { kind: 'empty'; group: TrashGroup; anchor: HTMLElement };

function deletedOn(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function TrashPane({ trash }: { trash: TrashController }) {
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  // One clock per visit keeps render pure; days left moves once a day.
  const [now] = useState(() => Date.now());
  const groups = trash.listing ? trashGroups(trash.listing) : null;

  return (
    <div className="flex flex-col gap-5">
      <InfoNote>
        Deleted diagrams wait here for {TRASH_RETENTION_DAYS} days, then they are removed for good.
        Restoring one puts it back where it was.
      </InfoNote>

      {groups === null ? (
        <p className="text-sm text-slate-400" role="status">
          Loading…
        </p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<TrashIcon size={18} />}
          title="Nothing in the Trash right now"
          description={`Delete a diagram and it is kept here for ${TRASH_RETENTION_DAYS} days, so you can restore it.`}
        />
      ) : (
        groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`trash-${group.key}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
              <div className="min-w-0">
                <h2
                  id={`trash-${group.key}`}
                  className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
                >
                  {group.title}
                </h2>
                {group.scope.kind === 'local' ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Offline diagrams, kept only in this browser.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={(e) => setConfirming({ kind: 'empty', group, anchor: e.currentTarget })}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                Empty Trash
              </button>
            </header>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {group.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <DiagramIcon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {row.name || 'Untitled diagram'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Deleted {deletedOn(row.trashedAt)} · {daysLeftLabel(row.trashedAt, now)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="xs"
                      aria-label={`Restore ${row.name || 'Untitled diagram'}`}
                      onClick={() => void trash.restore(row.id, group)}
                    >
                      Restore
                    </Button>
                    <button
                      type="button"
                      aria-label={`Delete ${row.name || 'Untitled diagram'} permanently`}
                      onClick={(e) =>
                        setConfirming({
                          kind: 'purge',
                          id: row.id,
                          name: row.name || 'Untitled diagram',
                          group,
                          anchor: e.currentTarget,
                        })
                      }
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                    >
                      Delete permanently
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message={
            confirming.kind === 'purge'
              ? `Delete "${confirming.name}" for good? This cannot be undone.`
              : emptyMessage(confirming.group)
          }
          confirmLabel={confirming.kind === 'purge' ? 'Delete permanently' : 'Empty Trash'}
          onConfirm={() => {
            if (confirming.kind === 'purge') {
              void trash.purge(confirming.id, confirming.group);
            } else {
              void trash.empty(confirming.group);
            }
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

function emptyMessage(group: TrashGroup): string {
  const n = group.rows.length;
  const what = n === 1 ? '1 diagram' : `${n} diagrams`;
  if (group.scope.kind === 'team') {
    return `Delete ${what} in ${group.title}'s Trash for good, for the whole team? This cannot be undone.`;
  }
  if (group.scope.kind === 'local') {
    return `Delete ${what} in this browser's Trash for good? This cannot be undone.`;
  }
  return `Delete ${what} in your Trash for good? This cannot be undone.`;
}
