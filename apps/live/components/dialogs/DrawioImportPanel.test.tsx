// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImportDrawioDocuments } from '@/hooks/persistence/useDrawioFileImport';
import { DrawioImportPanel, filesOfPick } from './DrawioImportPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

// docs/specs/020-import-export/drawio-import.md "Import as new documents" (the list, the report).

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const model =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
const diagram = (name: string) =>
  new File(
    [
      `<mxfile modified="2026-03-12T10:00:00.000Z"><diagram name="P1">${compress(model)}</diagram></mxfile>`,
    ],
    name,
  );

describe('DrawioImportPanel', () => {
  it('lists the picked files in a labelled group and imports the ticked ones', async () => {
    const importDocuments = vi.fn<ImportDrawioDocuments>(async (files) => ({
      status: 'done',
      documents: files.map((f, i) => ({ id: `d${i}`, name: f.name })),
    }));
    const onClose = vi.fn();
    render(
      <DrawioImportPanel
        importDocuments={importDocuments}
        importLibraries={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByTestId('drawio-file-input'), {
      target: { files: [diagram('Roadmap'), diagram('Network.drawio'), new File(['x'], 'a.txt')] },
    });
    await screen.findByRole('group', { name: 'Files to import' });
    expect(screen.getAllByText('Edited 12 Mar 2026 · 1 page')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toBe(
      '1 file will be left out; the report says why.',
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Network/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 file' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(importDocuments.mock.calls[0]![0].map((f) => f.name)).toEqual(['Roadmap']);
  });

  it('says why when nothing picked is draw.io', async () => {
    render(
      <DrawioImportPanel importDocuments={vi.fn()} importLibraries={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId('drawio-file-input'), {
      target: { files: [new File(['x'], 'a.txt')] },
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      "This file isn't a draw.io diagram or library.",
    );
  });
});

describe('filesOfPick', () => {
  it('names a folder pick by each file path, keeping files as they are', () => {
    const file = new File(['x'], 'kept.drawio');
    const files = filesOfPick({
      kind: 'files',
      files: [
        { path: 'designs/sub/plain', file: new Blob(['y']) },
        { path: 'designs/kept.drawio', file },
      ],
    });
    expect(files.map((f) => f.name)).toEqual(['plain', 'kept.drawio']);
    expect(files[1]).toBe(file);
    expect(filesOfPick(null)).toEqual([]);
  });
});
