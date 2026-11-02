'use client';

import { createContext, useContext } from 'react';
import type { SplitView } from '@/hooks/ui/useSplitView';

// The side by side state (docs/specs/007-editor/split-view.md), for the chrome that offers or marks
// it: the tab pill's "beside" marker and the tab menu's Open Side by Side. Absent outside the editor
// (and in tests that render the tab bar alone), where those simply don't show.
export const SplitViewContext = createContext<SplitView | null>(null);

export function useSplitViewContext(): SplitView | null {
  return useContext(SplitViewContext);
}
