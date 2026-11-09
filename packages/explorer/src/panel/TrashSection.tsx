'use client';

import { useMemo, useState } from 'react';
import { useItemList } from '../data/useItemList';
import { viewList } from '../data/viewLists';
import type { ShownItem } from '../data/overlay';
import { useExplorer } from '../explorer/context';
import { emptyCopy } from '../explorer/EmptyPane';
import { Button, ConfirmDialog } from '@liveworkspace/ui';
import { daysLeftLabel, trashedOnLabel, trashGroups } from '../explorer/TrashPane';
import { ItemIcon, RestoreIcon, TrashIcon } from '../ui/icons';
import { useNow } from '../time';
import { quoted } from '../quoted';
import {
  PANE_LINK,
  PaneEmpty,
  PaneFailed,
  PaneIconButton,
  PaneList,
  PaneRow,
  PaneSection,
  PaneSkeleton,
  PaneTile,
} from './pane-parts';

// ---- The Trash ------------------------------------------------------------------------------------------

export function TrashSection() {
  const { client, app, filter, overlay, epoch, actions, teamName, words, kind } = useExplorer();
  const list = useMemo(
    () => viewList(client, { kind: 'trash' }, app, filter),
    [client, app, filter],
  );
  const state = useItemList({
    key: list?.key ?? 'trash',
    load: list!.load,
    overlay,
    belongs: list?.belongs,
    epoch,
  });
  const now = useNow();
  const [confirming, setConfirming] = useState<ShownItem | null>(null);
  if (state.error) return <PaneFailed message="The Trash could not load." onRetry={state.retry} />;
  if (state.loading) return <PaneSkeleton rows={4} />;
  const groups = trashGroups(state.items, teamName, words);
  if (!groups.length) {
    const copy = emptyCopy({ kind: 'trash' }, words);
    return <PaneEmpty icon={copy.icon} title={copy.title} description={copy.description} />;
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Deleted {words.lowerMany} wait here for 30 days. Restoring one puts it back where it was.
      </p>
      {groups.map((group) => (
        <PaneSection key={group.key} title={group.title}>
          <PaneList label={group.title}>
            {group.rows.map((row) => (
              <PaneRow
                key={row.id}
                leading={
                  <PaneTile tone="rose">
                    <ItemIcon />
                  </PaneTile>
                }
                title={row.title || `Untitled ${kind.lowerOne}`}
                meta={`${trashedOnLabel(row)} · ${daysLeftLabel(row.trashedAt ?? 0, now || Date.now())}`}
                trailing={
                  <>
                    <PaneIconButton label="Restore" onClick={() => void actions.restore(row)}>
                      <RestoreIcon />
                    </PaneIconButton>
                    <PaneIconButton
                      label="Delete Forever"
                      tone="danger"
                      onClick={() => setConfirming(row)}
                    >
                      <TrashIcon />
                    </PaneIconButton>
                  </>
                }
              />
            ))}
          </PaneList>
        </PaneSection>
      ))}
      {state.hasMore ? (
        <Button
          variant="none"
          busy={state.loadingMore}
          onClick={state.moreFailed ? state.retryMore : state.loadMore}
          className={`${PANE_LINK} self-center py-1`}
        >
          {state.loadingMore
            ? 'Loading…'
            : state.moreFailed
              ? 'Couldn’t load more. Try again'
              : 'Show more'}
        </Button>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          open
          // The Explorer page's own confirmation (TrashPane), word for word.
          title={`Delete ${quoted(confirming.title || 'Untitled')} for good?`}
          message="This cannot be undone."
          confirmLabel="Delete permanently"
          onConfirm={() => {
            void actions.purge(confirming);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}
