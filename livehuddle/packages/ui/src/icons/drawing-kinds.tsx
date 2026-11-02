import type { EditorMode } from '@livehuddle/document';
import type { ComponentType } from 'react';

import { FlipchartIcon, type IconProps } from '@liveworkspace/ui';

// The editor mode's mark (docs/specs/007-editor/editor-modes.md), keyed by the mode's id: Workshop's
// flipchart, where a mode is pictured. The glyphs are @liveworkspace/ui's chrome icons.
export const EDITOR_MODE_ICONS: Readonly<Record<EditorMode, ComponentType<IconProps>>> = {
  workshop: FlipchartIcon,
};
