// Default folders: where a person's new items land when they make one without choosing a place. One default
// per entry: the host app's kind ("Plans": every new plan no more specific entry holds), then each mode and kind the
// host names ("Whiteboards", "Event Storming boards"), then each of its template families ("Kanban plans"). Per
// person and per app; the index keeps them (`/placement-defaults`) and files a new item by them
// (placementDefaultKeysFor: kind, then template, then mode, then the app's). These are the entries' words.

import {
  placementDefaultKey,
  placementDimensionKey,
  type App,
  type Folder,
} from '@liveworkspace/index-client';
import type { LensOption } from '../lens';
import type { Words } from '../words';
import { quoted } from '../quoted';

export type DefaultEntry = {
  key: string;
  // In a list: "Plans", "Kanban plans".
  label: string;
  // Inside a sentence: "plans", "Kanban plans".
  noun: string;
};

/** A default the host offers for what its items open in (`mode`) or the kind of their first tab (`kind`), from
 *  the parts of its creation intent: livediagram's Diagrams, Whiteboards, Sessions, Event Storming boards. */
export type DefaultFolderOption = {
  dimension: 'mode' | 'kind';
  value: string;
  // In a list: "Whiteboards".
  label: string;
  // Inside a sentence: "whiteboards".
  noun: string;
};

/** The entries, in the order every surface lists them: the app's kind, the host's modes and kinds, then its
 *  template families. */
export function defaultEntries(
  app: App,
  kind: Words,
  templates: readonly LensOption[],
  options: readonly DefaultFolderOption[] = [],
): DefaultEntry[] {
  return [
    { key: placementDefaultKey(app), label: kind.many, noun: kind.lowerMany },
    ...options.map((o) => ({
      key: placementDimensionKey(app, o.dimension, o.value),
      label: o.label,
      noun: o.noun,
    })),
    ...templates.map((t) => ({
      key: placementDefaultKey(app, t.value),
      label: `${t.label} ${kind.lowerMany}`,
      noun: `${t.label} ${kind.lowerMany}`,
    })),
  ];
}

/** "a", "a and b", "a, b and c". */
export function joinNouns(nouns: readonly string[]): string {
  if (nouns.length <= 1) return nouns[0] ?? '';
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}

/** The entries this folder is the default for, in list order. */
export function folderDefaultEntries(
  folderId: string,
  defaults: ReadonlyMap<string, string>,
  entries: readonly DefaultEntry[],
): DefaultEntry[] {
  return entries.filter((e) => defaults.get(e.key) === folderId);
}

/** The marker's words: "Default folder for new plans and Kanban plans"; empty for none. */
export function defaultFolderDescription(held: readonly DefaultEntry[]): string {
  if (held.length === 0) return '';
  return `Default folder for new ${joinNouns(held.map((e) => e.noun))}`;
}

/**
 * The folder delete confirmation's words (one wording for personal and team folders): where its contents go,
 * and, when it is one of the reader's default folders, what changes.
 */
export function folderDeleteConfirmation(input: {
  name: string;
  // The parent folder's name; null for a folder at the top of its space.
  parentName: string | null;
  // The team's name for a team folder; null for one of the reader's own.
  teamName: string | null;
  kind: Pick<Words, 'lowerMany'>;
  held: readonly DefaultEntry[];
}): { title: string; message: string; confirmLabel: string } {
  const to =
    input.parentName !== null
      ? `${quoted(input.parentName)}`
      : input.teamName !== null
        ? `the top of ${input.teamName}`
        : 'My Work';
  const lines = [
    `Its ${input.kind.lowerMany} and subfolders move to ${to}. Nothing in it is deleted.`,
  ];
  if (input.held.length > 0) {
    lines.push(
      `New ${joinNouns(input.held.map((e) => e.noun))} are saved here by default. Choose another default folder in Default Folders.`,
    );
  }
  return {
    title: `Delete ${quoted(input.name || 'this folder')}?`,
    message: lines.join('\n'),
    confirmLabel: 'Delete Folder',
  };
}

export type DefaultDestination =
  | { kind: 'root' }
  | { kind: 'folder'; folder: Folder; teamName: string | null }
  // A default whose folder the reader can no longer reach (a team they left): new items go elsewhere.
  | { kind: 'unreachable'; fallback: Folder | null };

/** Where new items of this entry go now, as the Default Folders list says it. */
export function destinationOf(
  entry: DefaultEntry,
  entries: readonly DefaultEntry[],
  defaults: ReadonlyMap<string, string>,
  byId: ReadonlyMap<string, Folder>,
  teamName: (id: string | null) => string | null,
): DefaultDestination {
  const id = defaults.get(entry.key);
  if (!id) return { kind: 'root' };
  const folder = byId.get(id);
  if (folder) return { kind: 'folder', folder, teamName: teamName(folder.teamId) };
  // A template's items fall back to the app's default (the first entry), as a create does.
  const app = entries[0];
  const appFolder =
    app && app.key !== entry.key ? byId.get(defaults.get(app.key) ?? '') : undefined;
  return { kind: 'unreachable', fallback: appFolder ?? null };
}
