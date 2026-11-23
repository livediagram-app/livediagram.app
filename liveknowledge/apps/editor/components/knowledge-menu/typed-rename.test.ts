import { describe, expect, it } from 'vitest';
import { MENU_TYPEAHEAD_RESET_MS } from '@liveworkspace/ui';
import { NO_TYPED_NAME, typedNameKey, type TypedName } from './typed-rename';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The knowledgebase's menu": a name typed at the open menu
// renames (Work Tracker 1376).
const LABELS = [
  'Rename',
  'Describe to Add Pages',
  'Import',
  'Export',
  'Publish to the Web',
  'AI Settings',
  'Delete',
];
const key = (
  k: string,
  at: number,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {},
) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  at,
  ...mods,
});

/** Types `text` one key every `gap` ms; answers the first rename, or the search left at the end. */
function typeAll(text: string, gap = 40) {
  let typed: TypedName = NO_TYPED_NAME;
  let at = 1000;
  for (const k of text) {
    const step = typedNameKey(typed, key(k, at), LABELS);
    if (step?.kind === 'rename') return step;
    if (step?.kind === 'search') typed = step.typed;
    at += gap;
  }
  return { kind: 'search' as const, typed };
}

describe('typedNameKey', () => {
  it('starts Rename at the first letter that spells no row, with every letter typed', () => {
    // "T" spells no row: the rename starts on it, and the space after "Team" is the name's, never a row's press.
    expect(typeAll('Team Handbook')).toEqual({ kind: 'rename', text: 'T' });
    // "R" and "Re" spell Rename; "Rel" spells nothing.
    expect(typeAll('Release Notes')).toEqual({ kind: 'rename', text: 'Rel' });
    // A name that starts as a row does carries on past it, its space included.
    expect(typeAll('Export Guides')).toEqual({ kind: 'rename', text: 'Export ' });
  });

  it('leaves letters that spell a row to the menu’s typeahead', () => {
    expect(typeAll('Exp')).toEqual({ kind: 'search', typed: { text: 'Exp', at: 1080 } });
    // A letter typed again cycles the rows that start with it, as the typeahead does.
    expect(typeAll('ee')).toEqual({ kind: 'search', typed: { text: 'ee', at: 1040 } });
    // Case does not matter.
    expect(typedNameKey(NO_TYPED_NAME, key('d', 0), LABELS)).toEqual({
      kind: 'search',
      typed: { text: 'd', at: 0 },
    });
  });

  it('starts afresh after the typeahead’s pause, as the menu’s search does', () => {
    const typed = { text: 'Re', at: 1000 };
    // Within the pause "Rel" spells no row; after it, "l" alone does not either, and starts from "l".
    expect(typedNameKey(typed, key('l', 1000 + MENU_TYPEAHEAD_RESET_MS - 1), LABELS)).toEqual({
      kind: 'rename',
      text: 'Rel',
    });
    expect(typedNameKey(typed, key('l', 1000 + MENU_TYPEAHEAD_RESET_MS), LABELS)).toEqual({
      kind: 'rename',
      text: 'l',
    });
  });

  it('is not typing for named keys, shortcuts, or a space that starts no search', () => {
    for (const k of ['Enter', 'ArrowDown', 'Escape', 'Tab', 'Shift', 'F5']) {
      expect(typedNameKey(NO_TYPED_NAME, key(k, 0), LABELS)).toBeNull();
    }
    expect(typedNameKey(NO_TYPED_NAME, key('a', 0, { metaKey: true }), LABELS)).toBeNull();
    expect(typedNameKey(NO_TYPED_NAME, key('t', 0, { ctrlKey: true }), LABELS)).toBeNull();
    expect(typedNameKey(NO_TYPED_NAME, key('t', 0, { altKey: true }), LABELS)).toBeNull();
    // Space with nothing typed is the focused row's press; after a pause too.
    expect(typedNameKey(NO_TYPED_NAME, key(' ', 0), LABELS)).toBeNull();
    expect(
      typedNameKey({ text: 'Ex', at: 0 }, key(' ', MENU_TYPEAHEAD_RESET_MS), LABELS),
    ).toBeNull();
  });

  it('takes a letter beyond the basic plane as one character', () => {
    expect(typedNameKey(NO_TYPED_NAME, key('𝔸', 0), LABELS)).toEqual({ kind: 'rename', text: '𝔸' });
  });
});
