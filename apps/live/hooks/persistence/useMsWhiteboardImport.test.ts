// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { writeZip } from '@/lib/zip-writer-fixture';
import { boardFiles, inkGroup } from '@/lib/ms-whiteboard/ms-whiteboard-fixtures';
import type { PickedExport } from '@/lib/pick-folder';
import type { ImportOutcome } from '@/lib/import-tab';
import { READ_ERRORS, UNEXPECTED, useMsWhiteboardImport } from './useMsWhiteboardImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { track } from '@/lib/telemetry';

vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const ink = () =>
  inkGroup({
    x: 0,
    y: 0,
    strokes: [
      {
        colour: '#e71224',
        stroke: {
          width: 512,
          points: [
            { x: 0, y: 0 },
            { x: 128, y: 0 },
          ],
        },
      },
    ],
  });

const asFiles = (...maps: Map<string, Uint8Array>[]): PickedExport => ({
  kind: 'files',
  files: maps.flatMap((m) =>
    [...m].map(([path, bytes]) => ({ path, file: new Blob([new Uint8Array(bytes)]) })),
  ),
});

function setup(outcome: ImportOutcome = { status: 'done' }) {
  const importScenes = vi.fn(async () => outcome);
  const onDone = vi.fn();
  const hook = renderHook(() => useMsWhiteboardImport({ importScenes, onDone }));
  return { hook, importScenes, onDone };
}

// docs/specs/020-import-export/whiteboard-import.md "Importing in the dialog".
describe('useMsWhiteboardImport', () => {
  it('imports a single board straight away and counts it', async () => {
    vi.mocked(track).mockClear();
    const { hook, importScenes, onDone } = setup();
    await act(() =>
      hook.result.current.open(asFiles(boardFiles({ title: 'One', elements: [ink()] }, 'b'))),
    );
    expect(importScenes).toHaveBeenCalledTimes(1);
    expect(
      (importScenes.mock.calls[0] as unknown as [{ title: string }[]])[0].map((s) => s.title),
    ).toEqual(['One']);
    expect(onDone).toHaveBeenCalledWith({ status: 'done' });
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'MicrosoftWhiteboard');
  });

  it('lists several boards all checked, and imports only the checked ones', async () => {
    const { hook, importScenes } = setup();
    await act(() =>
      hook.result.current.open(
        asFiles(
          boardFiles({ title: 'A', modified: '2026-01-01T00:00:00Z' }, 'x/a'),
          boardFiles({ title: 'B', modified: '2026-02-01T00:00:00Z' }, 'x/b'),
        ),
      ),
    );
    const state = hook.result.current.state;
    if (state.step !== 'list') throw new Error(state.step);
    expect(state.boards.map((b) => b.title)).toEqual(['B', 'A']);
    expect(state.checked.size).toBe(2);
    act(() => hook.result.current.toggle('x/b'));
    await act(() => hook.result.current.importChecked());
    expect(
      (importScenes.mock.calls[0] as unknown as [{ title: string }[]])[0].map((s) => s.title),
    ).toEqual(['A']);
  });

  it('toggles all off and on', async () => {
    const { hook } = setup();
    await act(() => hook.result.current.open(asFiles(boardFiles({}, 'a'), boardFiles({}, 'b'))));
    act(() => hook.result.current.toggleAll());
    expect(
      hook.result.current.state.step === 'list' && hook.result.current.state.checked.size,
    ).toBe(0);
    act(() => hook.result.current.toggleAll());
    expect(
      hook.result.current.state.step === 'list' && hook.result.current.state.checked.size,
    ).toBe(2);
  });

  it('reads a .zip', async () => {
    const { hook, importScenes } = setup();
    const zip = writeZip(
      [...boardFiles({ title: 'Z' }, 'b')].map(([name, data]) => ({ name, data })),
    );
    await act(() => hook.result.current.open({ kind: 'zip', file: new File([zip], 'boards.zip') }));
    expect(importScenes).toHaveBeenCalledTimes(1);
  });

  it('says what went wrong with the pick, and stays on the pick step', async () => {
    const { hook } = setup();
    await act(() =>
      hook.result.current.open({ kind: 'zip', file: new File([new Uint8Array(40)], 'x.zip') }),
    );
    expect(hook.result.current.state).toEqual({ step: 'pick', error: READ_ERRORS['zip-damaged'] });
    await act(() => hook.result.current.open(asFiles(new Map([['notes.txt', new Uint8Array()]]))));
    expect(hook.result.current.state).toMatchObject({
      step: 'pick',
      error: expect.stringContaining('No Microsoft Whiteboard boards'),
    });
  });

  it('passes the commit error back, and joins unreadable boards into the result', async () => {
    const failed = setup({ status: 'error', error: 'Too big' });
    await act(() => failed.hook.result.current.open(asFiles(boardFiles({}, 'b'))));
    expect(failed.hook.result.current.state).toEqual({ step: 'pick', error: 'Too big' });

    const ok = setup({ status: 'done', failures: [{ title: 'Big', message: 'm' }] });
    const broken = boardFiles({}, 'broken');
    broken.set('broken/changes.json', new TextEncoder().encode('{'));
    await act(() =>
      ok.hook.result.current.open(asFiles(broken, boardFiles({ title: 'Big' }, 'b'))),
    );
    await act(() => ok.hook.result.current.importChecked());
    await waitFor(() => expect(ok.onDone).toHaveBeenCalled());
    expect(ok.onDone.mock.calls[0]![0].failures.map((f: { title: string }) => f.title)).toEqual([
      'broken',
      'Big',
    ]);
  });

  it('never leaves the panel stuck when something throws', async () => {
    const { hook } = setup();
    const file = new File([], 'x.zip');
    file.arrayBuffer = () => Promise.reject(new Error('gone'));
    await act(() => hook.result.current.open({ kind: 'zip', file }));
    expect(hook.result.current.state).toEqual({ step: 'pick', error: UNEXPECTED });
  });
});
