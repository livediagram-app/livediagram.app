import type { EditorMode } from '@livedocuments/document';
import type { ComponentType } from 'react';

import { Glyph, type IconProps } from '@liveworkspace/ui';

// A page with a little chart above two lines of writing, on its 24-unit grid: Pages mode's mark
// (docs/specs/007-editor/pages-mode.md), for the pages it lays out, infographics and articles.
export function PagesIcon({ size = 16, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" />
      <path d="M8.5 11V8.5M12 11V6M15.5 11V9" />
      <path d="M8.5 15H15.5M8.5 18H13" />
    </Glyph>
  );
}

// The editor mode's mark (docs/specs/007-editor/pages-mode.md "One mode"), keyed by the mode's id:
// the same glyph on Opens in, the tab pill, the template mode filter and the marketing site's mode
// pictures.
export const EDITOR_MODE_ICONS: Readonly<Record<EditorMode, ComponentType<IconProps>>> = {
  pages: PagesIcon,
};
