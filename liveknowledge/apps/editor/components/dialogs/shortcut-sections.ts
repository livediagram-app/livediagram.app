// The shortcut catalogue the Settings Keyboard category lists (docs/specs/007-editor/editor-app.md).
//
// Data only, in its own module so `shortcut-sections.test.ts` can read the
// real rows without importing the settings component: the tests run in the node
// environment, and pulling in React components would drag React and DOM helpers along
// for a list of strings.
//
// The list is the reference users are told to trust ("every binding the
// editor knows"), and it is a hand-kept list beside the hand-kept key maps in
// hooks/canvas/editor-shortcut-keys.ts. The test pins the two together.

export type ShortcutRow = {
  keys: string[];
  label: string;
};

export type ShortcutSection = {
  heading: string;
  rows: ShortcutRow[];
};

export const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    heading: 'Edit',
    rows: [
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo  (or Ctrl Y)' },
      { keys: ['⌘', 'X'], label: 'Cut Selection' },
      { keys: ['⌘', 'C'], label: 'Copy Selection' },
      { keys: ['⌘', 'V'], label: 'Paste (offset copy)' },
      { keys: ['⌘', 'D'], label: 'Duplicate Selection' },
      { keys: ['⌘', '⇧', 'L'], label: 'Lock  /  Unlock Selection' },
      { keys: ['⌘', 'A'], label: 'Select All' },
      { keys: ['⌘', 'F'], label: 'Find in Page' },
      { keys: ['⌘', '⇧', 'H'], label: 'Find and Replace' },
      { keys: ['Del', '/  ⌫'], label: 'Delete Selection' },
      { keys: ['⌘', '⇧', ']'], label: 'Bring to Front' },
      { keys: ['⌘', '⇧', '['], label: 'Send to Back' },
    ],
  },
  {
    heading: 'View',
    rows: [{ keys: ['Z'], label: 'Zen Mode (focus)' }],
  },
  {
    // The element keys work while a drawing zone is being edited, and nowhere else on a page.
    heading: 'In a Drawing',
    rows: [
      { keys: ['R'], label: 'Square' },
      { keys: ['O'], label: 'Circle' },
      { keys: ['D'], label: 'Diamond' },
      { keys: ['C'], label: 'Cylinder' },
      { keys: ['G'], label: 'Parallelogram' },
      { keys: ['T'], label: 'Text' },
      { keys: ['N'], label: 'Note (sticky)' },
      { keys: ['A'], label: 'Arrow' },
      { keys: ['9'], label: 'Image' },
      { keys: ['2'], label: 'Square' },
      { keys: ['3'], label: 'Diamond' },
      { keys: ['4'], label: 'Circle' },
      { keys: ['5'], label: 'Arrow' },
      { keys: ['8'], label: 'Text' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search: This Knowledgebase First' },
      { keys: ['⌘', '.'], label: 'Search & Commands' },
      { keys: ['Page Up', 'Page Down'], label: 'Scroll the Page a Screen  (Home, End: top, foot)' },
      { keys: ['Tab'], label: 'Select Next Element  (Shift: previous)' },
      {
        keys: ['F6'],
        label: 'Next Region: Top Row, Page, Controls, Bottom Bar  (Shift: previous)',
      },
      { keys: ['Arrow'], label: 'Nudge selection 1 px  (Shift: 10 px)' },
      { keys: ['Shift', 'Click'], label: 'Toggle element in multi-selection' },
      { keys: ['Shift', 'drag'], label: 'Drop a duplicate (original stays put)' },
      { keys: ['Space'], label: 'Edit label of selected element' },
      { keys: ['Type'], label: 'Replace label of selected element' },
      { keys: ['Escape'], label: 'Cancel current mode, or clear selection' },
    ],
  },
];
