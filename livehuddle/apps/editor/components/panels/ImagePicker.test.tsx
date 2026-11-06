// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The image picker: upload, the person's gallery and search.

const { apiListImages } = vi.hoisted(() => ({ apiListImages: vi.fn(async () => []) }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiListImages,
}));

const { ImagePicker } = await import('./ImagePicker');

function show() {
  render(
    <ImagePicker
      ownerId="user_1"
      documentId="doc-1"
      forElementId={null}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

afterEach(() => apiListImages.mockClear());

describe('ImagePicker', () => {
  it('offers the gallery and search, and reads the gallery', () => {
    show();
    expect(screen.getByRole('button', { name: /Gallery/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(apiListImages).toHaveBeenCalledWith('user_1');
  });

  it('shows an empty gallery as the shared empty state', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /Gallery/ }));
    expect((await screen.findByText('No images yet')).closest('[data-empty-state]')).toBeTruthy();
  });
});
