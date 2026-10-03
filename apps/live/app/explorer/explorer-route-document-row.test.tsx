// @vitest-environment jsdom

// A list row of a document saved only in this browser carries the Local only pill beside its
// name (docs/specs/006-document/offline-mode.md#local-only-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentRow } from './explorer-route-document-row';
import type { DocumentEntryProps } from './explorer-view-props';
import type { PaneDocument } from './views';

afterEach(cleanup);

const entry = (ownerId: string): DocumentEntryProps =>
  ({
    // Empty, so the thumbnail draws its placeholder rather than fetching.
    document: {
      id: 'd1',
      name: 'Workshop notes',
      ownerId,
      savedAt: 1,
      folderId: null,
      empty: true,
    } as PaneDocument,
    ownerId: 'me',
    renaming: false,
    onStartRename: vi.fn(),
    onCommitRename: vi.fn(),
    onCancelRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
  }) as unknown as DocumentEntryProps;

describe('DocumentRow', () => {
  it('shows the Local only pill for a document in this browser', () => {
    render(<DocumentRow {...entry('offline')} />);
    expect(screen.getByRole('link', { name: /Local only/ })).toBeTruthy();
  });

  it('shows no pill for a cloud document', () => {
    render(<DocumentRow {...entry('me')} />);
    expect(screen.queryByRole('link', { name: /Local only/ })).toBeNull();
  });
});
