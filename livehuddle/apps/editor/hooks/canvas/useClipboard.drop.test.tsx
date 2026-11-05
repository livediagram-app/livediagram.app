// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import { DROP_NOT_TAKEN } from '@/lib/drop-import-hint';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// A file dropped or pasted on the canvas: a livehuddle export is pointed at Import, and anything else, a picture
// included, is refused and lands nothing (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link
// card", "Imports from other tools").

function harness(options: { isReadOnly?: boolean } = {}) {
  let elements: Element[] = [];
  const toast = { error: vi.fn(), info: vi.fn() };
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: options.isReadOnly ?? false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements },
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      toast: toast as never,
    }),
  );
  return { toast, dropBoardFile: result.current.dropBoardFile, elements: () => elements };
}

const picture = () => new File([new Uint8Array([0x89, 0x50])], 'photo.png', { type: 'image/png' });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('dropping a file on the canvas', () => {
  it('refuses a picture, an Excalidraw file or any other file, and lands nothing', () => {
    const h = harness();
    h.dropBoardFile(picture());
    h.dropBoardFile(new File(['{"type":"excalidraw"}'], 'board.excalidraw'));
    h.dropBoardFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(h.toast.info).toHaveBeenCalledTimes(3);
    expect(h.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN);
    expect(h.elements()).toEqual([]);
  });

  it('points a dropped file the Import dialog reads at Import', () => {
    const h = harness();
    h.dropBoardFile(new File(['{}'], 'tab.json', { type: '' }));
    expect(h.toast.info).toHaveBeenCalledWith(
      'To bring in a livehuddle export, use Import in the tab menu.',
    );
  });

  it('does nothing when read-only', () => {
    const h = harness({ isReadOnly: true });
    h.dropBoardFile(new File(['hello'], 'notes.txt'));
    expect(h.toast.info).not.toHaveBeenCalled();
  });
});

describe('pasting a file on the canvas', () => {
  it('refuses a pasted picture rather than landing it or the element clipboard', () => {
    const h = harness();
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [picture()], items: [], getData: () => '' },
    });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(h.toast.info).toHaveBeenCalledWith(DROP_NOT_TAKEN);
    expect(h.elements()).toEqual([]);
  });
});
