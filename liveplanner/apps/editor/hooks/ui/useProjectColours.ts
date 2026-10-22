'use client';

import { useContext, useMemo } from 'react';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import { projectColours } from '@/lib/project-colours';

const NONE: readonly string[] = [];

// Custom colours for a picker (docs/specs/004-interface-design/colour-picker.md "Custom colours"):
// the colours picked with + across the project, the active tab's first, worked out again only when
// the tabs change. Outside the editor (a test, a standalone surface) there are none.
export function useProjectColours(offered: readonly string[] = NONE): string[] {
  const editor = useContext(EditorContext);
  const tabs = editor?.tabs;
  const activeId = editor?.activeTab?.id;
  // Joined, so callers can pass a fresh array each render without re-working the list.
  const offeredKey = offered.join(',');
  return useMemo(
    () => projectColours(tabs ?? [], offeredKey ? offeredKey.split(',') : [], activeId),
    [tabs, offeredKey, activeId],
  );
}
