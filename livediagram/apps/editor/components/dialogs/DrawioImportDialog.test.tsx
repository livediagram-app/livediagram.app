// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImportDrawioDocuments } from '@/hooks/persistence/useDrawioFileImport';
import { DrawioImportDialog } from './DrawioImportDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

// docs/specs/020-import-export/drawio-import.md "Import as new documents": the dialog's help card follows hover and
// focus only, so it never stays over the report.

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const model =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>';
const file = new File(
  [`<mxfile><diagram name="P1">${compress(model)}</diagram></mxfile>`],
  'Roadmap.drawio',
);

describe('DrawioImportDialog help card', () => {
  beforeAll(async () => {
    await import('@/lib/drawio/files');
  });

  it('is gone on the done step', async () => {
    const importDocuments = vi.fn<ImportDrawioDocuments>(async (files) => ({
      status: 'done',
      documents: files.map((f, i) => ({ id: `d${i}`, name: f.name })),
    }));
    render(
      <DrawioImportDialog
        importDocuments={importDocuments}
        importLibraries={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // A page opened straight on the import puts keyboard focus on the dialog's first control, the help link.
    act(() => screen.getByRole('link', { name: 'Learn about draw.io import' }).focus());
    await waitFor(() => expect(document.querySelector('[data-hint]')).not.toBeNull());
    expect(document.querySelector('[data-hint]')).not.toBeNull();
    fireEvent.change(screen.getByTestId('drawio-file-input'), { target: { files: [file] } });
    await screen.findByTestId('import-image-report');
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Done'));
    await waitFor(() => expect(document.querySelector('[data-hint]')).toBeNull(), {
      timeout: 2000,
    });
  });
});
