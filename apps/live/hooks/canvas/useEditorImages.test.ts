// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The recent-images read (docs/specs/009-elements/images.md), and the workbench that never makes it
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table: upload only).

const { apiListImages } = vi.hoisted(() => ({ apiListImages: vi.fn(async () => []) }));
vi.mock('@/lib/api-client', () => ({ apiListImages, apiFetchImageDataUrl: vi.fn() }));

const { useEditorImages } = await import('./useEditorImages');

function mount(galleryHidden?: boolean, ownerId = 'user_1') {
  return renderHook(
    ({ owner }: { owner: string }) =>
      useEditorImages({
        editsBlocked: false,
        isReadOnly: false,
        embedMode: false,
        galleryHidden,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commit: vi.fn(),
        setSelectedId: vi.fn(),
        documentId: 'doc-1',
        ownerId: owner,
        sessionShareCode: null,
      }),
    { initialProps: { owner: ownerId } },
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

  // docs/specs/006-document/offline-mode.md "Instant open": the placeholder reader has no gallery, and
  // the read follows once the reader is known.
  it("waits for the reader when the document opened under the 'self' placeholder", () => {
    const hook = mount(false, 'self');
    expect(apiListImages).not.toHaveBeenCalled();
    hook.rerender({ owner: 'guest-1' });
    expect(apiListImages).toHaveBeenCalledExactlyOnceWith('guest-1');
  });
});
