import { describe, expect, it } from 'vitest';
import {
  isSnapshotKind,
  readSnapshotStep,
  SNAPSHOT_KINDS,
  snapshotActions,
  snapshotStepChip,
  snapshotStepSummary,
  snapshotStepWould,
} from './actions';

// liveplanner automations.md "Snapshot steps": the snapshot steps' shared parts, as an app whose engine is its own
// reads, words and plans them.
describe('snapshot steps, shared', () => {
  it('knows its two kinds and nothing else', () => {
    expect(SNAPSHOT_KINDS).toEqual(['take_snapshot', 'revert_snapshot']);
    expect(isSnapshotKind('take_snapshot')).toBe(true);
    expect(isSnapshotKind('revert_snapshot')).toBe(true);
    expect(isSnapshotKind('comment')).toBe(false);
    expect(isSnapshotKind(undefined)).toBe(false);
    expect(snapshotActions().map((a) => a.kind)).toEqual(['take_snapshot', 'revert_snapshot']);
  });

  it('reads Take Snapshot with the caller’s value check', () => {
    expect(
      readSnapshotStep({ kind: 'take_snapshot', name: 'Weekly {{now.date}}' }, 's.0', {}),
    ).toEqual({
      kind: 'take_snapshot',
      name: 'Weekly {{now.date}}',
    });
    expect(() =>
      readSnapshotStep({ kind: 'take_snapshot', name: '{{nope}}' }, 's.0', {
        unknownValue: () => 'nope',
      }),
    ).toThrow('{{nope}} is not a value');
    expect(() =>
      readSnapshotStep({ kind: 'take_snapshot', name: 'x'.repeat(121) }, 's.0', {}),
    ).toThrow('s.0.name must be text of 1 to 120 characters');
  });

  it('reads a revert with its snapshot, keeping a name only when given', () => {
    expect(readSnapshotStep({ kind: 'revert_snapshot', snapshot: 'sn1' }, 's.0', {})).toEqual({
      kind: 'revert_snapshot',
      snapshot: 'sn1',
    });
    expect(
      readSnapshotStep({ kind: 'revert_snapshot', snapshot: 'sn1', name: ' Monday ' }, 's.0', {}),
    ).toEqual({ kind: 'revert_snapshot', snapshot: 'sn1', name: 'Monday' });
  });

  it('words each step: chips, a dry run’s lines and the summary', () => {
    const take = { kind: 'take_snapshot', name: 'Weekly {{now.date}}' } as const;
    const revert = { kind: 'revert_snapshot', snapshot: 'sn1', name: 'Monday' } as const;
    expect(snapshotStepChip(take)).toBe('Take Snapshot “Weekly {{now.date}}”');
    expect(snapshotStepChip({ kind: 'revert_snapshot', snapshot: '' })).toBe(
      'Revert to Snapshot (pick one)',
    );
    expect(snapshotStepChip(revert)).toBe('Revert to “Monday”');
    expect(snapshotStepChip(revert, 'Start of Week')).toBe('Revert to “Start of Week”');
    expect(snapshotStepChip({ kind: 'revert_snapshot', snapshot: 'sn1' })).toBe(
      'Revert to “a snapshot”',
    );
    expect(snapshotStepWould(take, (t) => t.replace('{{now.date}}', '22 Nov'))).toBe(
      'Would take a snapshot named “Weekly 22 Nov”',
    );
    expect(snapshotStepWould(revert, String)).toBe('Would revert to “Monday”');
    expect(snapshotStepWould(revert, String, 'Start')).toBe('Would revert to “Start”');
    expect(snapshotStepWould({ kind: 'revert_snapshot', snapshot: 'sn1' }, String)).toBe(
      'Would revert to “a snapshot”',
    );
    expect(snapshotStepSummary(take)).toBe('Take Snapshot');
    expect(snapshotStepSummary(revert)).toBe('Revert to Snapshot');
  });
});
