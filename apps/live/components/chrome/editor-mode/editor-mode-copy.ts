import type { ComponentType } from 'react';
import type { EditorMode } from '@livediagram/document';
import { EDITOR_MODE_ICONS, type IconProps } from '@livediagram/ui';

// What the editor's mode controls show for each editor mode beyond the words, which come from the
// document's one mode catalogue (editorModeLabel / editorModeDescription), and the shortcut that
// moves to the next mode (docs/specs/007-editor/editor-modes.md "The mode switch").

// The shared map (@livediagram/ui), typed to the document's modes.
export const EDITOR_MODE_ICON: Readonly<Record<EditorMode, ComponentType<IconProps>>> =
  EDITOR_MODE_ICONS;

// Shift+D, as `aria-keyshortcuts` spells it and as the interface shows it.
export const EDITOR_MODE_KEYSHORTCUT = 'Shift+D';
export const EDITOR_MODE_KEY_LABEL = '⇧D';

// What both forms of the switch receive from their host.
export type EditorModeSwitchProps = {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
};

// The keyboard focus ring on the switch's light chrome surfaces: brand-500 (the shared default)
// is only 2.65:1 on slate-50, so the switch steps to brand-600 there (3.91:1, WCAG 1.4.11) and
// brand-400 on the dark surfaces.
export const MODE_SWITCH_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';
