// @vitest-environment jsdom

// The Word and PowerPoint file panel (docs/specs/020-import-export/office-import.md "How it's triggered"): a drop area
// and Choose a File, the stage while it runs, the error when it fails, and the panel ready again after.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import type { FileImportStage } from '@/hooks/persistence/useTabImport';
import { FileImportPanel, stageLine } from './FileImportPanel';

const docx = () => new File(['x'], 'notes.docx');

function drop(file: File) {
  fireEvent.drop(screen.getByTestId('file-import-drop'), { dataTransfer: { files: [file] } });
}

describe('stageLine', () => {
  it('names what is being read, then counts the images', () => {
    expect(stageLine('word', null)).toBe('Reading the document…');
    expect(stageLine('powerpoint', { stage: 'reading' })).toBe('Reading the deck…');
    expect(stageLine('word', { stage: 'images', done: 2, total: 12 })).toBe(
      'Saving images (3 of 12)…',
    );
    expect(stageLine('word', { stage: 'images', done: 12, total: 12 })).toBe(
      'Saving images (12 of 12)…',
    );
    expect(stageLine('word', { stage: 'images', done: 0, total: 0 })).toBe('Reading the document…');
  });
});

describe('FileImportPanel', () => {
  it('imports a dropped file, showing the stage and disabling every control meanwhile', async () => {
    let finish!: (o: ImportOutcome) => void;
    let report!: (s: FileImportStage) => void;
    const onImportFile = vi.fn(
      (_file: File, onStage: (s: FileImportStage) => void) =>
        new Promise<ImportOutcome>((resolve) => {
          finish = resolve;
          report = onStage;
        }),
    );
    const onDone = vi.fn();
    const onBack = vi.fn();
    render(
      <FileImportPanel format="word" onImportFile={onImportFile} onDone={onDone} onBack={onBack} />,
    );
    const file = docx();
    drop(file);
    expect(onImportFile).toHaveBeenCalledWith(file, expect.any(Function));
    expect(screen.getByText('Reading the document…')).toBeTruthy();
    expect(screen.getByText('This can take a moment for a large file.')).toBeTruthy();
    // Busy, not disabled: a keyboard press keeps focus on it (busy-buttons.md).
    expect(screen.getByRole('button', { name: 'Choose a File' }).getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /All formats/ }).hasAttribute('disabled')).toBe(true);
    // A second drop while busy is ignored.
    drop(docx());
    expect(onImportFile).toHaveBeenCalledOnce();
    act(() => report({ stage: 'images', done: 0, total: 4 }));
    expect(screen.getByText('Saving images (1 of 4)…')).toBeTruthy();
    await act(async () => finish({ status: 'done' }));
    expect(onDone).toHaveBeenCalledWith({ status: 'done' });
  });

  it('shows an error under the drop area and is ready for another file', async () => {
    const onImportFile = vi
      .fn<(file: File, onStage: (s: FileImportStage) => void) => Promise<ImportOutcome>>()
      .mockResolvedValueOnce({
        status: 'error',
        error: 'This is a PowerPoint file. Go back and choose PowerPoint to import it.',
      })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ status: 'cancelled' });
    const onDone = vi.fn();
    render(<FileImportPanel format="word" onImportFile={onImportFile} onDone={onDone} />);
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
    drop(docx());
    expect((await screen.findByRole('alert')).textContent).toContain('This is a PowerPoint file');
    expect(screen.getByText('Drop a Word document here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a File' }).hasAttribute('aria-busy')).toBe(
      false,
    );
    drop(docx());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain("Couldn't import that"),
    );
    drop(docx());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('lights the drop area while a file is dragged over it', () => {
    render(<FileImportPanel format="powerpoint" onImportFile={vi.fn()} onDone={vi.fn()} />);
    const area = screen.getByTestId('file-import-drop');
    fireEvent.dragOver(area);
    expect(area.getAttribute('data-over')).toBe('true');
    expect(area.className).toContain('border-brand-400');
    // Into one of its own children: still lit (jsdom's drag events carry no relatedTarget, so a mouse event's does).
    const into = new MouseEvent('dragleave', {
      bubbles: true,
      relatedTarget: screen.getByRole('button', { name: 'Choose a File' }),
    });
    fireEvent(area, into);
    expect(area.getAttribute('data-over')).toBe('true');
    fireEvent.dragLeave(area);
    expect(area.getAttribute('data-over')).toBeNull();
  });

  it('opens the picker from Choose a File and imports what is chosen', async () => {
    const onImportFile = vi.fn(async (): Promise<ImportOutcome> => ({ status: 'done' }));
    render(
      <FileImportPanel
        format="powerpoint"
        onImportFile={onImportFile}
        onDone={vi.fn()}
        note={<a href="#help">Help</a>}
      />,
    );
    const input = screen.getByTestId('file-import-input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a File' }));
    expect(click).toHaveBeenCalledOnce();
    expect(input.accept).toContain('.pptx');
    expect(screen.getByText(/From Google Slides/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' })).toBeTruthy();
    // Cancelling the picker (no file) starts nothing.
    fireEvent.change(input, { target: { files: [] } });
    expect(onImportFile).not.toHaveBeenCalled();
    const file = new File(['x'], 'deck.pptx');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onImportFile).toHaveBeenCalledWith(file, expect.any(Function)));
  });
});
