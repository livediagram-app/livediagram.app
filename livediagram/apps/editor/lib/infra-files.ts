// The infrastructure panels' rules (docs/specs/020-import-export/infrastructure-import.md "The editor" and "Updating a
// tab from its files"; blueprint "The panels' rules"): a file is an entry with a state, and these say which files an
// Import or an Update reads, when the update cannot run, and where a dropped file goes. Pure, so the panels stay thin
// and the parsers stay out of this module.

import type { DiagramSources } from '@livediagram/document';

// `new`: added in this panel. `kept`: remembered, its text used again. `replaced`: remembered, a new text given.
// `needed`: remembered by name only, so it must be given again. `removed`: taken out; `was` says what Keep restores.
export type InfraEntryState = 'new' | 'kept' | 'replaced' | 'needed' | 'removed';

export type InfraEntry = {
  // Stable across edits, for the row's key.
  id: string;
  name: string;
  state: InfraEntryState;
  // The text read, absent while `needed` (and for a removed entry that was needed).
  text?: string;
  // The remembered text's fingerprint, so a replacement can say "No changes", and its format, for a row with no text.
  hash?: string;
  format?: string;
  was?: Exclude<InfraEntryState, 'removed'>;
};

let next = 0;
const entryId = () => `infra-${++next}`;

// The last path part: a remembered `apps/api/wrangler.toml` matches a picked `wrangler.toml`.
export const baseName = (name: string) => name.slice(name.lastIndexOf('/') + 1);

export function entriesFromSources(sources: Pick<DiagramSources, 'files'>): InfraEntry[] {
  return sources.files.map((f) =>
    f.text === undefined
      ? { id: entryId(), name: f.name, state: 'needed', hash: f.hash, format: f.format }
      : {
          id: entryId(),
          name: f.name,
          state: 'kept',
          text: f.text,
          hash: f.hash,
          format: f.format,
        },
  );
}

export function newEntries(files: readonly { name: string; text: string }[]): InfraEntry[] {
  return files.map((f) => ({ id: entryId(), name: f.name, state: 'new', text: f.text }));
}

// The files an Import or an Update reads, in the panel's order.
export function entriesToFiles(entries: readonly InfraEntry[]): { name: string; text: string }[] {
  return entries.flatMap((e) =>
    e.state !== 'removed' && e.state !== 'needed' && e.text !== undefined
      ? [{ name: e.name, text: e.text }]
      : [],
  );
}

export function updateBlocked(entries: readonly InfraEntry[]): boolean {
  return entries.some((e) => e.state === 'needed') || entriesToFiles(entries).length === 0;
}

// A new text for a remembered entry (or a new one's text changed).
export function replaceEntry(entry: InfraEntry, text: string): InfraEntry {
  const { was: _was, ...rest } = entry;
  return { ...rest, text, state: entry.state === 'new' ? 'new' : 'replaced' };
}

export function toggleRemoved(entry: InfraEntry): InfraEntry {
  if (entry.state === 'removed') {
    const { was, ...rest } = entry;
    return { ...rest, state: was ?? 'kept' };
  }
  return { ...entry, state: 'removed', was: entry.state };
}

// Dropped or picked files on the update panel: each replaces the first remembered entry of the same base name, else
// is added.
export function matchDropped(
  entries: readonly InfraEntry[],
  files: readonly { name: string; text: string }[],
): InfraEntry[] {
  const out = [...entries];
  for (const f of files) {
    const at = out.findIndex(
      (e) =>
        (e.state === 'kept' || e.state === 'needed' || e.state === 'replaced') &&
        baseName(e.name) === baseName(f.name),
    );
    if (at === -1) out.push(...newEntries([f]));
    else out[at] = replaceEntry(out[at]!, f.text);
  }
  return out;
}

// What a row says of its entry. `unchanged`: a replacement whose fingerprint matches the remembered one.
export function entryStateLabel(entry: InfraEntry, unchanged: boolean): string {
  switch (entry.state) {
    case 'kept':
      return 'Kept';
    case 'replaced':
      return unchanged ? 'No changes' : 'Replaced';
    case 'needed':
      return 'Needed';
    case 'removed':
      return 'Removed';
    default:
      return 'New';
  }
}
