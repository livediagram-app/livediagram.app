// The shortcut catalogue the Settings Keyboard category lists (docs/specs/007-editor/live-app.md).
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
      { keys: ['Del', '/  ⌫'], label: 'Delete Selection' },
      { keys: ['⌘', '⇧', ']'], label: 'Bring to Front' },
      { keys: ['⌘', '⇧', '['], label: 'Send to Back' },
    ],
  },
  {
    heading: 'Tools',
    rows: [
      { keys: ['V'], label: 'Select Tool  (or 1)' },
      { keys: ['S'], label: 'Search Elements  (Select where there is no strip)' },
      { keys: ['H'], label: 'Hand Tool' },
      { keys: ['K'], label: 'Laser Pointer' },
      { keys: ['E'], label: 'Eraser (click / drag to delete)' },
      { keys: ['P'], label: 'Pencil (freehand)' },
      { keys: ['W'], label: 'Avatar Mode (click / arrows to walk)' },
      { keys: ['I'], label: 'Isometric View' },
      { keys: ['⇧', 'drag'], label: 'Rotate Isometric Camera' },
      { keys: ['Z'], label: 'Zen Mode (focus)' },
      { keys: ['⇧', 'D'], label: 'Next Editor Mode (Diagram, Draw, Illustrate, Plan)' },
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
      { keys: ['9'], label: 'Image' },
      { keys: ['1', '–', '0'], label: 'Number row also picks tools / shapes' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search & Commands  (or ⌘ .)' },
      { keys: ['⌘', '+'], label: 'Zoom In' },
      { keys: ['⌘', '-'], label: 'Zoom Out' },
      { keys: ['⌘', '0'], label: 'Reset Zoom to 100%' },
      { keys: ['⇧', '1'], label: 'Zoom to Fit' },
      // A selected mind node claims plain Tab for growth (docs/specs/009-elements/mind-node.md), so the
      // caveat is on the row rather than in a footnote nobody reads.
      { keys: ['Tab'], label: 'Select Next Element  (Shift: previous)' },
      { keys: ['Tab'], label: 'On a mind node: add a child' },
      { keys: ['Enter'], label: 'On a mind node: add a sibling' },
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
    // Only live while a deck is running (docs/specs/012-collaboration/presentation-mode.md), which is why they are their
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
