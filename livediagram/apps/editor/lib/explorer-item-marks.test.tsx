// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';

vi.mock('@/components/drive/DocumentSyncMark', () => ({
  DocumentSyncMark: (p: { documentId: string; savedAt: number }) => (
    <i data-sync={`${p.documentId}@${p.savedAt}`} />
  ),
}));
vi.mock('@/components/drive/DriveNoticeMarker', () => ({
  DriveNoticeMarker: (p: { documentId: string }) => <i data-notice={p.documentId} />,
}));

import { driveItemMarks, isMirroredItem } from './explorer-item-marks';

// docs/specs/022-drive-mirror/drive-mirror.md "The Explorer shows each document's sync": only a canvas the mirror
// copies (the person's own, in their own space, not shared with them, not in the Trash) wears a Drive mark.
const item = (over: Partial<Item> = {}) =>
  ({
    id: 'd1',
    app: 'livediagram',
    ownerId: 'user_a',
    teamId: null,
    sharedVia: null,
    trashedAt: null,
    updatedAt: 42,
    ...over,
  }) as Item;

describe('Drive marks on the Explorer', () => {
  it("marks only the person's own canvases in their own space", () => {
    expect(isMirroredItem(item(), 'user_a')).toBe(true);
    for (const over of [
      { teamId: 't1' },
      { sharedVia: 'CODE' },
      { trashedAt: 1 },
      { ownerId: 'user_b' },
      { app: 'liveplanner' as const },
    ])
      expect(isMirroredItem(item(over), 'user_a')).toBe(false);
    expect(isMirroredItem(item(), null)).toBe(false);
  });

  it('draws the unseen-folder mark by the name and the sync by the time, one function per person', () => {
    const marks = driveItemMarks('user_a');
    expect(driveItemMarks('user_a')).toBe(marks);
    const { container } = render(
      <>
        {marks(item(), 'title')}
        {marks(item(), 'time')}
        {marks(item({ teamId: 't1' }), 'time')}
      </>,
    );
    expect(container.querySelector('[data-notice="d1"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-sync]')).toHaveLength(1);
    expect(container.querySelector('[data-sync="d1@42"]')).toBeTruthy();
  });
});
