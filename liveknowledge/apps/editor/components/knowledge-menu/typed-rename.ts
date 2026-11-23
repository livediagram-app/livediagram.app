// Typing a new name at the knowledgebase's menu (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// knowledgebase's menu"): the name is the menu's button, so a person who presses it and types a name is renaming. The
// menu's letters still jump to a row while they spell the start of one; the first letter that spells no row starts
// Rename with everything typed so far, so no letter is lost and a space inside the name never presses the focused row
// (Work Tracker 1376: "Team Handbook" was saved as "Handbook", the space pressing Rename after "Team" found no row).
import { MENU_TYPEAHEAD_RESET_MS } from '@liveworkspace/ui';

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
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  // A printable character is one code point long; named keys (Enter, Shift, F5) are words.
  if ([...e.key].length !== 1) return null;
  const fresh = prev.text === '' || e.at - prev.at >= MENU_TYPEAHEAD_RESET_MS;
  if (e.key === ' ' && fresh) return null;
  const text = (fresh ? '' : prev.text) + e.key;
  const query = text.toLowerCase();
  // One letter typed again cycles the rows that start with it, as the menu's typeahead does.
  const needle = [...query].every((c) => c === query[0]) ? query[0]! : query;
  const spellsRow = labels.some((l) => l.trim().toLowerCase().startsWith(needle));
  return spellsRow ? { kind: 'search', typed: { text, at: e.at } } : { kind: 'rename', text };
}
