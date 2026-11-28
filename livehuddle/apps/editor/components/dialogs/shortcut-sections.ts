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
//
// It opens with In Every App (Search & Commands, Undo, Redo), the section every liveworkspace editor lists word for
// word (liveworkspace/docs/specs/022-interface-design/action-parity.md "Shortcuts"); only this editor's own keys
// follow it.

import {
  IN_EVERY_APP_SECTION,
  type ShortcutSection,
} from '@liveworkspace/workbench/lib/shortcut-sections';
import { REACTION_LABEL, REACTIONS } from '@livehuddle/document';
import { AVATAR_BEHAVIOUR_KEYS, AVATAR_BURST_KEYS } from '@livehuddle/avatar/action-keys';
import { AVATAR_REACTIONS } from '@livehuddle/avatar/reactions';

export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  IN_EVERY_APP_SECTION,
  {
    heading: 'Edit',
    rows: [
      { keys: ['⌘', 'X'], label: 'Cut Selection' },
      { keys: ['⌘', 'C'], label: 'Copy Selection' },
      { keys: ['⌘', 'V'], label: 'Paste (offset copy)' },
      { keys: ['⌘', 'D'], label: 'Duplicate Selection' },
      { keys: ['⌘', 'A'], label: 'Select All' },
      { keys: ['Del', '/  ⌫'], label: 'Delete Selection' },
    ],
  },
  {
    heading: 'Tools',
    rows: [
      { keys: ['E'], label: 'Edit  (or V, or 1)' },
      { keys: ['W'], label: 'Walk' },
      { keys: ['S'], label: 'Search Elements  (Edit where there is no strip)' },
    ],
  },
  {
    heading: 'Navigate & select',
    rows: [
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
    // Only live in Avatar mode (docs/specs/008-canvas/avatar-mode.md "Keyboard actions"), bound by the walk's own
    // listeners rather than the editor's maps, and built from the action-key maps so a key cannot drift from its row.
    heading: 'While walking',
    rows: [
      { keys: ['←', '↑', '→', '↓'], label: 'Walk' },
      { keys: ['Space'], label: 'Hop and wave a flag' },
      { keys: ['Enter'], label: 'Send a message' },
      { keys: ['[', ']'], label: 'Turn the camera' },
      ...AVATAR_REACTIONS.map((r) => ({ keys: [AVATAR_BEHAVIOUR_KEYS[r.id]], label: r.label })),
      ...REACTIONS.map((r) => ({ keys: [AVATAR_BURST_KEYS[r]], label: REACTION_LABEL[r] })),
    ],
  },
];
