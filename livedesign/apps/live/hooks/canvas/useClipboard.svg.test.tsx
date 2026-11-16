// @vitest-environment jsdom
// docs/specs/020-import-export/svg-import.md "Where an SVG comes in": a dropped or pasted SVG file, or SVG markup
// pasted as text, goes to the SVG importer with the paste's image upload standing by for the picture fallback.
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/design';
import { useClipboard } from './useClipboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

const MARKUP = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

function harness(
  importSvg = vi.fn(async (_text: string, _route: string, _opts: unknown) => undefined),
) {
  const elements: Element[] = [];
  const toast = { error: vi.fn(), info: vi.fn() };
  const { result } = renderHook(() =>
    useClipboard({
      isReadOnly: false,
      embedMode: false,
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      editingId: null,
      setEditingId: () => {},
      activeTab: { id: 't', name: 'Board', elements },
      commit: () => {},
      setSelectedId: () => {},
      setMultiSelectedIds: () => {},
      ownerId: 'me',
      designId: 'd',
      toast: toast as never,
      importSvg,
    }),
  );
  return { result, importSvg, toast };
}

function paste(text: string, files: File[] = []) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: () => text, files, items: [] },
  });
  document.body.dispatchEvent(event);
  return event;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('SVG drop and paste', () => {
  it('sends a dropped SVG file to the importer, at its drop point', async () => {
    const h = harness();
    const file = new File([MARKUP], 'logo.svg', { type: 'image/svg+xml' });
    h.result.current.dropBoardFile(file, { x: 5, y: 6 });
    await vi.waitFor(() => expect(h.importSvg).toHaveBeenCalled());
    expect(h.importSvg).toHaveBeenCalledWith(MARKUP, 'drop', {
      at: { x: 5, y: 6 },
      file,
      placePicture: expect.any(Function),
    });
  });

  it('never reads a dropped file past the size cap', async () => {
    const h = harness();
    const file = new File(['<svg/>'], 'huge.svg', { type: '' });
    Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 });
    const read = vi.spyOn(file, 'text');
    h.result.current.dropBoardFile(file, { x: 0, y: 0 });
    await vi.waitFor(() => expect(h.importSvg).toHaveBeenCalled());
    expect(read).not.toHaveBeenCalled();
    expect(h.importSvg.mock.calls[0]![0]).toBe('');
  });

  it('says so when a dropped SVG cannot be read', async () => {
    const h = harness();
    const file = new File([MARKUP], 'logo.svg', { type: 'image/svg+xml' });
    vi.spyOn(file, 'text').mockRejectedValue(new Error('gone'));
    h.result.current.dropBoardFile(file, { x: 0, y: 0 });
    await vi.waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Could not read the SVG.'));
    expect(h.importSvg).not.toHaveBeenCalled();
  });

  it('sends a pasted SVG file and pasted SVG markup to the importer', async () => {
    const h = harness();
    const file = new File([MARKUP], 'icon.svg', { type: 'image/svg+xml' });
    expect(paste('', [file]).defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(h.importSvg).toHaveBeenCalledTimes(1));
    expect(h.importSvg.mock.calls[0]![1]).toBe('paste');
    expect(paste(`<?xml version="1.0"?>\n${MARKUP}`).defaultPrevented).toBe(true);
    expect(h.importSvg).toHaveBeenCalledTimes(2);
    expect(h.importSvg.mock.calls[1]![2]).toEqual({ placePicture: expect.any(Function) });
  });

  it('leaves ordinary text to the browser', () => {
    const h = harness();
    paste('just words');
    expect(h.importSvg).not.toHaveBeenCalled();
  });
});
