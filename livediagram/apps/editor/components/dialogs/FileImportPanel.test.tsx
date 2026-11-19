// @vitest-environment jsdom

// The Import dialog's Visio card and its file-only panel (docs/specs/020-import-export/visio-import.md "UI"): no
// paste box, a drop target that picks or takes one dropped file, the Lucidchart line, errors and the report.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function openVisio(onImportFile: (...args: unknown[]) => Promise<ImportOutcome>) {
  const onClose = vi.fn();
  render(
    <ImportTabDialog
      tabName="Board"
      onImportFile={onImportFile}
      onImportText={vi.fn()}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Visio/ }));
  return { onClose };
}

const dropZone = () =>
  screen.getByRole('button', { name: 'Drop a .vsdx file here, or choose one' });
const drop = (files: File[]) => fireEvent.drop(dropZone(), { dataTransfer: { files } });

describe('ImportTabDialog, Visio', () => {
  it('opens a file panel with no paste box, the Lucidchart line and its help link', () => {
    openVisio(vi.fn());
    expect(screen.getByText('Import your Visio file.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/From Lucidchart: File, Export, Visio \(VSDX\)/)).toBeTruthy();
    expect(screen.getByText('See what carries over from Visio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All Formats/ }));
    expect(screen.getByRole('button', { name: /Visio/ })).toBeTruthy();
  });

  it('Choose a File and the drop target open the picker; a clean import closes', async () => {
    const onImportFile = vi.fn(async (): Promise<ImportOutcome> => ({ status: 'done' }));
    const { onClose } = openVisio(onImportFile);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a File' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportFile).toHaveBeenCalledWith('visio', expect.any(Function), undefined);
  });

  it('imports one dropped file, refuses several, and ignores an empty drop', async () => {
    const onImportFile = vi.fn(async (): Promise<ImportOutcome> => ({ status: 'cancelled' }));
    openVisio(onImportFile);
    drop([]);
    expect(screen.queryByRole('alert')).toBeNull();
    const a = new File(['a'], 'a.vsdx');
    drop([a, new File(['b'], 'b.vsdx')]);
    expect(screen.getByRole('alert').textContent).toBe('Drop one file at a time.');
    expect(onImportFile).not.toHaveBeenCalled();
    drop([a]);
    await waitFor(() =>
      expect(onImportFile).toHaveBeenCalledWith('visio', expect.any(Function), a),
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('announces an error and a runner that throws, and stays open', async () => {
    const onImportFile = vi
      .fn<(...args: unknown[]) => Promise<ImportOutcome>>()
      .mockResolvedValueOnce({ status: 'error', error: 'This Visio file has no pages.' })
      .mockRejectedValueOnce(new Error('boom'));
    const { onClose } = openVisio(onImportFile);
    fireEvent.click(dropZone());
    expect((await screen.findByRole('alert')).textContent).toBe('This Visio file has no pages.');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a File' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        "Couldn't import that. Check the file and try again.",
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a second press while importing, counts images, then shows the report', async () => {
    let finish: (o: ImportOutcome) => void = () => {};
    const onImportFile = vi.fn(
      (_format: unknown, onProgress: unknown) =>
        new Promise<ImportOutcome>((resolve) => {
          (onProgress as (p: { done: number; total: number }) => void)({ done: 1, total: 3 });
          finish = resolve;
        }),
    );
    openVisio(onImportFile);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a File' }));
    expect(await screen.findByText('Importing images 1 of 3…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Importing…' }));
    drop([new File(['a'], 'a.vsdx')]);
    expect(onImportFile).toHaveBeenCalledOnce();
    finish({ status: 'done', images: { imported: 3, deduped: 0, placeholders: {} } });
    expect((await screen.findByTestId('import-image-report')).textContent).toContain(
      '3 images imported',
    );
  });

  it('opens straight at its panel when it is the one format offered', () => {
    render(
      <ImportTabDialog
        tabName="Board"
        formats={['visio']}
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(dropZone()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All Formats/ })).toBeNull();
  });
});
