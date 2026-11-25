// The Keyboard list's shared part (liveworkspace/docs/specs/022-interface-design/action-parity.md "Shortcuts"): the
// keys every liveworkspace editor binds to the same action, listed first in each editor's Settings > Keyboard, word for
// word. Each editor's components/dialogs/shortcut-sections.ts opens its SHORTCUT_SECTIONS with this section and lists
// only its own keys after it; shortcut-sections.test.ts reads every editor's list from disk to hold that.
//
// Data only, so the editors' node-environment tests can read it without React.

export type ShortcutRow = {
  keys: readonly string[];
  label: string;
};

export type ShortcutSection = {
  heading: string;
  rows: readonly ShortcutRow[];
};

function frozen(section: ShortcutSection): ShortcutSection {
  return Object.freeze({
    heading: section.heading,
    rows: Object.freeze(
      section.rows.map((row) =>
        Object.freeze({ keys: Object.freeze([...row.keys]), label: row.label }),
      ),
    ),
  });
}

/** In Every App: Search & Commands, Undo and Redo, and reaching a toast's Undo, the same keys and words in every editor. */
export const IN_EVERY_APP_SECTION: ShortcutSection = frozen({
  heading: 'In Every App',
  rows: [
    { keys: ['⌘', 'K'], label: 'Search & Commands  (or ⌘ .)' },
    { keys: ['⌘', 'Z'], label: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], label: 'Redo  (or Ctrl Y)' },
    // The toast stack takes F6 first while a toast offers an action (@liveworkspace/ui/toast TOAST_REACH_KEY).
    { keys: ['F6'], label: 'Reach a Toast’s Undo, While One Shows' },
  ],
});
