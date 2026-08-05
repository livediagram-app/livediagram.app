// The shortcut catalogue the Shortcuts dialog renders (spec/07).
//
// Data only, in its own module so `shortcut-sections.test.ts` can read the
// real rows without importing the dialog component: the tests run in the node
// environment, and pulling in the modal would drag React and DOM helpers along
// for a list of strings.
//
// The dialog is the reference users are told to trust ("every binding the
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
      { keys: ['⌘', 'X'], label: 'Cut selection' },
      { keys: ['⌘', 'C'], label: 'Copy selection' },
      { keys: ['⌘', 'V'], label: 'Paste (offset copy)' },
      { keys: ['⌘', 'D'], label: 'Duplicate selection' },
      { keys: ['⌘', 'G'], label: 'Group selection  /  Ungroup' },
      { keys: ['⌘', '⇧', 'L'], label: 'Lock  /  Unlock selection' },
      { keys: ['⌘', 'A'], label: 'Select all' },
      { keys: ['Del', '/  ⌫'], label: 'Delete selection' },
      { keys: ['⌘', '⇧', ']'], label: 'Bring to front' },
      { keys: ['⌘', '⇧', '['], label: 'Send to back' },
    ],
  },
  {
    heading: 'Tools',
    rows: [
      { keys: ['V'], label: 'Select tool  (or S)' },
      { keys: ['H'], label: 'Hand tool' },
      { keys: ['K'], label: 'Laser pointer' },
      { keys: ['E'], label: 'Eraser (click / drag to delete)' },
      { keys: ['P'], label: 'Pencil (freehand)' },
      { keys: ['W'], label: 'Avatar mode (click / arrows to walk)' },
      { keys: ['I'], label: 'Isometric view' },
      { keys: ['⇧', 'drag'], label: 'Rotate isometric camera' },
      { keys: ['Z'], label: 'Zen mode (focus)' },
    ],
  },
  {
    heading: 'Add elements',
    rows: [
      { keys: ['R'], label: 'Rectangle' },
      { keys: ['O'], label: 'Oval' },
      { keys: ['D'], label: 'Diamond' },
      { keys: ['C'], label: 'Cylinder' },
      { keys: ['G'], label: 'Parallelogram' },
      { keys: ['T'], label: 'Text' },
      { keys: ['N'], label: 'Note (sticky)' },
      { keys: ['A'], label: 'Arrow' },
      { keys: ['F'], label: 'Frame' },
      { keys: ['9'], label: 'Image picker' },
      { keys: ['1', '–', '0'], label: 'Number row also picks tools / shapes' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search & commands  (or ⌘ .)' },
      { keys: ['⌘', '+'], label: 'Zoom in' },
      { keys: ['⌘', '-'], label: 'Zoom out' },
      { keys: ['⌘', '0'], label: 'Reset zoom to 100%' },
      { keys: ['⇧', '1'], label: 'Zoom to fit' },
      { keys: ['Tab'], label: 'Select next element  (Shift: previous)' },
      { keys: ['Arrow'], label: 'Nudge selection 1 px  (Shift: 10 px)' },
      { keys: ['Shift', 'Click'], label: 'Toggle element in multi-selection' },
      { keys: ['Shift', 'drag'], label: 'Drop a duplicate (original stays put)' },
      { keys: ['Space', 'drag'], label: 'Pan canvas (overrides current tool)' },
      { keys: ['Space'], label: 'Edit label of selected element' },
      { keys: ['Type'], label: 'Replace label of selected element' },
      { keys: ['Escape'], label: 'Cancel current mode, or clear selection' },
      { keys: ['⌘', 'hold'], label: 'Show shortcut badges on palette' },
    ],
  },
  {
    // Only live while a deck is running (spec/31), which is why they are their
    // own section rather than mixed into Navigate & select: none of them do
    // anything in the editor.
    heading: 'While presenting',
    rows: [
      { keys: ['→'], label: 'Next slide  (or Space / Page Down / click)' },
      { keys: ['←'], label: 'Previous slide  (or Page Up)' },
      { keys: ['Home'], label: 'First slide' },
      { keys: ['End'], label: 'Last slide' },
      { keys: ['G'], label: 'Jump to any slide' },
      { keys: ['N'], label: 'Presenter notes for this slide' },
      { keys: ['L'], label: 'Laser pointer over the slide' },
      { keys: ['S'], label: 'Spotlight over the slide' },
      { keys: ['Click'], label: 'On an element: its note, comments and actions' },
      { keys: ['Escape'], label: 'Exit the presentation' },
    ],
  },
];
