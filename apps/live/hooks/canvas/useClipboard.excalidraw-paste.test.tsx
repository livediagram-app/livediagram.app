// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element, StickyElement, Tab } from '@livediagram/document';
import type { BoardScene } from '@/lib/board-scene/scene';
import { serialiseElements } from '@/lib/clipboard-payload';
import { excalidrawBuilder, excalidrawText } from '@/lib/excalidraw-fixtures';
import { EXCALIDRAW_CLIPBOARD_MIME } from '@/lib/excalidraw-paste';
import { track } from '@/lib/telemetry';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/lib/upload-image', () => ({ addImageFileForDocument: upload }));

// Cmd/Ctrl+V of an Excalidraw copy (docs/specs/020-import-export/excalidraw-import-export.md "Paste"):
// the copy becomes a board scene and goes to the board-scene insert, which lands it for the tab.

const own: StickyElement = {
  id: 'own',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  label: 'ours',
} as StickyElement;

function harness(
  options: {
    editingId?: string | null;
    isReadOnly?: boolean;
    withInsert?: boolean;
    kind?: Tab['kind'];
  } = {},
) {
  let elements: Element[] = [];
  const insertBoardScene = vi.fn<(scene: BoardScene) => void>();
  const addImageFromGallery = vi.fn();
  const toast = { error: vi.fn() };
  const setEditingId = vi.fn();
  renderHook(() =>
    useClipboard({
      isReadOnly: options.isReadOnly ?? false,
      embedMode: false,
      selectedId: null,
      multiSelectedIds: new Set(),
      editingId: options.editingId ?? null,
      setEditingId,
      activeTab: { id: 't', name: 'Board', kind: options.kind, elements } as Tab,
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      addImageFromGallery,
      ownerId: 'me',
      documentId: 'd',
      toast: toast as never,
      ...(options.withInsert === false ? {} : { insertBoardScene }),
    }),
  );
  return { elements: () => elements, insertBoardScene, toast, setEditingId, addImageFromGallery };
}

function paste(target: EventTarget, entries: Record<string, string>, files: File[] = []): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => entries[type] ?? '', files, items: [] },
  });
  target.dispatchEvent(event);
  return event;
}

const copy = () => {
  const b = excalidrawBuilder();
  const box = b.rectangle();
  return excalidrawText([
    box,
    b.label(box, 'Read file'),
    b.freedraw([
      [0, 0],
      [5, 5],
    ]),
  ]);
};

const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('pasting an Excalidraw copy on the canvas', () => {
  it.each([['whiteboard' as const], [undefined]])(
    'hands the scene to the board-scene insert (tab kind %s)',
    async (kind) => {
      const h = harness({ kind });
      const event = paste(document.body, { 'text/plain': copy() });
      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(h.insertBoardScene).toHaveBeenCalledTimes(1));
      const scene = h.insertBoardScene.mock.calls[0]![0];
      expect(scene.source).toBe('excalidraw');
      expect(scene.items.map((i) => i.kind)).toEqual(['shape', 'ink']);
      expect(h.elements()).toEqual([]);
      expect(track).toHaveBeenCalledWith('Element', 'Imported', 'Excalidraw');
    },
  );

  it("reads Excalidraw's own clipboard type first", async () => {
    const h = harness();
    paste(document.body, { [EXCALIDRAW_CLIPBOARD_MIME]: copy(), 'text/plain': 'something else' });
    await vi.waitFor(() => expect(h.insertBoardScene).toHaveBeenCalledTimes(1));
  });

  it('says why a broken copy did not paste, and lands nothing', async () => {
    const h = harness();
    const event = paste(document.body, {
      'text/plain': '{"type":"excalidraw/clipboard","elements":',
    });
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("File isn't valid JSON."));
    expect(h.insertBoardScene).not.toHaveBeenCalled();
  });

  it('leaves our own copied elements and ordinary text as they were', () => {
    const h = harness();
    paste(document.body, { 'text/plain': serialiseElements([own]) });
    expect(h.elements()).toHaveLength(1);
    const plain = paste(document.body, { 'text/plain': 'hello' });
    expect(h.insertBoardScene).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(true); // nothing on our side: the in-app buffer path
  });

  it('does nothing when read-only', () => {
    const h = harness({ isReadOnly: true });
    const event = paste(document.body, { 'text/plain': copy() });
    expect(event.defaultPrevented).toBe(false);
    expect(h.insertBoardScene).not.toHaveBeenCalled();
  });

  it('leaves the text to the browser where no insert is wired', () => {
    const h = harness({ withInsert: false });
    paste(document.body, { 'text/plain': copy() });
    expect(h.elements()).toEqual([]);
    expect(h.toast.error).not.toHaveBeenCalled();
  });
});

describe('pasting an Excalidraw copy while a label is open for typing', () => {
  it('ends typing and lands the scene instead of typing its JSON', async () => {
    const h = harness({ editingId: 'open' });
    const root = document.createElement('div');
    root.setAttribute('data-canvas-a11y-root', '');
    const label = document.createElement('div');
    label.contentEditable = 'true';
    Object.defineProperty(label, 'isContentEditable', { value: true });
    root.appendChild(label);
    document.body.appendChild(root);
    const event = paste(label, { 'text/plain': copy() });
    expect(event.defaultPrevented).toBe(true);
    expect(h.setEditingId).toHaveBeenCalledWith(null);
    await vi.waitFor(() => expect(h.insertBoardScene).toHaveBeenCalledTimes(1));
  });
});

describe('pasting an Excalidraw file', () => {
  it('lands a .excalidraw file through the insert', async () => {
    const h = harness();
    const file = new File(
      [excalidrawText([excalidrawBuilder().ellipse()], { type: 'excalidraw' })],
      'b.excalidraw',
    );
    const event = paste(document.body, {}, [file]);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(h.insertBoardScene).toHaveBeenCalledTimes(1));
    expect(h.insertBoardScene.mock.calls[0]![0].items.map((i) => i.kind)).toEqual(['shape']);
    expect(upload).not.toHaveBeenCalled();
  });

  it('pastes a PNG without a scene as an ordinary image', async () => {
    upload.mockResolvedValue({ image: { id: 'img', width: 1, height: 1, originalName: 's.png' } });
    const h = harness();
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0,
    ]);
    paste(document.body, {}, [new File([png], 'shot.png', { type: 'image/png' })]);
    await vi.waitFor(() => expect(h.addImageFromGallery).toHaveBeenCalledTimes(1));
    expect(h.insertBoardScene).not.toHaveBeenCalled();
  });

  it('says why a broken .excalidraw file did not paste', async () => {
    const h = harness();
    paste(document.body, {}, [new File(['nope'], 'b.excalidraw')]);
    await settle();
    await vi.waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("File isn't valid JSON."));
    expect(h.insertBoardScene).not.toHaveBeenCalled();
  });
});
