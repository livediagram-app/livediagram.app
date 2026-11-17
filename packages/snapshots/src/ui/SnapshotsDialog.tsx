'use client';

// Snapshots on their own (liveworkspace/docs/specs/014-snapshots/snapshots.md "In History"; blueprint SN24, SN25): what
// the footer's History shows someone who may take snapshots but has no account history to read (an Editor through a
// share link). Take one with an optional name, then the latest five, newest first, each with Revert and Delete
// confirmed in place in its own row. Drawn inside Tools; a sheet on a phone anywhere else. Escape inside a confirm
// cancels the confirm, not the dialog. `after`: a line under the list (History's account prompt, Version History).

import { useState, type ReactNode } from 'react';
import {
  Button,
  CompactEmptyState,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  SkeletonRows,
} from '@liveworkspace/ui';
import type { SnapshotsDoor } from './door';
import { SnapshotGlyph } from './glyphs';
import { SnapshotButton, SnapshotNotices } from './snapshot-parts';
import { SnapshotRow, type RowConfirm } from './SnapshotRow';
import { useSnapshots } from './useSnapshots';

export function SnapshotsDialog({
  door,
  onClose,
  after,
  now = Date.now,
}: {
  door: SnapshotsDoor;
  onClose: () => void;
  after?: ReactNode;
  now?: () => number;
}) {
  const state = useSnapshots(door.api);
  const [confirm, setConfirm] = useState<RowConfirm>(null);
  const list = state.snapshots;
  const working = state.busy !== null || state.reverted;

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Snapshots"
      size="md"
      phoneSheet
      closeOnEscape={confirm === null}
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Snapshots"
        subtitle={`Save points for the whole ${door.noun}. The latest ${state.kept} are kept.`}
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <SnapshotButton state={state} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <SnapshotNotices state={state} className="mx-3 mb-3" />
        {list === null ? (
          <SkeletonRows label="Loading snapshots" rows={3} lead="disc" className="px-3 py-2" />
        ) : list.length === 0 && state.listFailed ? (
          <div role="alert">
            <CompactEmptyState
              icon={<SnapshotGlyph size={18} />}
              title="Couldn't load snapshots"
              description="Check your connection, then try again."
              className="py-8"
              action={
                <Button variant="secondary" size="sm" onClick={state.retry}>
                  Try Again
                </Button>
              }
            />
          </div>
        ) : list.length === 0 ? (
          <CompactEmptyState
            icon={<SnapshotGlyph size={18} />}
            title="No snapshots yet"
            description="Take one before a big change, so you can come back to it."
            className="py-8"
          />
        ) : (
          <ul aria-label="Snapshots" className="flex flex-col gap-1">
            {list.map((snapshot) => (
              <SnapshotRow
                key={snapshot.id}
                snapshot={snapshot}
                noun={door.noun}
                viewerId={door.viewerId}
                now={now()}
                confirm={confirm?.id === snapshot.id ? confirm.kind : null}
                busy={state.busy}
                locked={working}
                onConfirm={(kind) => setConfirm(kind ? { id: snapshot.id, kind } : null)}
                onRevert={async () => {
                  await state.revert(snapshot.id);
                  setConfirm(null);
                }}
                onDelete={async () => {
                  await state.remove(snapshot.id);
                  setConfirm(null);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      {after ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{after}</div>
      ) : null}
    </Dialog>
  );
}
