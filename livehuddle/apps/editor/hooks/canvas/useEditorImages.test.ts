// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The recent-images read (docs/specs/009-elements/images.md).

const { apiListImages } = vi.hoisted(() => ({ apiListImages: vi.fn(async () => []) }));
vi.mock('@/lib/api-client', () => ({ apiListImages, apiFetchImageDataUrl: vi.fn() }));

const { useEditorImages } = await import('./useEditorImages');

function mount(ownerId = 'user_1', editsBlocked = false) {
  return renderHook(
    ({ owner }: { owner: string }) =>
      useEditorImages({
        editsBlocked,
        isReadOnly: false,
        embedMode: false,
        commit: vi.fn(),
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

  // docs/specs/006-document/offline-mode.md "Instant open": the placeholder reader has no gallery, and
  // the read follows once the reader is known.
  it("waits for the reader when the document opened under the 'self' placeholder", () => {
    const hook = mount('self');
    expect(apiListImages).not.toHaveBeenCalled();
    hook.rerender({ owner: 'guest-1' });
    expect(apiListImages).toHaveBeenCalledExactlyOnceWith('guest-1');
  });

  // docs/specs/009-elements/images.md "Placeholder rendering": the Select Image button is offered only
  // where the picker opens, so a locked tab's empty image shows none.
  it('offers the picker only while edits can land', () => {
    expect(mount().result.current.imageContext?.onOpenPicker).toBeTypeOf('function');
    expect(mount('user_1', true).result.current.imageContext?.onOpenPicker).toBeUndefined();
  });
});
