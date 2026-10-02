import type { ComponentType } from 'react';
import type { EditorMode } from '@livediagram/document';
import { FlowchartIcon, MarkerIcon, type IconProps } from '@livediagram/ui';

// The words and glyphs every variant of the mode switch shows for the two
// editor modes (docs/specs/007-editor/editor-modes.md).

export const EDITOR_MODE_LABEL: Record<EditorMode, string> = {
  diagram: 'Diagram',
  draw: 'Draw',
};

export const EDITOR_MODE_DESCRIPTION: Record<EditorMode, string> = {
  diagram: 'Shapes, arrows, the palette and snapping.',
  draw: 'Pens, the eraser and shape recognition.',
};

export const EDITOR_MODE_ICON: Record<EditorMode, ComponentType<IconProps>> = {
  diagram: FlowchartIcon,
  draw: MarkerIcon,
};

export const otherEditorMode = (mode: EditorMode): EditorMode =>
  mode === 'diagram' ? 'draw' : 'diagram';

// What every variant receives from its host.
export type EditorModeSwitchProps = {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
};

// The keyboard focus ring on the tab bar: brand-500 (the shared default) is
// only 2.65:1 on the light bar, so the switch steps to brand-600 there
// (3.91:1, WCAG 1.4.11) and brand-400 on the dark bar.
export const MODE_SWITCH_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';
