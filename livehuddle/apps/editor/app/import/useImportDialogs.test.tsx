// @vitest-environment jsdom

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useImportDialogs } from './useImportDialogs';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/013-workspace/folders.md "Import from": the /import page opens one source's dialog.
describe('useImportDialogs', () => {
  it('opens nothing before the owner is known', () => {
    const { result } = renderHook(() =>
      useImportDialogs({ ownerId: null, folderId: null, onDocumentsCreated: vi.fn() }),
    );
    expect(result.current.dialogs).toBeNull();
    let opened = true;
    act(() => {
      opened = result.current.open('excalidraw');
    });
    // An import with no one to file it for cannot open: the page goes back to the Explorer.
    expect(opened).toBe(false);
    expect(result.current.dialogs).toBeNull();
  });

  for (const source of ['microsoft-whiteboard', 'excalidraw', 'drawio'] as const) {
    it(`opens the ${source} dialog`, () => {
      const { result } = renderHook(() =>
        useImportDialogs({ ownerId: 'owner', folderId: 'f1', onDocumentsCreated: vi.fn() }),
      );
      expect(result.current.dialogs).toBeNull();
      act(() => {
        expect(result.current.open(source)).toBe(true);
      });
      expect(result.current.dialogs).not.toBeNull();
    });
  }
});
