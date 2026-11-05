// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import { DROP_NOT_TAKEN } from '@/lib/drop-import-hint';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/lib/upload-image', () => ({ addImageFileForDocument: upload }));

// A file dropped on the canvas: a picture lands as an image where it was released, a livehuddle export is pointed
// at Import, and anything else (an Excalidraw file included: imports from other tools are gone,
// docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools") is refused.

function harness(options: { isReadOnly?: boolean } = {}) {
  let elements: Element[] = [];
  const addImageFromGallery = vi.fn();
  const toast = { error: vi.fn(), info: vi.fn() };
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: options.isReadOnly ?? false,
      embedMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements },
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      addImageFromGallery,
      ownerId: 'me',
      documentId: 'd',
      toast: toast as never,
    }),
  );
  return { toast, addImageFromGallery, dropBoardFile: result.current.dropBoardFile };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('dropping a file on the canvas', () => {
  const at = { x: 120, y: -40 };

  it('lands a dropped picture as an image where it was released, as a paste does', async () => {
    upload.mockResolvedValue({
      image: { id: 'img', width: 4, height: 2, originalName: 'photo.png' },
    });
    const h = harness();
    h.dropBoardFile(
      new File([new Uint8Array([0x89, 0x50])], 'photo.png', { type: 'image/png' }),
      at,
    );
    await vi.waitFor(() => expect(h.addImageFromGallery).toHaveBeenCalledTimes(1));
    expect(h.addImageFromGallery).toHaveBeenCalledWith(expect.objectContaining({ id: 'img' }), at);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('refuses an Excalidraw file, or any file that is not a picture, and lands nothing', async () => {
    const h = harness();
    h.dropBoardFile(new File(['{"type":"excalidraw"}'], 'board.excalidraw'), at);
    h.dropBoardFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }), at);
    await settle();
    expect(h.toast.info).toHaveBeenCalledTimes(2);
    expect(h.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN);
    expect(upload).not.toHaveBeenCalled();
  });

  it('points a dropped file the Import dialog reads at Import', () => {
    const h = harness();
    h.dropBoardFile(new File(['{}'], 'tab.json', { type: '' }), at);
    expect(h.toast.info).toHaveBeenCalledWith(
      'To bring in a livehuddle export, use Import in the tab menu.',
    );
  });

  it('does nothing when read-only', async () => {
    const h = harness({ isReadOnly: true });
    h.dropBoardFile(new File(['hello'], 'notes.txt'), at);
    await settle();
    expect(h.toast.info).not.toHaveBeenCalled();
  });
});
