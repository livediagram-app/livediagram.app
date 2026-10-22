'use client';

import { createContext, useContext } from 'react';
import type { ExplorerStateValue } from './useExplorerState';

// Shared Explorer state (docs/specs/013-workspace/folders.md). ExplorerShell (rendered by the
// /explorer layout) instantiates useExplorerState once and provides
// it here, so the sidebar + every /explorer/<section> route page read
// the same data without refetching across navigations. Same pattern
// as the editor's EditorContext.

const ExplorerContext = createContext<ExplorerStateValue | null>(null);

export const ExplorerProvider = ExplorerContext.Provider;

// The Explorer state when inside one, else null (a surface that also renders
// elsewhere must not throw).
export function useOptionalExplorer(): ExplorerStateValue | null {
  return useContext(ExplorerContext);
}

export function useExplorer(): ExplorerStateValue {
  const value = useContext(ExplorerContext);
  if (!value) throw new Error('useExplorer must be used inside ExplorerProvider');
  return value;
}
