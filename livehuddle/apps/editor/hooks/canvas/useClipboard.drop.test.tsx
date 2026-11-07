// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, ImageElement } from '@livehuddle/document';
import { DROP_NOT_TAKEN } from '@/lib/drop-import-hint';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));
const upload = vi.hoisted(() => ({ addImageFileForDocument: vi.fn() }));
vi.mock('@/lib/upload-image', () => upload);

// A file dropped or pasted on the canvas (docs/specs/009-elements/images.md "Paste and drop"): a picture is uploaded
// through the media service and lands as an image element; a livehuddle export is pointed at Import; anything else is
// refused and lands nothing. An Editor's alone: a Participant's and a Viewer's session is read-only.

type Options = {
  isReadOnly?: boolean;
  createBlocked?: boolean;
  embedMode?: boolean;
  noViewport?: boolean;
};

function harness(options: Options = {}) {
  let elements: Element[] = [];
  const toast = { error: vi.fn(), info: vi.fn() };
  const setSelectedId = vi.fn();
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: options.isReadOnly ?? false,
      createBlocked: options.createBlocked,
      embedMode: options.embedMode,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements },
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId,
      setMultiSelectedIds: () => {},
      toast: toast as never,
      getViewportCanvasRect: options.noViewport
        ? () => null
        : () => ({ x: 100, y: 200, width: 800, height: 600 }),
      ownerId: 'guest_1',
      documentId: 'doc-1',
    }),
  );
  return {
    toast,
    setSelectedId,
    dropBoardFile: result.current.dropBoardFile,
    elements: () => elements,
  };
}

const picture = (name = 'photo.png') =>
  new File([new Uint8Array([0x89, 0x50])], name, { type: 'image/png' });

function uploaded(width = 1200, height = 600, originalName: string | undefined = 'photo.png') {
  upload.addImageFileForDocument.mockResolvedValue({
    image: { id: 'img-1', width, height, originalName, contentType: 'image/png' },
    deduped: false,
  });
}

function paste(data: Partial<DataTransfer>): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: { files: [], items: [], getData: () => '', ...data },
  });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

const landed = async (h: ReturnType<typeof harness>) => {
  await waitFor(() => expect(h.elements()).toHaveLength(1));
  return h.elements()[0] as ImageElement;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('dropping a file on the canvas', () => {
  it('uploads a dropped picture and lands it, its own shape, centred where it was released', async () => {
    uploaded(1200, 600);
    const h = harness();
    h.dropBoardFile(picture(), { x: 500, y: 400 });
    const image = await landed(h);
    expect(upload.addImageFileForDocument).toHaveBeenCalledWith(
      'guest_1',
      'doc-1',
      expect.any(File),
    );
    expect(image).toMatchObject({
      type: 'image',
      imageId: 'img-1',
      width: 240,
      height: 120,
      x: 380,
      y: 340,
      naturalWidth: 1200,
      naturalHeight: 600,
      alt: 'photo.png',
    });
    expect(h.setSelectedId).toHaveBeenCalledWith(image.id);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('refuses an Excalidraw file or any other file, and lands nothing', () => {
    const h = harness();
    h.dropBoardFile(new File(['{"type":"excalidraw"}'], 'board.excalidraw'), { x: 0, y: 0 });
    h.dropBoardFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }), { x: 0, y: 0 });
    expect(h.toast.info).toHaveBeenCalledTimes(2);
    expect(h.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN);
    expect(upload.addImageFileForDocument).not.toHaveBeenCalled();
    expect(h.elements()).toEqual([]);
  });

  it('points a dropped file the Import dialog reads at Import', () => {
    const h = harness();
    h.dropBoardFile(new File(['{}'], 'tab.json', { type: '' }), { x: 0, y: 0 });
    expect(h.toast.info).toHaveBeenCalledWith(
      'To bring in a livehuddle export, use Import in the tab menu.',
    );
  });

  it('says why when the upload is refused, and lands nothing', async () => {
    upload.addImageFileForDocument.mockRejectedValue(new Error('Too large. Limit is 10 MB.'));
    const h = harness();
    h.dropBoardFile(picture(), { x: 0, y: 0 });
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Too large. Limit is 10 MB.'));
    expect(h.elements()).toEqual([]);
  });

  it('falls back to a plain message for a refusal that is not an Error', async () => {
    upload.addImageFileForDocument.mockRejectedValue('nope');
    const h = harness();
    h.dropBoardFile(picture(), { x: 0, y: 0 });
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Could not add the picture.'));
  });

  it('adds nothing while creation is blocked, and refuses a picture in an embed', async () => {
    const blocked = harness({ createBlocked: true });
    blocked.dropBoardFile(picture(), { x: 0, y: 0 });
    const embed = harness({ embedMode: true });
    embed.dropBoardFile(picture(), { x: 0, y: 0 });
    await waitFor(() => expect(embed.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN));
    expect(upload.addImageFileForDocument).not.toHaveBeenCalled();
    expect(blocked.toast.info).not.toHaveBeenCalled();
  });
});

describe('pasting a file on the canvas', () => {
  it('uploads a pasted screenshot under a name of its own and lands it in the middle of the screen', async () => {
    uploaded(300, 600, '');
    const h = harness();
    const event = paste({ files: [picture('image.png')] as unknown as FileList });
    expect(event.defaultPrevented).toBe(true);
    const image = await landed(h);
    const sent = upload.addImageFileForDocument.mock.calls[0]![2] as File;
    expect(sent.name).toMatch(/^pasted-\d+\.png$/);
    // Taller than wide: 240 high, centred on the viewport's middle (500, 500).
    expect(image).toMatchObject({ width: 120, height: 240, x: 440, y: 380 });
    expect(image.alt).toBeUndefined();
  });

  it('lands a paste on the origin before the viewport is measured', async () => {
    uploaded(100, 100);
    const h = harness({ noViewport: true });
    paste({ files: [picture()] as unknown as FileList });
    expect(await landed(h)).toMatchObject({ x: -120, y: -120, width: 240, height: 240 });
  });

  it("takes Safari's image item when the file list is empty", async () => {
    uploaded();
    const h = harness();
    const file = picture('shot.png');
    paste({
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/png', getAsFile: () => file },
      ] as unknown as DataTransferItemList,
    });
    await landed(h);
    expect(upload.addImageFileForDocument.mock.calls[0]![2]).toBe(file);
  });

  it('refuses a pasted file that is not a picture, rather than landing it or the element clipboard', () => {
    const h = harness();
    const event = paste({
      files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] as unknown as FileList,
      items: [
        { kind: 'file', type: 'image/png', getAsFile: () => null },
      ] as unknown as DataTransferItemList,
    });
    expect(event.defaultPrevented).toBe(true);
    expect(h.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN);
    expect(upload.addImageFileForDocument).not.toHaveBeenCalled();
    expect(h.elements()).toEqual([]);
  });
});

// docs/specs/009-elements/images.md "Share roles": only an Editor adds an image. A Participant's and a Viewer's
// session is read-only (lib/share-roles.test.ts), and neither a drop nor a paste lands anything for it.
describe.each([
  ['edit', false, 1],
  ['participate', true, 0],
  ['view', true, 0],
] as const)('a %s session', (level, isReadOnly, lands) => {
  it(`${lands ? 'adds' : 'adds no'} image by drop or paste`, async () => {
    uploaded();
    const h = harness({ isReadOnly });
    h.dropBoardFile(picture(), { x: 0, y: 0 });
    paste({ files: [picture()] as unknown as FileList });
    if (lands) await waitFor(() => expect(h.elements()).toHaveLength(2));
    else {
      await Promise.resolve();
      expect(h.elements(), level).toEqual([]);
      expect(upload.addImageFileForDocument).not.toHaveBeenCalled();
      expect(h.toast.info).not.toHaveBeenCalled();
    }
  });
});
