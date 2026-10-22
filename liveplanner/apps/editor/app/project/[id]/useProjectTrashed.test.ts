// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markProjectDeleted, unmarkProjectDeleted } from '@/lib/project-tombstones';
import { useProjectTrashed } from './useProjectTrashed';

vi.mock('@/lib/api-client', () => ({
  apiListTrash: vi.fn(async () => ({ local: [], cloud: [] })),
  apiRestoreProject: vi.fn(),
}));

// docs/specs/013-workspace/trash.md: the open project turns to its deleted page when the room says it was
// trashed, except when this page deleted it and is already leaving for the Explorer.

afterEach(() => unmarkProjectDeleted('d1'));

const render = () =>
  renderHook(() => useProjectTrashed({ ownerId: 'me', projectId: 'd1', viaShareLink: false }));

describe('useProjectTrashed', () => {
  it('shows the deleted page when someone else trashes the project', () => {
    const { result } = render();
    act(() => result.current.setProjectTrashed(true));
    expect(result.current.trashed).toBe(true);
  });

  it('ignores the echo of a delete made from this page', () => {
    markProjectDeleted('d1');
    const { result } = render();
    act(() => result.current.setProjectTrashed(true));
    expect(result.current.trashed).toBe(false);
  });
});
