// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';

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
  // where the picker opens, so a session whose edits cannot land shows none.
  it('offers the picker only while edits can land', () => {
    expect(mount().result.current.imageContext?.onOpenPicker).toBeTypeOf('function');
    expect(mount('user_1', true).result.current.imageContext?.onOpenPicker).toBeUndefined();
  });
});

// docs/specs/009-elements/images.md "Placeholder rendering": the pick and its removal land through the page's commit.
describe('a picture swap', () => {
  it('opens the picker, and the pick and its removal land through commit', () => {
    const commit = vi.fn();
    const hook = renderHook(() =>
      useEditorImages({
        editsBlocked: false,
        isReadOnly: false,
        embedMode: false,
        commit,
        documentId: 'doc-1',
        ownerId: 'user_1',
        sessionShareCode: null,
      }),
    );
    act(() => hook.result.current.imageContext!.onOpenPicker!('img-1'));
    expect(hook.result.current.imagePickerOpenFor).toEqual({ forElementId: 'img-1' });
    act(() =>
      hook.result.current.applyImageToElement('img-1', { id: 'pic', width: 10, height: 10 }),
    );
    act(() => hook.result.current.removeImageFromElement('img-1'));
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it('opens no picker while edits cannot land', () => {
    const hook = mount('user_1', true);
    act(() => hook.result.current.openImagePickerFor('img-1'));
    expect(hook.result.current.imagePickerOpenFor).toBeNull();
  });
});

// docs/specs/009-elements/poster.md "Choosing its picture": a Poster's picture is set, replaced and cleared through the
// same picker and commit, an Editor's alone.
describe("a Poster's picture", () => {
  const poster = {
    id: 'p',
    type: 'shape',
    shape: 'poster',
    x: 0,
    y: 0,
    width: 56,
    height: 76,
    label: '',
  } as const;
  const credit = {
    text: '"Hills" by A. Painter, CC BY 4.0',
    sourceUrl: 'https://example.org/hills',
  };
  function posterHook(choosesPosterPicture: boolean) {
    let els = [poster] as unknown as Element[];
    const commit = vi.fn((map: (e: Element[]) => Element[]) => {
      els = map(els);
    });
    const hook = renderHook(() =>
      useEditorImages({
        editsBlocked: false,
        isReadOnly: false,
        embedMode: false,
        choosesPosterPicture,
        commit,
        documentId: 'doc-1',
        ownerId: 'user_1',
        sessionShareCode: null,
      }),
    );
    return { hook, now: () => els[0] as unknown as Record<string, unknown> };
  }

  it('sets, replaces and clears it, keeping the frame', () => {
    const { hook, now } = posterHook(true);
    expect(hook.result.current.imageContext?.posterPicker).toBe(true);
    act(() =>
      hook.result.current.applyImageToElement('p', {
        id: 'img_a',
        width: 800,
        height: 600,
        credit,
      }),
    );
    expect(now()).toMatchObject({ imageId: 'img_a', credit, width: 56, height: 76 });
    act(() => hook.result.current.applyImageToElement('p', { id: 'img_b', width: 1, height: 1 }));
    expect(now().imageId).toBe('img_b');
    expect(now()).not.toHaveProperty('credit');
    act(() => hook.result.current.removeImageFromElement('p'));
    expect(now()).not.toHaveProperty('imageId');
    expect(now()).toMatchObject({ shape: 'poster', width: 56, height: 76 });
  });

  it('leaves it alone for a session that may not choose it (a Participant)', () => {
    const { hook, now } = posterHook(false);
    expect(hook.result.current.imageContext?.posterPicker).toBe(false);
    act(() => hook.result.current.applyImageToElement('p', { id: 'img_a', width: 1, height: 1 }));
    expect(now()).not.toHaveProperty('imageId');
  });
});
