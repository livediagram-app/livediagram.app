// @vitest-environment jsdom

// A list row of a design saved only in this browser carries the This Browser pill beside its
// name (docs/specs/006-design/offline-mode.md#this-browser-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignRow } from './explorer-route-design-row';
import type { DesignEntryProps } from './explorer-view-props';
import type { PaneDesign } from './views';

afterEach(cleanup);

const entry = (ownerId: string): DesignEntryProps => ({
  // Empty, so the thumbnail draws its placeholder rather than fetching.
  design: {
    id: 'd1',
    name: 'Workshop notes',
    ownerId,
    savedAt: 1,
    folderId: null,
    empty: true,
  } as PaneDesign,
  ownerId: 'me',
  renaming: false,
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
});

describe('DesignRow', () => {
  it('shows the This Browser pill for a design in this browser', () => {
    render(<DesignRow {...entry('offline')} />);
    expect(screen.getByRole('link', { name: /This Browser/ })).toBeTruthy();
  });

  it('shows no pill for a cloud design', () => {
    render(<DesignRow {...entry('me')} />);
    expect(screen.queryByRole('link', { name: /This Browser/ })).toBeNull();
  });
});
