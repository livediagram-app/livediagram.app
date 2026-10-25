import type { EditorMode } from '@livedesign/design';
import type { ComponentType } from 'react';

import { PagesIcon, type IconProps } from '@liveworkspace/ui';

// Each editor mode's mark (docs/specs/007-editor/pages-mode.md "One mode"), keyed by the
// mode's id: the same glyph on the mode switch, Opens in, the tab pill, the template mode filter
// and the marketing site's mode pictures. The glyphs are @liveworkspace/ui's chrome icons.
export const EDITOR_MODE_ICONS: Readonly<Record<EditorMode, ComponentType<IconProps>>> = {
  pages: PagesIcon,
};
