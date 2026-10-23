// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  WorkbenchSessionContext,
  type WorkbenchSession,
} from '@/components/providers/workbench-session-context';
import { explorerSurfaceFlags, useExplorerSurface } from './explorer-surface';

const sessionOf = (scope: WorkbenchSession['scope']) => ({ scope }) as WorkbenchSession;

describe('explorerSurfaceFlags', () => {
  it('keeps every surrounding in the app', () => {
    expect(Object.values(explorerSurfaceFlags('app')).every(Boolean)).toBe(true);
  });

  it('drops the app’s surroundings and the account in a workbench', () => {
    expect(explorerSurfaceFlags('workbench')).toEqual({
      appHeader: false,
      settings: false,
      appearance: false,
      appLinks: false,
      guestPrompts: false,
      administration: false,
    });
  });
});

describe('useExplorerSurface', () => {
  const surfaceUnder = (session: WorkbenchSession | null) =>
    renderHook(() => useExplorerSurface(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <WorkbenchSessionContext.Provider value={session}>
          {children}
        </WorkbenchSessionContext.Provider>
      ),
    }).result.current;

  it('is the workbench surface under a workspace session only', () => {
    expect(surfaceUnder(null)).toBe('app');
    expect(surfaceUnder(sessionOf('document'))).toBe('app');
    expect(surfaceUnder(sessionOf('workspace'))).toBe('workbench');
  });
});
