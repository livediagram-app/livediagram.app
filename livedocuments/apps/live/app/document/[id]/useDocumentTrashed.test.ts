// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markDocumentDeleted, unmarkDocumentDeleted } from '@/lib/document-tombstones';
import { useDocumentTrashed } from './useDocumentTrashed';

vi.mock('@/lib/api-client', () => ({
  apiListTrash: vi.fn(async () => ({ local: [], cloud: [] })),
  apiRestoreDocument: vi.fn(),
}));

// docs/specs/013-workspace/trash.md: the open document turns to its deleted page when the room says it was
// trashed, except when this page deleted it and is already leaving for the Explorer.

afterEach(() => unmarkDocumentDeleted('d1'));

const render = () =>
  renderHook(() => useDocumentTrashed({ ownerId: 'me', documentId: 'd1', viaShareLink: false }));

describe('useDocumentTrashed', () => {
  it('shows the deleted page when someone else trashes the document', () => {
    const { result } = render();
    act(() => result.current.setDocumentTrashed(true));
    expect(result.current.trashed).toBe(true);
  });

  it('ignores the echo of a delete made from this page', () => {
    markDocumentDeleted('d1');
    const { result } = render();
    act(() => result.current.setDocumentTrashed(true));
    expect(result.current.trashed).toBe(false);
  });
});
