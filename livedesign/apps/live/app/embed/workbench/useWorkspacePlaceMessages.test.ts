// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';
import { explorerPlaceFields, useWorkspacePlaceMessages } from './useWorkspacePlaceMessages';

// `livedesign:place` (docs/specs/013-workspace/blueprints/workbench-embeds.md "Workspace messages", WB63): sent
// whenever a field of the place changes, never twice with the same fields.
describe('useWorkspacePlaceMessages', () => {
  it('sends a place once per change of its fields', () => {
    const port: WorkbenchPort = { origin: 'o', send: vi.fn(), subscribe: vi.fn(), close: vi.fn() };
    const { result } = renderHook(() => useWorkspacePlaceMessages(port));
    const folder = (designCount: number) =>
      explorerPlaceFields({
        view: 'folder',
        folderId: 'f1',
        folderName: 'Minigames',
        designCount,
        role: 'edit',
      });

    result.current(folder(0));
    result.current(folder(0));
    result.current(folder(1));

    expect(vi.mocked(port.send).mock.calls.map((c) => c[0])).toEqual([
      { type: 'livedesign:place', v: 1, ...folder(0) },
      { type: 'livedesign:place', v: 1, ...folder(1) },
    ]);
    expect(folder(0)).toMatchObject({
      designId: null,
      designName: null,
      tabId: null,
      tabName: null,
    });
  });
});
