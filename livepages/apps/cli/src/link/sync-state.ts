// Sync states (docs/specs/027-repositories/repository-link.md "Sync states"; blueprint "Sync states"): one tracked
// mirror file of a document, its recorded tabs, its tabs now and what the api answered, to one state. Pure.

import type { MirrorFile } from './mirror-file';
import type { TabHashes } from './mirror-scan';
import { remoteTabsOf, type EnvelopeFields, type RemoteFact } from './remote';

export type SyncState =
  'in-step' | 'behind' | 'ahead' | 'diverged' | 'new' | 'local-new' | 'gone' | 'unreadable';

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

// A tab in the file without a record, a record without a tab, or a tab hashing other than recorded.
export function isLocallyChanged(file: MirrorFile, hashes: TabHashes): boolean {
  const recorded = file.livediagramSync.tabs;
  if (!sameIds(Object.keys(hashes), Object.keys(recorded))) return true;
  return Object.entries(hashes).some(
    ([id, h]) => h.hash !== recorded[id]!.hash || h.settingsHash !== recorded[id]!.settingsHash,
  );
}

// The document's name, deck, tab order or a tab's folder differ from the file's (spec "A rename is a change", RL37).
export function envelopeDiffers(file: MirrorFile, envelope: EnvelopeFields): boolean {
  const { document } = file;
  const order = [...envelope.tabs].sort((a, b) => a.orderIndex - b.orderIndex).map((t) => t.id);
  return (
    document.name !== envelope.name ||
    (document.presentation ?? null) !== envelope.presentation ||
    order.join('\n') !== document.tabs.map((t) => t.id).join('\n') ||
    document.tabs.some(
      (t) => (t.folder ?? null) !== (envelope.tabs.find((e) => e.id === t.id)?.folder ?? null),
    )
  );
}

export function syncStateOf(input: {
  file: MirrorFile;
  hashes: TabHashes;
  remote: RemoteFact;
  // Null when the covered folder could not be read: nothing is judged outside coverage then (RL6).
  covered: boolean | null;
}): { state: SyncState | 'transient'; localChanged: boolean } {
  const { file, hashes, remote, covered } = input;
  const localChanged = isLocallyChanged(file, hashes);
  if (remote.kind === 'transient') return { state: 'transient', localChanged };
  if (remote.kind === 'unreadable') return { state: 'unreadable', localChanged };
  if (remote.kind === 'trashed' || covered === false) return { state: 'gone', localChanged };
  const recorded = file.livediagramSync.tabs;
  const tabs = remoteTabsOf(remote.overview);
  const remoteChanged =
    !sameIds(
      tabs.map((t) => t.tab.id),
      Object.keys(recorded),
    ) ||
    tabs.some((t) => t.rev !== recorded[t.tab.id]!.rev) ||
    (remote.envelope !== null && envelopeDiffers(file, remote.envelope));
  const state: SyncState = localChanged
    ? remoteChanged
      ? 'diverged'
      : 'ahead'
    : remoteChanged
      ? 'behind'
      : 'in-step';
  return { state, localChanged };
}
