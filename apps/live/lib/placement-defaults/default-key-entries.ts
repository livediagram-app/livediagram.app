// What each default key is called (docs/specs/013-workspace/default-folders.md "Entry names"): the
// label "New documents that open as" lists, and the plural a sentence uses. Typed per dimension, so
// a new editor mode, tab kind or template family does not compile until it is named here.
import {
  PLACEMENT_DEFAULT_KEYS,
  type PlacementDefaultKey,
  type SpecificTabKind,
  type TemplateFamily,
} from '@livediagram/api-schema';
import type { EditorMode } from '@livediagram/document';

export type DefaultKeyEntry = { key: PlacementDefaultKey; label: string; noun: string };

type Words = { label: string; noun: string };

const MODE_WORDS: Record<EditorMode, Words> = {
  diagram: { label: 'Diagrams', noun: 'diagrams' },
  draw: { label: 'Whiteboards', noun: 'whiteboards' },
};

const KIND_WORDS: Record<SpecificTabKind, Words> = {
  'event-storming': { label: 'Event Storming boards', noun: 'Event Storming boards' },
};

const FAMILY_WORDS: Record<TemplateFamily, Words> = {
  retrospective: { label: 'Retrospectives', noun: 'retrospectives' },
  kanban: { label: 'Kanban boards', noun: 'Kanban boards' },
};

function wordsOf(key: PlacementDefaultKey): Words {
  const [dimension, value] = key.split(':') as [string, string];
  if (dimension === 'mode') return MODE_WORDS[value as EditorMode];
  if (dimension === 'kind') return KIND_WORDS[value as SpecificTabKind];
  return FAMILY_WORDS[value as TemplateFamily];
}

/** Every entry, in the order the list shows them. */
export const DEFAULT_KEY_ENTRIES: readonly DefaultKeyEntry[] = PLACEMENT_DEFAULT_KEYS.map(
  (key) => ({ key, ...wordsOf(key) }),
);

export function defaultKeyEntry(key: PlacementDefaultKey): DefaultKeyEntry {
  return DEFAULT_KEY_ENTRIES.find((e) => e.key === key)!;
}

/** "a", "a and b", "a, b and c". */
export function joinNouns(nouns: readonly string[]): string {
  if (nouns.length <= 1) return nouns[0] ?? '';
  return `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}`;
}

/** The keys in list order, whatever order they came in. */
export function inListOrder(keys: readonly PlacementDefaultKey[]): PlacementDefaultKey[] {
  return PLACEMENT_DEFAULT_KEYS.filter((k) => keys.includes(k));
}

/** The default marker's words: "Default folder for new whiteboards"; empty for no keys. */
export function defaultFolderDescription(keys: readonly PlacementDefaultKey[]): string {
  if (keys.length === 0) return '';
  const nouns = inListOrder(keys).map((k) => defaultKeyEntry(k).noun);
  return `Default folder for new ${joinNouns(nouns)}`;
}
