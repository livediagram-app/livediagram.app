// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardScene } from '@/lib/board-scene/scene';
import { excalidrawBuilder, excalidrawText } from '@/lib/excalidraw-fixtures';
import { EXCALIDRAW_NOT_A_SCENE } from '@/lib/excalidraw-board-file';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportScenes } from './useMsWhiteboardImport';
import { track } from '@/lib/telemetry';
import { UNEXPECTED, useExcalidrawFileImport } from './useExcalidrawFileImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/020-import-export/excalidraw-import-export.md "Import as new documents": picked files
// become boards, each its own document, then the shared report.

const saved = (name: string) =>
  new File([excalidrawText([excalidrawBuilder().rectangle()], { type: 'excalidraw' })], name, {
    lastModified: Date.UTC(2026, 3, 20),
  });
const photo = () =>
  new File(
    [
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0,
      ]),
    ],
    'photo.png',
    {
      type: 'image/png',
    },
  );

function setup(importScenes: ImportScenes) {
  const onDone = vi.fn();
  const spy = vi.fn<ImportScenes>(importScenes);
  const { result } = renderHook(() => useExcalidrawFileImport({ importScenes: spy, onDone }));
  return { result, onDone, importScenes: spy };
}

const landedAll = async (scenes: BoardScene[]): Promise<ImportOutcome> => ({
  status: 'done',
  documents: scenes.map((s, i) => ({ id: `d${i}`, name: s.title ?? '' })),
});

afterEach(() => vi.clearAllMocks());

describe('useExcalidrawFileImport', () => {
  it('imports every readable file as a board and lists the rest in the report', async () => {
    const h = setup(landedAll);
    await act(() =>
      h.result.current.open([saved('Plan.excalidraw'), photo(), saved('Ideas.excalidraw')]),
    );
    expect(h.importScenes.mock.calls[0]![0].map((s) => s.title)).toEqual(['Plan', 'Ideas']);
    expect(h.onDone).toHaveBeenCalledWith({
      status: 'done',
      documents: [
        { id: 'd0', name: 'Plan' },
        { id: 'd1', name: 'Ideas' },
      ],
      failures: [{ title: 'photo', message: EXCALIDRAW_NOT_A_SCENE }],
    });
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Excalidraw');
  });

  it('keeps the import failures after the files it could not read', async () => {
    const h = setup(async () => ({
      status: 'done',
      documents: [{ id: 'd0', name: 'Plan' }],
      failures: [{ title: 'Big', message: 'Too big.' }],
    }));
    await act(() =>
      h.result.current.open([saved('Plan.excalidraw'), saved('Big.excalidraw'), photo()]),
    );
    expect(h.onDone.mock.calls[0]![0].failures).toEqual([
      { title: 'photo', message: EXCALIDRAW_NOT_A_SCENE },
      { title: 'Big', message: 'Too big.' },
    ]);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('stays on the pick step with the reason when no file holds a scene', async () => {
    const h = setup(landedAll);
    await act(() => h.result.current.open([photo()]));
    expect(h.result.current.state).toEqual({ step: 'pick', error: EXCALIDRAW_NOT_A_SCENE });
    expect(h.importScenes).not.toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled();
  });

  it('shows an import that failed outright on the pick step', async () => {
    const h = setup(async () => ({ status: 'error', error: 'No room.' }));
    await act(() => h.result.current.open([saved('Plan.excalidraw')]));
    expect(h.result.current.state).toEqual({ step: 'pick', error: 'No room.' });
  });

  it('says something unexpected happened when the import throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = setup(async () => {
      throw new Error('boom');
    });
    await act(() => h.result.current.open([saved('Plan.excalidraw')]));
    expect(h.result.current.state).toEqual({ step: 'pick', error: UNEXPECTED });
    expect(warn).toHaveBeenCalledWith('[excalidraw-import] failed', expect.any(Error));
    warn.mockRestore();
  });

  it('shows reading, then each board and its images as they import', async () => {
    let release!: () => void;
    const paused = new Promise<void>((r) => (release = r));
    let report!: (p: { board?: number; boards?: number; done: number; total: number }) => void;
    const h = setup(landedAll);
    h.importScenes.mockImplementation(async (scenes, onProgress) => {
      report = onProgress as typeof report;
      await paused;
      return landedAll(scenes);
    });
    let opening!: Promise<void>;
    act(() => {
      opening = h.result.current.open([saved('A.excalidraw'), saved('B.excalidraw')]);
    });
    expect(h.result.current.state).toEqual({ step: 'reading' });
    await vi.waitFor(() => expect(h.importScenes).toHaveBeenCalled());
    expect(h.result.current.state).toEqual({ step: 'importing', board: 1, boards: 2 });
    act(() => report({ board: 2, boards: 2, done: 1, total: 3 }));
    expect(h.result.current.state).toEqual({
      step: 'importing',
      board: 2,
      boards: 2,
      images: { done: 1, total: 3 },
    });
    release();
    await act(() => opening);
    expect(h.onDone).toHaveBeenCalled();
  });

  it('does nothing for an empty pick', async () => {
    const h = setup(landedAll);
    await act(() => h.result.current.open([]));
    expect(h.result.current.state).toEqual({ step: 'pick' });
    expect(h.importScenes).not.toHaveBeenCalled();
  });
});
