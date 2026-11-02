// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
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
  // where the picker opens, so a locked tab's empty image shows none.
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
