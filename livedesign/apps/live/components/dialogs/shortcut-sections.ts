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
      { keys: ['I'], label: 'Isometric View' },
      { keys: ['⇧', 'drag'], label: 'Rotate Isometric Camera' },
      { keys: ['Z'], label: 'Zen Mode (focus)' },
    ],
  },
  {
    heading: 'Add elements',
    rows: [
      { keys: ['R'], label: 'Square' },
      { keys: ['O'], label: 'Circle' },
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
      { keys: ['Tab'], label: 'Select Next Element  (Shift: previous)' },
      {
        keys: ['F6'],
        label: 'Next Region: Header, Palette, Canvas, Controls, Tabs  (Shift: previous)',
      },
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
  {
    // Only live while a photo page is in focus (docs/specs/031-photo/photo-tools.md "Keyboard summary"), bound by
    // the photo chrome's own listeners (usePhotoShortcuts); the chords only while a photo tool is in hand.
    heading: 'While on a photo page',
    rows: [
      { keys: ['V'], label: 'Move' },
      { keys: ['M'], label: 'Rectangle and Ellipse Select' },
      { keys: ['L'], label: 'Lasso, Polygon and Magnetic Lasso' },
      { keys: ['W'], label: 'Quick Select and Magic Wand' },
      { keys: ['C'], label: 'Crop' },
      { keys: ['I'], label: 'Eyedropper' },
      { keys: ['J'], label: 'Spot Heal, Heal and Red Eye' },
      { keys: ['B'], label: 'Brush and Pencil' },
      { keys: ['S'], label: 'Clone Stamp' },
      { keys: ['E'], label: 'Eraser and Background Eraser' },
      { keys: ['G'], label: 'Gradient and Paint Bucket' },
      { keys: ['R'], label: 'Blur, Sharpen and Smudge' },
      { keys: ['O'], label: 'Dodge, Burn and Sponge' },
      { keys: ['T'], label: 'Text' },
      { keys: ['U'], label: 'Rectangle, Ellipse and Line' },
      { keys: ['⇧', 'letter'], label: "The group's next tool" },
      { keys: ['X'], label: 'Swap colours' },
      { keys: ['D'], label: 'Reset colours' },
      { keys: ['[', ']'], label: 'Brush size  (with ⇧: hardness)' },
      { keys: ['1 – 0'], label: "Active layer's opacity  (a non-painting tool in hand)" },
      { keys: ['⌘', 'T'], label: 'Free Transform' },
      { keys: ['⌘', 'A'], label: 'Select all' },
      { keys: ['⌘', 'D'], label: 'Deselect' },
      { keys: ['⌘', '⇧', 'I'], label: 'Inverse selection' },
      { keys: ['⌘', 'J'], label: 'Duplicate layer  (with a selection: Layer Via Copy)' },
      { keys: ['⌘', '⇧', 'J'], label: 'Layer Via Cut' },
      { keys: ['⌘', 'E'], label: 'Merge Down' },
      { keys: ['⌘', '⇧', 'E'], label: 'Merge Visible' },
      { keys: ['⌘', 'G'], label: 'Group layers' },
      { keys: ['⌘', '⇧', 'G'], label: 'Ungroup' },
      { keys: ['⌘', '⌥', 'G'], label: 'Create or release clipping mask' },
      { keys: ['⌘', '⇧', 'N'], label: 'New layer' },
      { keys: ['⌘', ']'], label: 'Bring the layer forward' },
      { keys: ['⌘', '['], label: 'Send the layer backward' },
      { keys: ['⌘', '⇧', ']'], label: 'Bring the layer to the front' },
      { keys: ['⌘', '⇧', '['], label: 'Send the layer to the back' },
      { keys: ['⌥', '[', ']'], label: 'Select the layer below or above' },
      { keys: ['Backspace'], label: 'Fill with the background colour  (⌥: foreground)' },
      { keys: ['⇧', 'Backspace'], label: 'Fill…' },
      { keys: ['Delete'], label: "Clear the selection's pixels" },
      { keys: ['⌘', 'C'], label: 'Copy  (with ⇧: Copy Merged)' },
      { keys: ['⌘', 'V'], label: 'Paste as a layer  (with ⇧: in place)' },
      { keys: ['⌘', '⌥', 'F'], label: 'Repeat the last filter' },
      { keys: ['⌘', '⌥', 'Z'], label: 'Step back through History' },
      { keys: ['⌘', '0'], label: 'Fit Photo' },
      { keys: ['⌘', '1'], label: 'Actual Pixels' },
      { keys: ['Enter'], label: 'Commit a transform or crop' },
      { keys: ['Escape'], label: 'Cancel, or Move in hand again' },
    ],
  },
];
