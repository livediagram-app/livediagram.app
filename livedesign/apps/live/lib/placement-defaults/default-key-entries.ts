// What each default key is called (docs/specs/013-workspace/default-folders.md "Entry names"): the
// label "New designs that open as" lists, and the plural a sentence uses. Typed by mode, so a new
// editor mode does not compile until it is named here.
import { PLACEMENT_DEFAULT_KEYS, type PlacementDefaultKey } from '@livedesign/api-schema';
import type { EditorMode } from '@livedesign/design';

type DefaultKeyEntry = { key: PlacementDefaultKey; label: string; noun: string };

type Words = { label: string; noun: string };

const MODE_WORDS: Record<EditorMode, Words> = {
  pages: { label: 'Designs', noun: 'designs' },
};

function wordsOf(key: PlacementDefaultKey): Words {
  return MODE_WORDS[key.slice('mode:'.length) as EditorMode];
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
