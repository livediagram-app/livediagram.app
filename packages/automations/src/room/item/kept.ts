// The snapshots an item keeps for its rules (liveworkspace/docs/specs/018-automations/automations.md "Revert to
// Snapshot"): the ids its rules name, on or off, for the snapshots door's `kept`.
import { ruleSnapshotIds, type ItemRule } from '../../item';
import type { AutomationStore } from '../automation-store';

export const keptSnapshotIds = (store: AutomationStore<ItemRule>): string[] =>
  ruleSnapshotIds(store.list());
