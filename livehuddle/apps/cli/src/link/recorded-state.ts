// States without mirror files (docs/specs/027-repositories/blueprints/repository-link.md "States without mirror
// files"): at `index` and `none` a document's state comes from what the local sync state recorded at its last sync
// on this machine (RL36, RL44). Local changes cannot exist, so neither can `ahead` or `diverged`. Pure.

import { remoteTabsOf, type RemoteFact } from './remote';
import type { SyncState } from './sync-state';

export type RecordedDocument = {
  name: string;
  tabs: Record<string, { rev: number; syncedAt: number }>;
};

export function recordedStateOf(input: {
  remote: RemoteFact;
  covered: boolean | null;
  recorded: RecordedDocument | undefined;
}): SyncState | 'transient' {
  const { remote, covered, recorded } = input;
  if (remote.kind === 'transient') return 'transient';
  if (remote.kind === 'unreadable') return 'unreadable';
  if (remote.kind === 'trashed' || covered === false) return 'gone';
  if (!recorded) return 'new';
  const tabs = remoteTabsOf(remote.overview);
  const ids = Object.keys(recorded.tabs);
  const same =
    remote.overview.document.name === recorded.name &&
    tabs.length === ids.length &&
    tabs.every((t) => recorded.tabs[t.tab.id]?.rev === t.rev);
  return same ? 'in-step' : 'behind';
}
