'use client';

// Take Snapshot and Revert to Snapshot (blueprint item-ui.md "Panels"; automations.md "Revert to Snapshot"). Take
// names the snapshot, with values. Revert picks one of the item's snapshots, read when this panel first shows, and
// says plainly what a revert does to everyone's work; an item with no snapshot says where to take one.

import {
  STEP_NAME_MAX,
  type ItemRevertSnapshot,
  type ItemTakeSnapshot,
} from '@liveworkspace/automations/item';
import { useEffect } from 'react';
import { Button, CompactEmptyState } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { ActionPanelProps } from '../../kit';
import { useAutomationsKit } from '../../kit-context';
import { PanelField, PanelNote, PanelSelect } from '../../step-panels/panel-parts';
import { ValueTextField } from '../../ValueInsert';
import { snapshotLabel } from '../outline';
import { CameraGlyph } from '../scenes/scene-bits';
import type { ItemUiOutline } from '../types';
import { goneLabel } from '../words';

type Props<Step> = ActionPanelProps<Step, ItemUiOutline>;

export function TakeSnapshotPanel({ action, onChange, invalidPath }: Props<ItemTakeSnapshot>) {
  return (
    <ValueTextField
      label="Name"
      multiline={false}
      maxLength={STEP_NAME_MAX}
      value={action.name}
      invalid={invalidPath === 'name' || invalidPath === ''}
      hint="The snapshot’s name in History. Values are filled in when the rule runs."
      onChange={(name) => onChange({ ...action, name })}
    />
  );
}

function RevertWarning() {
  const { item } = useAutomationsKit().plumbing.words;
  return (
    <Callout tone="warning" size="md" title="This Replaces Everyone’s Work">
      When the rule runs, the whole {item} goes back to this snapshot for everyone. Everything
      changed since then is replaced. A safety snapshot is taken first, so History can bring that
      moment back. The snapshot you pick is kept, beside the latest five, while a rule names it.
    </Callout>
  );
}

export function RevertSnapshotPanel({
  action,
  onChange,
  outline,
  invalidPath,
}: Props<ItemRevertSnapshot>) {
  const { item } = useAutomationsKit().plumbing.words;
  const { status, list, ask, retry } = outline.snapshots;
  // The list is read when a Revert panel first shows, once while the screen is open.
  useEffect(() => ask(), [ask]);
  if (status === 'error')
    return (
      <div className="flex flex-col gap-2">
        <PanelNote>
          Couldn’t load this {item}’s snapshots. Check your connection and try again.
        </PanelNote>
        <Button variant="secondary" size="xs" className="self-start" onClick={retry}>
          Try Again
        </Button>
      </div>
    );
  const loading = status !== 'ready';
  const known = list.some((s) => s.id === action.snapshot);
  if (!loading && list.length === 0 && !action.snapshot)
    return (
      <div className="flex flex-col gap-4">
        <CompactEmptyState
          role="status"
          icon={<CameraGlyph size={18} />}
          title="No snapshots yet"
          description="Take a snapshot first, in History. Then pick it here."
        />
        <RevertWarning />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <PanelField label="Snapshot" hint="Nothing follows this step: it ends the rule.">
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            aria-invalid={invalidPath === 'snapshot' || invalidPath === '' || undefined}
            value={action.snapshot}
            disabled={loading}
            onChange={(e) => {
              const picked = list.find((s) => s.id === e.target.value);
              if (picked)
                onChange({
                  kind: 'revert_snapshot',
                  snapshot: picked.id,
                  name: snapshotLabel(picked).slice(0, STEP_NAME_MAX),
                });
            }}
          >
            {loading ? <option value={action.snapshot}>Loading snapshots…</option> : null}
            {!loading && !action.snapshot ? <option value="">Pick a snapshot</option> : null}
            {!loading && action.snapshot && !known ? (
              <option value={action.snapshot}>{goneLabel('snapshot', action.name)}</option>
            ) : null}
            {loading
              ? null
              : list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {snapshotLabel(s)}
                    {s.kept ? ' · Kept by a Rule' : ''}
                  </option>
                ))}
          </PanelSelect>
        )}
      </PanelField>
      <RevertWarning />
    </div>
  );
}
