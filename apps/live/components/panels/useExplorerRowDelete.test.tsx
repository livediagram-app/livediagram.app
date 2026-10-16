// @vitest-environment jsdom

// The Explorer's row delete (docs/specs/013-workspace/folders.md, trash.md "Deleting"): asked nothing, a deleted row
// slides out and its id is dropped once the list no longer has it; a team row hides at once, is forgotten once the
// library sweep drops it, and comes back on Undo.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentListItem } from '@/lib/api-client';
import type { TeamDocumentRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import { useExplorerRowDelete } from './useExplorerRowDelete';

const row = (id: string) => ({ id, name: id }) as DocumentListItem;
const teamRow = (id: string): TeamDocumentRow => ({
  ...row(id),
  team: { id: 'team', name: 'Team' },
});

type Lists = { documents: DocumentListItem[]; teamDocuments: TeamDocumentRow[] };

function hook(initial: Lists) {
  // The parent's delete: animate out first, then (in the real app) drop the row from the list.
  const onDeleteDocument = vi.fn(
    (
      _id: string,
      beforeRemove?: () => void | Promise<void>,
      _opts?: { onRestored?: () => void },
    ) => {
      void beforeRemove?.();
    },
  );
  const view = renderHook((lists: Lists) => useExplorerRowDelete({ ...lists, onDeleteDocument }), {
    initialProps: initial,
  });
  return { ...view, onDeleteDocument };
}

const deleteRow = (result: { current: ReturnType<typeof useExplorerRowDelete> }, id: string) =>
  act(() => result.current.deleteRow?.(id));

describe('useExplorerRowDelete', () => {
  it('keeps a personal row sliding out until the list drops it', async () => {
    const a = row('a');
    const b = row('b');
    const { result, rerender } = hook({ documents: [a, b], teamDocuments: [] });
    deleteRow(result, 'a');
    expect(result.current.exitingDocumentIds.has('a')).toBe(true);
    rerender({ documents: [a, b], teamDocuments: [] });
    expect(result.current.exitingDocumentIds.has('a')).toBe(true);
    rerender({ documents: [b], teamDocuments: [] });
    expect(result.current.exitingDocumentIds.has('a')).toBe(false);
  });

  it('hides a team row until the sweep drops it', async () => {
    const t = teamRow('t');
    const { result, rerender } = hook({ documents: [], teamDocuments: [t] });
    deleteRow(result, 't');
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    rerender({ documents: [], teamDocuments: [t] });
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    rerender({ documents: [], teamDocuments: [] });
    expect(result.current.deletedTeamIds.has('t')).toBe(false);
  });

  it('brings a hidden team row back on Undo', () => {
    const t = teamRow('t');
    const { result, onDeleteDocument } = hook({ documents: [], teamDocuments: [t] });
    deleteRow(result, 't');
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    act(() => onDeleteDocument.mock.calls[0]![2]!.onRestored!());
    expect(result.current.deletedTeamIds.has('t')).toBe(false);
  });
});
