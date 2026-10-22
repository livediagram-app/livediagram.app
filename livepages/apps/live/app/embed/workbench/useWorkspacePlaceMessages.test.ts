// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';
import { explorerPlaceFields, useWorkspacePlaceMessages } from './useWorkspacePlaceMessages';

// `livepages:place` (docs/specs/013-workspace/blueprints/workbench-embeds.md "Workspace messages", WB63): sent
// whenever a field of the place changes, never twice with the same fields.
describe('useWorkspacePlaceMessages', () => {
  it('sends a place once per change of its fields', () => {
    const port: WorkbenchPort = { origin: 'o', send: vi.fn(), subscribe: vi.fn(), close: vi.fn() };
    const { result } = renderHook(() => useWorkspacePlaceMessages(port));
    const folder = (documentCount: number) =>
      explorerPlaceFields({
        view: 'folder',
        folderId: 'f1',
        folderName: 'Minigames',
        documentCount,
        role: 'edit',
      });

    result.current(folder(0));
    result.current(folder(0));
    result.current(folder(1));

    expect(vi.mocked(port.send).mock.calls.map((c) => c[0])).toEqual([
      { type: 'livepages:place', v: 1, ...folder(0) },
      { type: 'livepages:place', v: 1, ...folder(1) },
    ]);
    expect(folder(0)).toMatchObject({
      documentId: null,
      documentName: null,
      tabId: null,
      tabName: null,
    });
  });
});
