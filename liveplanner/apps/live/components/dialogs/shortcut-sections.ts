// The shortcut catalogue the Settings Keyboard category lists (docs/specs/007-editor/live-app.md).
//
// Data only, in its own module so `shortcut-sections.test.ts` can read the
// real rows without importing the settings component: the tests run in the node
// environment, and pulling in React components would drag React and DOM helpers along
// for a list of strings.
//
// The list is the reference users are told to trust: every key that does something on a Board, Sheet, Dashboard
// or Form tab, and nothing that does not. It is hand-kept beside the handlers it describes:
// hooks/canvas/editor-shortcut-keys.ts (the editor-wide keys, which on a Plan tab are only those `coveredKeyRole`
// runs), components/plan/plan-board-keys.ts (a focused card) and components/sheets/sheet-keys.ts (a Sheet's grid).
// shortcut-sections.test.ts pins it to them.

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
    heading: 'Everywhere',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search & Commands  (or ⌘ .)' },
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo  (or Ctrl Y)' },
      { keys: ['Z'], label: 'Zen Mode (focus)' },
      { keys: ['Escape'], label: 'Close what is open, or leave Zen Mode' },
      {
        keys: ['F6'],
        label: "Next Region: Header, the Tab's Content, Controls, Tabs  (Shift: previous)",
      },
    ],
  },
  {
    // docs/specs/026-plan/plan-board.md "Keyboard": while a card has focus.
    heading: 'On a Board',
    rows: [
      { keys: ['Arrow'], label: 'Move between cards' },
      { keys: ['Enter'], label: 'Open the card  (or Space)' },
      { keys: ['Shift', 'Arrow'], label: 'Move the card a column, or up and down its column' },
      { keys: ['N'], label: "Add a card to the card's column" },
      { keys: ['Del', '/  ⌫'], label: 'Move the card to the Trash' },
    ],
  },
  {
    // docs/specs/029-sheets/sheet.md "Keyboard" and "Zoom".
    heading: 'In a Sheet',
    rows: [
      { keys: ['Arrow'], label: 'Move between cells  (⌘: to the edge of the data, Shift: extend)' },
      { keys: ['Enter'], label: 'Move down  (Tab: right, Shift: back)' },
      { keys: ['F2'], label: 'Edit the cell  (or just type)' },
      { keys: ['Del', '/  ⌫'], label: 'Clear the selected cells' },
      { keys: ['⌘', 'B'], label: 'Bold' },
      { keys: ['⌘', 'I'], label: 'Italic' },
      { keys: ['⌘', 'U'], label: 'Underline' },
      { keys: ['⌘', 'F'], label: 'Find' },
      { keys: ['⌘', '⇧', 'H'], label: 'Find and Replace' },
      { keys: ['⌘', 'D'], label: 'Fill Down' },
      { keys: ['⌘', 'R'], label: 'Fill Right' },
      { keys: ['⌘', ';'], label: "Today's Date" },
      { keys: ['⌘', '⇧', ';'], label: 'The Time Now' },
      { keys: ['Alt', '↓'], label: "Open the cell's dropdown" },
      { keys: ['⌘', '+'], label: 'Zoom the Sheet In' },
      { keys: ['⌘', '-'], label: 'Zoom the Sheet Out' },
      { keys: ['⌘', '0'], label: 'Zoom the Sheet to 100%' },
    ],
  },
];
