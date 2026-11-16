'use client';

// The Snapshots dialog (liveworkspace/docs/specs/014-snapshots/snapshots.md "In the editor"; blueprint SN24, SN25): take
// one with an optional name, then the latest five, newest first, each with Revert and Delete confirmed in place in its
// own row. A sheet on a phone. Escape inside a confirm cancels the confirm, not the dialog.

import { useState, type FormEvent } from 'react';
import {
  Button,
  CompactEmptyState,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  LoadingSweep,
  TextInput,
} from '@liveworkspace/ui';
import { SNAPSHOT_NAME_MAX } from '../limits';
import type { SnapshotSummary } from '../wire';
import type { SnapshotsDoor } from './door';
import { SnapshotGlyph } from './glyphs';
import { SnapshotRow, type RowConfirm } from './SnapshotRow';
import { snapshotTitle } from './snapshot-words';
import { useSnapshots } from './useSnapshots';

export function SnapshotsDialog({
  door,
  onClose,
  now = Date.now,
}: {
  door: SnapshotsDoor;
  onClose: () => void;
  now?: () => number;
}) {
  const state = useSnapshots(door.api);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<RowConfirm>(null);
  const list = state.snapshots;
  const full = list !== null && list.length >= state.kept;
  const oldest: SnapshotSummary | undefined = full ? list[list.length - 1] : undefined;
  const working = state.busy !== null || state.reverted;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (working) return;
    if (await state.take(name)) setName('');
  };

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
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            aria-label="Snapshot name"
            placeholder="Name this snapshot (optional)"
            value={name}
            maxLength={SNAPSHOT_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
            disabled={state.reverted}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            busy={state.busy?.kind === 'take'}
            disabled={working && state.busy?.kind !== 'take'}
          >
            {state.busy?.kind === 'take' ? 'Taking…' : 'Take Snapshot'}
          </Button>
        </div>
        {oldest ? (
          <p className="text-xs text-slate-600 dark:text-slate-300" data-snapshots-full="">
            Taking another removes the oldest, “{snapshotTitle(oldest)}”.
          </p>
        ) : null}
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {state.error ? (
          <p
            role="alert"
            className="mx-3 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200"
          >
            {state.error}
          </p>
        ) : null}
        {state.reverted ? (
          <p
            role="status"
            className="mx-3 mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Reverted. Reloading…
          </p>
        ) : null}
        {list === null ? (
          <div className="flex justify-center py-10" aria-label="Loading snapshots" role="status">
            <LoadingSweep />
          </div>
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
    </Dialog>
  );
}
