// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawioDocumentFile } from '@/lib/drawio/new-document';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import {
  DRAWIO_UNEXPECTED,
  useDrawioFileImport,
  type ImportDrawioDocuments,
} from './useDrawioFileImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

// docs/specs/020-import-export/drawio-import.md "Import as new documents": picked files and folders
// become documents, listed first when there is more than one, then the shared report.

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const model =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
const diagram = (name: string, pages = 1) =>
  new File(
    [
      `<mxfile modified="2026-03-12T10:00:00.000Z">${Array.from({ length: pages }, (_, i) => `<diagram name="P${i + 1}">${compress(model)}</diagram>`).join('')}</mxfile>`,
    ],
    name,
  );
const library = (name: string) =>
  new File(
    [
      `<mxlibrary>${JSON.stringify([{ xml: compress(model), w: 80, h: 40, title: 'A' }])}</mxlibrary>`,
    ],
    name,
  );
const text = (name: string) => new File(['hello'], name);

const landedAll: ImportDrawioDocuments = async (files) => ({
  status: 'done',
  documents: files.map((f, i) => ({ id: `d${i}`, name: f.name })),
});

function setup(importDocuments: ImportDrawioDocuments = landedAll) {
  const onDone = vi.fn();
  const spy = vi.fn<ImportDrawioDocuments>(importDocuments);
  const { result } = renderHook(() => useDrawioFileImport({ importDocuments: spy, onDone }));
  return { result, onDone, importDocuments: spy };
}
const names = (files: DrawioDocumentFile[]) => files.map((f) => f.name);

afterEach(() => vi.clearAllMocks());

describe('useDrawioFileImport', () => {
  it('imports a single readable file straight away, one Drawio import counted', async () => {
    const h = setup();
    await act(() => h.result.current.open([diagram('Roadmap')]));
    expect(names(h.importDocuments.mock.calls[0]![0])).toEqual(['Roadmap']);
    expect(h.onDone).toHaveBeenCalledWith({
      status: 'done',
      documents: [{ id: 'd0', name: 'Roadmap' }],
    });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Drawio');
  });

  it('lists what it found, all ticked, and imports only the ticked diagrams', async () => {
    const h = setup();
    await act(() =>
      h.result.current.open([diagram('Roadmap', 3), text('notes.txt'), diagram('Network.drawio')]),
    );
    const state = h.result.current.state;
    if (state.step !== 'list') throw new Error(state.step);
    expect(state.rows.map((r) => [r.name, r.detail])).toEqual([
      ['Roadmap', 'Edited 12 Mar 2026 · 3 pages'],
      ['Network', 'Edited 12 Mar 2026 · 1 page'],
    ]);
    expect(state.checked.size).toBe(2);
    expect(state.failures).toEqual([
      { title: 'notes.txt', message: "This file isn't a draw.io diagram or library." },
    ]);
    act(() => h.result.current.toggle(state.rows[0]!.key));
    await act(() => h.result.current.importChecked());
    expect(names(h.importDocuments.mock.calls[0]![0])).toEqual(['Network']);
    expect(h.onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        failures: [
          { title: 'notes.txt', message: "This file isn't a draw.io diagram or library." },
        ],
      }),
    );
  });

  it('lists a library with its shape count, and leaves it out while libraries cannot land', async () => {
    const h = setup();
    await act(() => h.result.current.open([diagram('Roadmap'), library('Team icons.xml')]));
    const state = h.result.current.state;
    if (state.step !== 'list') throw new Error(state.step);
    expect(state.rows.map((r) => [r.name, r.detail])).toEqual([
      ['Roadmap', 'Edited 12 Mar 2026 · 1 page'],
      ['Team icons', 'Shape library · 1 shape'],
    ]);
    await act(() => h.result.current.importChecked());
    expect(h.onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        failures: [{ title: 'Team icons', message: "Shape libraries can't be imported here yet." }],
      }),
    );
  });

  it('goes back to picking with the reason when nothing can be read', async () => {
    const h = setup();
    await act(() => h.result.current.open([text('a.txt'), text('b.txt')]));
    expect(h.result.current.state).toEqual({
      step: 'pick',
      error: "This file isn't a draw.io diagram or library.",
    });
    expect(h.importDocuments).not.toHaveBeenCalled();
  });

  it('shows the commit refusing, and anything unexpected, as an error to pick again from', async () => {
    const refused = setup(async (): Promise<ImportOutcome> => ({
      status: 'error',
      error: 'Offline',
    }));
    await act(() => refused.result.current.open([diagram('Roadmap')]));
    expect(refused.result.current.state).toEqual({ step: 'pick', error: 'Offline' });
    const thrown = setup(async () => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
    await act(() => thrown.result.current.open([diagram('Roadmap')]));
    expect(thrown.result.current.state).toEqual({ step: 'pick', error: DRAWIO_UNEXPECTED });
  });

  it('counts one Drawio import per document made, none for one that failed', async () => {
    const h = setup(async (files) => ({
      status: 'done',
      documents: [{ id: 'd0', name: files[0]!.name }],
      failures: [{ title: files[1]!.name, message: 'This board is too big for one document' }],
    }));
    await act(() => h.result.current.open([diagram('A'), diagram('B')]));
    await act(() => h.result.current.importChecked());
    expect(track).toHaveBeenCalledTimes(1);
    expect(h.onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        failures: [{ title: 'B', message: 'This board is too big for one document' }],
      }),
    );
  });
});
