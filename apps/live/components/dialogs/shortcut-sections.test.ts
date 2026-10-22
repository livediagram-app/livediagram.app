import { describe, expect, it } from 'vitest';
import { EDIT_KEYS, VIEW_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { SHORTCUT_SECTIONS } from './shortcut-sections';
import { avatarActionForKey } from '@/lib/avatar-action-keys';

// The Keyboard settings list and the key maps are two hand-kept lists of one thing.
// The list calls itself "a reference card of every binding the editor knows"
// and the help centre tells users to trust it, so a row for a key nothing
// handles is a documented lie, and a handled key with no row is a feature
// nobody can find. Neither shows up in a render, a typecheck, or a lint.
//
// Both hold today. This is here so they keep holding: renaming a handler is a
// one-line edit in a file that has no reason to mention the dialog.

// `9` opens the image picker from useEditorKeyboardShortcuts rather than from
// EDIT_KEYS, because its callback is nullable on guest deploys with no api
// worker. That is a deliberate exception in the hook, not a missing binding.
const HANDLED_OUTSIDE_THE_MAPS = ['9'];

const handledKeys = new Set([
  ...Object.keys(VIEW_TOOL_KEYS),
  ...Object.keys(EDIT_KEYS),
  ...HANDLED_OUTSIDE_THE_MAPS,
]);

// The presentation binds its own keys on the overlay (PresentationOverlay),
// deliberately outside the editor's maps — while a deck runs, the editor's
// shortcuts are dead. So its rows describe real bindings that `handledKeys`
// will never contain, and checking them against it would fail on the truth.
// Avatar mode's keys are the same: the walk's own listeners (useAvatarKeys, useAvatarActionKeys) bind them.
const EDITOR_SECTIONS = SHORTCUT_SECTIONS.filter(
  (section) =>
    section.heading !== 'While presenting' && !section.heading.startsWith('While walking'),
);

// Rows whose `keys` are a single printable character: the ones that name one
// binding. Chords (⌘ Z) and the "1 – 0" number-row summary are not claims
// about a single key, so they are not checked here.
const singleKeyRows = EDITOR_SECTIONS.flatMap((section) =>
  section.rows
    .filter((row) => row.keys.length === 1 && /^[A-Za-z0-9]$/.test(row.keys[0]!))
    .map((row) => ({
      key: row.keys[0]!.toLowerCase(),
      label: row.label,
      section: section.heading,
    })),
);

describe('the Keyboard settings list matches the keys the editor binds', () => {
  it('reads real rows (guard against this test going blind)', () => {
    expect(SHORTCUT_SECTIONS.length).toBeGreaterThan(3);
    expect(singleKeyRows.length).toBeGreaterThan(15);
    expect(handledKeys.size).toBeGreaterThan(25);
  });

  it('lists no key the editor does not bind', () => {
    const phantom = singleKeyRows
      .filter((row) => !handledKeys.has(row.key))
      .map((row) => `${row.key.toUpperCase()} (${row.section}: ${row.label})`);
    expect(phantom).toEqual([]);
  });

  it('leaves no bound key undocumented', () => {
    // The number row is documented as a range ("1 – 0") rather than ten rows,
    // so a digit counts as covered when that summary row is present.
    const numberRowSummarised = EDITOR_SECTIONS.some((section) =>
      section.rows.some((row) => row.keys.includes('–') && row.keys.includes('0')),
    );
    const documented = new Set(singleKeyRows.map((row) => row.key));
    // Some keys are documented only inside a label, e.g. "Select tool (or S)".
    for (const section of EDITOR_SECTIONS) {
      for (const row of section.rows) {
        for (const m of row.label.matchAll(/\bor\s+(?:Ctrl\s+)?([A-Za-z0-9])\b/g)) {
          documented.add(m[1]!.toLowerCase());
        }
      }
    }
    const undocumented = [...handledKeys].filter(
      (key) => !documented.has(key) && !(numberRowSummarised && /^[0-9]$/.test(key)),
    );
    expect(undocumented.sort()).toEqual([]);
  });
});

// docs/specs/009-elements/mind-node.md "New lines": Enter grows a mind map, so the key for a new
// line in a node's label has a row of its own, beside Tab and Enter.
describe('the mind node keys', () => {
  it('lists Tab, Enter and Shift+Enter together', () => {
    const rows = EDITOR_SECTIONS.flatMap((section) => section.rows);
    const at = (label: string) => rows.findIndex((row) => row.label === label);
    const newLine = at('In a mind node’s label: new line');
    expect(rows[newLine]?.keys).toEqual(['⇧', 'Enter']);
    expect(at('On a mind node: add a sibling')).toBe(newLine - 1);
    expect(at('On a mind node: add a child')).toBe(newLine - 2);
  });
});

describe('the While walking rows match the Avatar action keys', () => {
  it('lists each action key once, on a key that plays it', () => {
    const walking = SHORTCUT_SECTIONS.find((s) => s.heading.startsWith('While walking'))!;
    const actionRows = walking.rows.filter((row) => /^[A-Z0-9]$/.test(row.keys[0]!));
    expect(actionRows).toHaveLength(10);
    for (const row of actionRows) {
      const key = row.keys[0]!.toLowerCase();
      const plain = { key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
      expect(avatarActionForKey(plain), row.label).not.toBeNull();
    }
  });
});
