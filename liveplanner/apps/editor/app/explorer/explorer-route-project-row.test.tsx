// @vitest-environment jsdom

// A list row of a project saved only in this browser carries the This Browser pill beside its
// name (docs/specs/006-project/offline-mode.md#this-browser-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectRow } from './explorer-route-project-row';
import type { ProjectEntryProps } from './explorer-view-props';
import type { PaneProject } from './views';

afterEach(cleanup);

const entry = (ownerId: string): ProjectEntryProps => ({
  // Empty, so the thumbnail draws its placeholder rather than fetching.
  project: {
    id: 'd1',
    name: 'Workshop notes',
    ownerId,
    savedAt: 1,
    folderId: null,
    empty: true,
  } as PaneProject,
  ownerId: 'me',
  renaming: false,
  onStartRename: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
});

describe('ProjectRow', () => {
  it('shows the This Browser pill for a project in this browser', () => {
    render(<ProjectRow {...entry('offline')} />);
    expect(screen.getByRole('link', { name: /This Browser/ })).toBeTruthy();
  });

  it('shows no pill for a cloud project', () => {
    render(<ProjectRow {...entry('me')} />);
    expect(screen.queryByRole('link', { name: /This Browser/ })).toBeNull();
  });
});
