// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The default marker (docs/specs/013-workspace/default-folders.md "The default marker").

const { api } = vi.hoisted(() => ({
  api: {
    apiListPlacementDefaults: vi.fn(),
    apiSetPlacementDefault: vi.fn(),
    apiClearPlacementDefault: vi.fn(),
  },
}));
vi.mock('@/lib/api/placement-defaults', () => api);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import {
  loadPlacementDefaults,
  resetPlacementDefaultsForTests,
} from '@/lib/placement-defaults/placement-defaults-store';
import { DefaultFolderMarker } from './DefaultFolderMarker';

async function withDefaults(entries: { key: string; folderId: string }[]) {
  api.apiListPlacementDefaults.mockResolvedValue(entries);
  await act(() => loadPlacementDefaults('owner'));
}

beforeEach(() => resetPlacementDefaultsForTests());
afterEach(cleanup);

const icons = (root: HTMLElement) => root.querySelectorAll('[data-default-marker] svg').length;

describe('DefaultFolderMarker', () => {
  it('shows nothing for a folder that is no default', async () => {
    await withDefaults([{ key: 'mode:pages', folderId: 'elsewhere' }]);
    const { container } = render(<DefaultFolderMarker folderId="w" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the key’s icon and says what it means', async () => {
    await withDefaults([{ key: 'mode:pages', folderId: 'w' }]);
    const { container } = render(<DefaultFolderMarker folderId="w" />);
    expect(icons(container)).toBe(1);
    expect(screen.getByText('Default folder for new documents')).toBeTruthy();
  });

  it('leaves the words to the host when asked', async () => {
    await withDefaults([{ key: 'mode:pages', folderId: 'w' }]);
    render(<DefaultFolderMarker folderId="w" withWords={false} />);
    expect(screen.queryByText('Default folder for new documents')).toBeNull();
  });
});
