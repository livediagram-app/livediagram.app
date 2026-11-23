// Typing a new name at the knowledgebase's menu (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// knowledgebase's menu"): the name is the menu's button, so a person who presses it and types a name is renaming. The
// menu's letters still jump to a row while they spell the start of one; the first letter that spells no row starts
// Rename with everything typed so far, so no letter is lost (Work Tracker 1376: "Team Handbook" was saved as
// "Handbook"). What counts as typing, and that a space inside a search joins it, is the shared menu's own rule
// (menuKeyIntent and typeaheadActive in @liveworkspace/ui, Work Tracker 1380), so the two never disagree.
import { menuKeyIntent, typeaheadActive, typeaheadIndex } from '@liveworkspace/ui';

export type TypedName = { text: string; at: number };

export const NO_TYPED_NAME: TypedName = { text: '', at: 0 };

export type TypedKey = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  // The key's time in ms (an event's timeStamp).
  at: number;
};

/**
 * What one key press at the open menu means: `rename` with the name typed so far, `search` to leave it to the menu's
 * own typeahead (carrying the text on), or null for a key that is not typing (an arrow, Enter, a shortcut, or a
 * space that starts no search: the focused row's press).
 */
export function typedNameKey(
  prev: TypedName,
  e: TypedKey,
  labels: readonly string[],
): { kind: 'rename'; text: string } | { kind: 'search'; typed: TypedName } | null {
  const searching = typeaheadActive({ query: prev.text, at: prev.at }, e.at);
  const intent = menuKeyIntent(
    { ...e, shiftKey: false },
    { inSubmenu: false, onSubmenuTrigger: false, searching },
  );
  if (intent?.kind !== 'type') return null;
  const text = (searching ? prev.text : '') + e.key;
  // One letter typed again cycles the rows that start with it, as the menu's typeahead does.
  const spellsRow = typeaheadIndex(labels, -1, text.toLowerCase()) >= 0;
  return spellsRow ? { kind: 'search', typed: { text, at: e.at } } : { kind: 'rename', text };
}
