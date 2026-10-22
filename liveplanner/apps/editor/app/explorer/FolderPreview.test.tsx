// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/013-workspace/folder-content-previews.md: an empty folder's card shows the empty state's art; a folder
// with something in it shows its tiles.

vi.mock('@/components/panels/ProjectThumbnail', () => ({
  ProjectThumbnail: ({ projectId }: { projectId: string }) => (
    <span data-testid={`thumb-${projectId}`} />
  ),
}));

import { FolderPreview } from './FolderPreview';
import type { FolderPreviewContents } from './folder-preview-tiles';

afterEach(cleanup);

describe('FolderPreview', () => {
  it('shows an empty folder the empty state art: the floating badge over its rings', () => {
    const { container } = render(
      <FolderPreview contents={{ folders: [], projects: [] }} ownerId="me" />,
    );
    const empty = container.querySelector('[data-folder-empty]')!;
    expect(empty).not.toBeNull();
    expect(empty.querySelectorAll('.animate-empty-ring')).toHaveLength(2);
    expect(empty.querySelector('.animate-empty-float')).not.toBeNull();
  });

  it('shows the tiles of a folder with something in it, and no empty art', () => {
    const contents = {
      folders: [],
      projects: [{ id: 'd1', name: 'One', savedAt: 1, ownerId: 'me' }],
    } as unknown as FolderPreviewContents;
    const { container, getByTestId } = render(<FolderPreview contents={contents} ownerId="me" />);
    expect(getByTestId('thumb-d1')).toBeTruthy();
    expect(container.querySelector('[data-folder-empty]')).toBeNull();
  });
});
