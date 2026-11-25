'use client';

// The width Pages mode's Contents sidebar draws at (docs/specs/007-editor/pages-mode.md "Contents"), shared by the
// sidebar and the chrome beside it: the shared sidebar rule (useSidebarWidth) over Contents' 236 px base.
import { CONTENTS_SIDEBAR_WIDTH, CONTENTS_SIDEBAR_WIDTH_KEY } from '../../lib/contents-sidebar';
import { useSidebarWidth, type SidebarWidth } from './useSidebarWidth';

export function useContentsSidebarWidth(): SidebarWidth {
  return useSidebarWidth(CONTENTS_SIDEBAR_WIDTH_KEY, CONTENTS_SIDEBAR_WIDTH);
}
