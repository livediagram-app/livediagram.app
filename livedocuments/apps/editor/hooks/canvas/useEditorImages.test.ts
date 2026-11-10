// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImage, createShape, type Element } from '@livedocuments/document';

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
        elements: () => [],
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

// docs/specs/009-elements/images.md "Alt text": one undo step a write, cleaned, none when nothing changes, and words that
// clean to nothing remove it.
describe('setImageAlt', () => {
  const picture = (alt?: string): Element => ({
    ...createImage(0, 0),
    id: 'pic',
    imageId: 'img-1',
    ...(alt === undefined ? {} : { alt }),
  });

  function withElements(start: Element[]) {
    let elements = start;
    const commit = vi.fn((map: (els: Element[]) => Element[]) => {
      elements = map(elements);
    });
    const { result } = renderHook(() =>
      useEditorImages({
        editsBlocked: true,
        isReadOnly: false,
        embedMode: false,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        elements: () => elements,
        commit,
        setSelectedId: vi.fn(),
        documentId: 'doc-1',
        ownerId: 'user_1',
        sessionShareCode: null,
      }),
    );
    return { set: result.current.setImageAlt, commit, now: () => elements };
  }

  it('writes the cleaned words as one commit, even where structure edits are blocked (a Participant)', () => {
    const shape = createShape('square', 0, 0);
    const h = withElements([picture('photo.jpg'), shape]);
    h.set('pic', '  A red\nbicycle \u202E ');
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(h.now()[0]).toMatchObject({ alt: 'A red bicycle' });
    expect(h.now()[1]).toBe(shape);
  });

  it('commits nothing when the cleaned words are what it holds', () => {
    const h = withElements([picture('A cat'), picture()]);
    h.set('pic', ' A cat ');
    expect(h.commit).not.toHaveBeenCalled();
    const bare = withElements([picture()]);
    bare.set('pic', '   ');
    expect(bare.commit).not.toHaveBeenCalled();
  });

  it('removes alt when the words clean to nothing', () => {
    const h = withElements([picture('A cat')]);
    h.set('pic', ' \u200B ');
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect('alt' in h.now()[0]!).toBe(false);
  });

  it('ignores an id that is not an image, or is gone', () => {
    const shape = createShape('square', 0, 0);
    const h = withElements([shape]);
    h.set(shape.id, 'Words');
    h.set('missing', 'Words');
    expect(h.commit).not.toHaveBeenCalled();
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
        elements: () => [],
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

// docs/specs/009-elements/picture-crop-and-mask.md "Share roles": a crop moves and resizes the box, so only an Editor
// crops; a Participant (edits blocked) and a Viewer (read-only) are offered none, and a locked image keeps its place.
describe('onCommitImageCrop', () => {
  function cropHook(opts: { isReadOnly?: boolean; editsBlocked?: boolean; locked?: boolean } = {}) {
    let elements: Element[] = [
      {
        ...createImage(10, 20),
        id: 'pic',
        imageId: 'img-1',
        ...(opts.locked ? { locked: true } : {}),
      },
      { ...createShape('square', 0, 0), id: 'box' },
    ];
    const commit = vi.fn((map: (els: Element[]) => Element[]) => {
      elements = map(elements);
    });
    const { result } = renderHook(() =>
      useEditorImages({
        editsBlocked: opts.editsBlocked ?? false,
        isReadOnly: opts.isReadOnly ?? false,
        embedMode: false,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        elements: () => elements,
        commit,
        setSelectedId: vi.fn(),
        documentId: 'doc-1',
        ownerId: 'user_1',
        sessionShareCode: null,
      }),
    );
    return { result, commit, get: () => elements };
  }
  const result = {
    x: 30,
    y: 40,
    width: 100,
    height: 50,
    crop: { x: 0.1, y: 0, width: 0.5, height: 1 },
  };

  it('lets an Editor crop: the box moves and keeps the part, one commit', () => {
    const h = cropHook();
    act(() => h.result.current.imageContext!.onCommitImageCrop!('pic', result));
    expect(h.commit).toHaveBeenCalledOnce();
    expect(h.get()[0]).toMatchObject(result);
    // Cropping back to the whole picture drops the stored crop.
    act(() =>
      h.result.current.imageContext!.onCommitImageCrop!('pic', {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
    );
    expect(h.get()[0]).not.toHaveProperty('crop');
    expect(h.get()[1]).toMatchObject({ id: 'box', x: 0, y: 0 });
  });

  it('offers a Participant and a Viewer no crop', () => {
    expect(
      cropHook({ editsBlocked: true }).result.current.imageContext?.onCommitImageCrop,
    ).toBeUndefined();
    expect(
      cropHook({ isReadOnly: true }).result.current.imageContext?.onCommitImageCrop,
    ).toBeUndefined();
  });

  it('never crops a locked image, nor what is not an image', () => {
    const h = cropHook({ locked: true });
    act(() => h.result.current.imageContext!.onCommitImageCrop!('pic', result));
    act(() => h.result.current.imageContext!.onCommitImageCrop!('box', result));
    expect(h.get()[0]).toMatchObject({ x: 10, y: 20 });
    expect(h.get()[0]).not.toHaveProperty('crop');
    expect(h.get()[1]).toMatchObject({ x: 0, y: 0 });
  });
});
