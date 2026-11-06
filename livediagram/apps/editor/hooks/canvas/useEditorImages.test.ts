// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The recent-images read (docs/specs/009-elements/images.md), and the workbench that never makes it
// (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table: upload only).

const { apiListImages } = vi.hoisted(() => ({ apiListImages: vi.fn(async () => []) }));
vi.mock('@/lib/api-client', () => ({ apiListImages, apiFetchImageDataUrl: vi.fn() }));

const { useEditorImages } = await import('./useEditorImages');

function mount(galleryHidden?: boolean, ownerId = 'user_1', editsBlocked = false) {
  return renderHook(
    ({ owner }: { owner: string }) =>
      useEditorImages({
        editsBlocked,
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

  // docs/specs/009-elements/images.md "Placeholder rendering": the Select Image button is offered only
  // where the picker opens, so a session whose edits cannot land shows none.
  it('offers the picker only while edits can land', () => {
    expect(mount().result.current.imageContext?.onOpenPicker).toBeTypeOf('function');
    expect(mount(false, 'user_1', true).result.current.imageContext?.onOpenPicker).toBeUndefined();
  });
});

// docs/specs/009-elements/images.md "Locked images": a locked tab holds an image's place, not its picture, so the
// picker still opens and the pick lands through the picture commit, which skips the tab lock.
describe('an image on a locked tab', () => {
  function mountLocked(picture?: { blocked: boolean }) {
    const commit = vi.fn();
    const commitPicture = vi.fn();
    const hook = renderHook(() =>
      useEditorImages({
        editsBlocked: true,
        isReadOnly: false,
        embedMode: false,
        galleryHidden: true,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commit,
        setSelectedId: vi.fn(),
        documentId: 'doc-1',
        ownerId: 'user_1',
        sessionShareCode: null,
        ...(picture ? { pictureBlocked: picture.blocked, commitPicture } : {}),
      }),
    );
    return { hook, commit, commitPicture };
  }

  it('keeps the picker, and the pick and its removal land through the picture commit', () => {
    const { hook, commit, commitPicture } = mountLocked({ blocked: false });
    const open = hook.result.current.imageContext?.onOpenPicker;
    expect(open).toBeTypeOf('function');
    act(() => open!('img-1'));
    expect(hook.result.current.imagePickerOpenFor).toEqual({ forElementId: 'img-1' });
    act(() =>
      hook.result.current.applyImageToElement('img-1', { id: 'pic', width: 10, height: 10 }),
    );
    act(() => hook.result.current.removeImageFromElement('img-1'));
    expect(commitPicture).toHaveBeenCalledTimes(2);
    expect(commit).not.toHaveBeenCalled();
  });

  it('offers no picker to a session that may not swap pictures at all', () => {
    const { hook } = mountLocked({ blocked: true });
    expect(hook.result.current.imageContext?.onOpenPicker).toBeUndefined();
    act(() => hook.result.current.openImagePickerFor('img-1'));
    expect(hook.result.current.imagePickerOpenFor).toBeNull();
  });

  it('falls back to the page guard and commit when the host passes neither', () => {
    const { hook, commit } = mountLocked();
    expect(hook.result.current.imageContext?.onOpenPicker).toBeUndefined();
    act(() =>
      hook.result.current.applyImageToElement('img-1', { id: 'pic', width: 10, height: 10 }),
    );
    expect(commit).toHaveBeenCalledOnce();
  });
});
