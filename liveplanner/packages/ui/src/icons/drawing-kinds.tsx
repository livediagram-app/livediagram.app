import type { EditorMode } from '@liveplanner/project';
import type { ComponentType } from 'react';

import { PlanIcon, type IconProps } from '@liveworkspace/ui';

// Each editor mode's mark (docs/specs/007-editor/editor-modes.md "Each mode's mark"), keyed by the
// mode's id: the same glyph on the mode switch, Opens in, the tab pill, the template mode filter
// and the marketing site's mode pictures. The glyphs are @liveworkspace/ui's chrome icons.
export const EDITOR_MODE_ICONS: Readonly<Record<EditorMode, ComponentType<IconProps>>> = {
  plan: PlanIcon,
};
