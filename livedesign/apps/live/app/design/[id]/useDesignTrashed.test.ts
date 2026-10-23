// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markDesignDeleted, unmarkDesignDeleted } from '@/lib/design-tombstones';
import { useDesignTrashed } from './useDesignTrashed';

vi.mock('@/lib/api-client', () => ({
  apiListTrash: vi.fn(async () => ({ local: [], cloud: [] })),
  apiRestoreDesign: vi.fn(),
}));

// docs/specs/013-workspace/trash.md: the open design turns to its deleted page when the room says it was
// trashed, except when this page deleted it and is already leaving for the Explorer.

afterEach(() => unmarkDesignDeleted('d1'));

const render = () =>
  renderHook(() => useDesignTrashed({ ownerId: 'me', designId: 'd1', viaShareLink: false }));

describe('useDesignTrashed', () => {
  it('shows the deleted page when someone else trashes the design', () => {
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    expect(result.current.trashed).toBe(true);
  });

  it('ignores the echo of a delete made from this page', () => {
    markDesignDeleted('d1');
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    expect(result.current.trashed).toBe(false);
  });
});
