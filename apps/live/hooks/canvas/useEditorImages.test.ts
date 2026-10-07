// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The recent-images read (docs/specs/009-elements/images.md), and the workbench that never makes it
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table: upload only).

const { apiListImages } = vi.hoisted(() => ({ apiListImages: vi.fn(async () => []) }));
vi.mock('@/lib/api-client', () => ({ apiListImages, apiFetchImageDataUrl: vi.fn() }));

const { useEditorImages } = await import('./useEditorImages');

function mount(galleryHidden?: boolean) {
  return renderHook(() =>
    useEditorImages({
      editsBlocked: false,
      isReadOnly: false,
      embedMode: false,
      galleryHidden,
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commit: vi.fn(),
      setSelectedId: vi.fn(),
      documentId: 'doc-1',
      ownerId: 'user_1',
      sessionShareCode: null,
    }),
  );
}

afterEach(() => apiListImages.mockClear());

describe('useEditorImages', () => {
  it('reads the recent images of an editable document', () => {
    mount();
    expect(apiListImages).toHaveBeenCalledWith('user_1');
  });

  it('never reads the gallery in a workbench', () => {
    mount(true);
    expect(apiListImages).not.toHaveBeenCalled();
  });
});
