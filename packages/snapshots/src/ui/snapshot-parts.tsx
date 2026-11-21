'use client';

// The parts of Snapshots that History draws too (liveworkspace/docs/specs/014-snapshots/snapshots.md "In History"):
// Take Snapshot with its optional name, and the notices over the list (a refusal, Reverted).

import { useId, useState, type FormEvent } from 'react';
import { Button, ResponsivePopover, TextInput, ToolFooterButton } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { historyHeroArt } from '@liveworkspace/ui/dialog-hero-art/history';
import { SnapshotGlyph } from './glyphs';
import { SNAPSHOT_NAME_MAX } from '../limits';
import type { SnapshotSummary } from '../wire';
import { snapshotTitle } from './snapshot-words';
import type { SnapshotsState } from './useSnapshots';
import { Callout } from '@liveworkspace/ui/callout';

export function TakeSnapshotForm({
  state,
  className,
  onTaken,
}: {
  state: SnapshotsState;
  className: string;
  /** The snapshot was taken (the popover closes). */
  onTaken?: () => void;
}) {
  const [name, setName] = useState('');
  // One a rule keeps is beside the latest five: never counted, never the one the next take removes.
  const counted = (state.snapshots ?? []).filter((s) => !s.kept);
  const full = counted.length >= state.kept;
  const oldest: SnapshotSummary | undefined = full ? counted[counted.length - 1] : undefined;
  const working = state.busy !== null || state.reverted;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (working) return;
    if (await state.take(name)) {
      setName('');
      onTaken?.();
    }
  };
  return (
    <form onSubmit={submit} data-take-snapshot="" className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <TextInput
          autoFocus
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
        <Callout tone="error" role="alert" className={className}>
          {state.error}
        </Callout>
      ) : null}
      {state.reverted ? (
        <Callout tone="info" role="status" className={className}>
          Reverted. Reloading…
        </Callout>
      ) : null}
    </>
  );
}

/** The Snapshot button (snapshots.md "In History"): Take a Snapshot is not always on show; the button opens its form
 *  beside the list as a popover (a drawer from the bottom on a phone), which closes once the snapshot is taken. */
export function SnapshotButton({ state }: { state: SnapshotsState }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const close = () => setAnchor(null);
  return (
    <>
      {/* The tools' main footer button (owner, 2026-11-17: one look across every tool). */}
      <ToolFooterButton
        data-snapshot-button=""
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        disabled={state.reverted}
        onClick={(e) =>
          // Beside the surface it is in (Tools, or the Snapshots dialog), else the button.
          setAnchor(e.currentTarget.closest<HTMLElement>('[role="dialog"]') ?? e.currentTarget)
        }
      >
        <SnapshotGlyph size={14} />
        Take Snapshot
      </ToolFooterButton>
      <ResponsivePopover
        open={anchor !== null}
        onClose={close}
        anchor={anchor}
        titleId={titleId}
        width={400}
        placement="side"
        bare
      >
        <HeroDialogHeader
          art={historyHeroArt}
          titleId={titleId}
          title="Take a Snapshot"
          onClose={close}
        />
        <TakeSnapshotForm state={state} className="px-5 py-4" onTaken={close} />
      </ResponsivePopover>
    </>
  );
}
