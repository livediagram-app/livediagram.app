'use client';

// The parts of Snapshots that History draws too (liveworkspace/docs/specs/014-snapshots/snapshots.md "In History"):
// Take Snapshot with its optional name, and the notices over the list (a refusal, Reverted).

import { useState, type FormEvent } from 'react';
import { Button, TextInput } from '@liveworkspace/ui';
import { SNAPSHOT_NAME_MAX } from '../limits';
import type { SnapshotSummary } from '../wire';
import { snapshotTitle } from './snapshot-words';
import type { SnapshotsState } from './useSnapshots';

export function TakeSnapshotForm({
  state,
  className,
}: {
  state: SnapshotsState;
  className: string;
}) {
  const [name, setName] = useState('');
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
    <form onSubmit={submit} data-take-snapshot="" className={`flex flex-col gap-2 ${className}`}>
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
  );
}

export function SnapshotNotices({
  state,
  className,
}: {
  state: SnapshotsState;
  className: string;
}) {
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className={`rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200 ${className}`}
        >
          {state.error}
        </p>
      ) : null}
      {state.reverted ? (
        <p
          role="status"
          className={`rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${className}`}
        >
          Reverted. Reloading…
        </p>
      ) : null}
    </>
  );
}
