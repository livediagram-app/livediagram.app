// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHOOSE_FROM_MY_IMAGES, PageGalleryPicker } from './PageGalleryPicker';

// docs/specs/007-editor/pages-mode.md "Image backgrounds": Choose From My Images opens the person's gallery
// beside the panel; one press picks a picture and closes it.

const images = [
  { id: 'img-1', originalName: 'Beach.jpg', width: 800, height: 600 },
  { id: 'img-2', originalName: 'Hills.png', width: 800, height: 600 },
];
vi.mock('@/lib/api-client', () => ({
  apiListImages: vi.fn(async () => images),
  apiFetchImageDataUrl: vi.fn(),
}));
vi.mock('@/lib/offline/offline-store', () => ({ isOfflineIdSync: () => false }));
vi.mock('@/components/panels/GalleryImageButton', () => ({
  GalleryImageButton: (p: { ariaLabel: string; onClick: () => void }) => (
    <button type="button" aria-label={p.ariaLabel} onClick={p.onClick} />
  ),
}));

afterEach(cleanup);

describe('PageGalleryPicker', () => {
  it('lists the gallery beside the panel and hands on the picked picture', async () => {
    const onPicked = vi.fn();
    render(
      <div data-page-panel="">
        <PageGalleryPicker ownerId="o" documentId="d" onPicked={onPicked} />
      </div>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHOOSE_FROM_MY_IMAGES }));
    });
    expect(screen.getByRole('dialog', { name: 'My Images' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Hills.png' }));
    });
    expect(onPicked).toHaveBeenCalledWith(expect.objectContaining({ id: 'img-2' }));
    expect(screen.queryByRole('dialog', { name: 'My Images' })).toBeNull();
  });

  it('says so when there are no pictures yet', async () => {
    const { apiListImages } = await import('@/lib/api-client');
    vi.mocked(apiListImages).mockResolvedValueOnce([]);
    render(<PageGalleryPicker ownerId="o" documentId="d" onPicked={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHOOSE_FROM_MY_IMAGES }));
    });
    expect(screen.getByText('No images yet').closest('[data-empty-state]')).toBeTruthy();
  });
});
