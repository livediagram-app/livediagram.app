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

import { REACTION_LABEL, REACTIONS } from '@livehuddle/document';
import { AVATAR_BEHAVIOUR_KEYS, AVATAR_BURST_KEYS } from '@liveworkspace/avatar/action-keys';
import { AVATAR_REACTIONS } from '@liveworkspace/avatar/reactions';

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
      { keys: ['E'], label: 'Eraser, click / drag to delete  (or 0)' },
      { keys: ['I'], label: 'Isometric View' },
      { keys: ['⇧', 'drag'], label: 'Rotate Isometric Camera' },
      { keys: ['Z'], label: 'Zen Mode (focus)' },
    ],
  },
  {
    heading: 'Add elements',
    rows: [
      { keys: ['T'], label: 'Text  (or 8)' },
      { keys: ['N'], label: 'Note (sticky)' },
      { keys: ['F'], label: 'Frame' },
      { keys: ['9'], label: 'Image' },
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
      // A dot vote's keys (docs/specs/012-collaboration/session-tools.md "Casting from the keyboard").
      { keys: ['+'], label: 'In an open vote: add one of your dots to the selected element' },
      { keys: ['-'], label: 'In an open vote: take one of your dots back' },
      { keys: ['Escape'], label: 'Cancel current mode, or clear selection' },
      { keys: ['⌘', 'hold'], label: 'Show shortcut badges on palette' },
    ],
  },
  {
    // Only live in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Keyboard actions"), bound by the walk's own
    // listeners rather than the editor's maps, and built from the action-key maps so a key cannot drift from its row.
    heading: 'While walking (Avatar mode)',
    rows: [
      { keys: ['←', '↑', '→', '↓'], label: 'Walk' },
      { keys: ['Space'], label: 'Hop and wave a flag' },
      { keys: ['Enter'], label: 'Send a message' },
      ...AVATAR_REACTIONS.map((r) => ({ keys: [AVATAR_BEHAVIOUR_KEYS[r.id]], label: r.label })),
      ...REACTIONS.map((r) => ({ keys: [AVATAR_BURST_KEYS[r]], label: REACTION_LABEL[r] })),
    ],
  },
];
