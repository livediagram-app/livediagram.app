// @vitest-environment jsdom

// The Import dialog's format cards and their routing: a clean import closes, an
// import that left something out shows the report (docs/specs/020-import-export/markdown-import.md).

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function open(outcome: ImportOutcome) {
  const onClose = vi.fn();
  const onImportText = vi.fn(async () => outcome);
  render(
    <ImportTabDialog
      tabName="Board"
      onImportFile={vi.fn(async () => outcome)}
      onImportText={onImportText}
      onImportFileFormat={vi.fn()}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Markdown/ }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Plan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  return { onClose, onImportText };
}

describe('ImportTabDialog, Markdown', () => {
  it('offers Markdown and passes the pasted outline to it', async () => {
    const { onImportText, onClose } = open({ status: 'done' });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('markdown', '# Plan');
  });

  it('shows the report instead of closing when part of the import was left out', async () => {
    const { onClose } = open({
      status: 'done',
      failures: [
        {
          title: 'Markdown',
          message:
            '500 headings, list items, lines and tables beyond the first 2,000 were left out.',
        },
      ],
    });
    expect((await screen.findByTestId('import-report')).textContent).toContain('500 headings');
    expect(screen.getByText("Here's how your import came across.")).toBeTruthy();
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("reports a JSON import's refused Plan cards", async () => {
    open({
      status: 'done',
      failures: [{ title: 'Plan Cards', message: "2 cards couldn't be added to this document." }],
    });
    expect((await screen.findByTestId('import-report')).textContent).toContain(
      "2 cards couldn't be added",
    );
  });
});

describe('ImportTabDialog, offered formats', () => {
  const props = {
    tabName: 'Poster',
    onImportFile: vi.fn(),
    onImportText: vi.fn(),
    onImportFileFormat: vi.fn(),
    onClose: vi.fn(),
  };

  it('offers JSON, Markdown, Word and PowerPoint', () => {
    render(<ImportTabDialog {...props} />);
    expect(screen.getByRole('button', { name: /JSON/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Markdown/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Word.*Google Docs/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /PowerPoint.*Google Slides/ })).toBeTruthy();
  });

  it('opens straight at the one format it offers, with no way back to a list', () => {
    render(<ImportTabDialog {...props} formats={['json']} />);
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
  });
});

// docs/specs/020-import-export/markdown-import.md: two cards across; the warning's keys only for a keyboard.
describe('ImportTabDialog on a phone', () => {
  it('lays its formats out two across and names Undo’s keys only on a fine pointer', () => {
    render(
      <ImportTabDialog
        tabName="Board"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onImportFileFormat={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const grid = screen.getByRole('button', { name: /Markdown/ }).parentElement!;
    expect(grid.className).toContain('grid-cols-2');
    const keys = screen.getByText(/⌘Z/);
    expect(keys.className).toContain('pointer-coarse:hidden');
    expect(keys.parentElement!.textContent).toMatch(/Undo \(⌘Z \/ Ctrl.Z\) brings it back\./);
  });
});

// docs/specs/020-import-export/office-import.md "How it's triggered": Word and PowerPoint open the file panel.
describe('ImportTabDialog, Word and PowerPoint', () => {
  function openFile(card: RegExp, outcome: ImportOutcome) {
    const onClose = vi.fn();
    const onImportFileFormat = vi.fn(async () => outcome);
    render(
      <ImportTabDialog
        tabName="Notes"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onImportFileFormat={onImportFileFormat}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: card }));
    return { onClose, onImportFileFormat };
  }

  it('opens the Word file panel, with no paste box, and imports a chosen file', async () => {
    const { onClose, onImportFileFormat } = openFile(/^Word/, { status: 'done' });
    expect(screen.getByText('Import a Word file.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Drop a Word document here')).toBeTruthy();
    expect(screen.getByText(/From Google Docs: File › Download › Microsoft Word/)).toBeTruthy();
    const file = new File(['x'], 'notes.docx');
    fireEvent.change(screen.getByTestId('file-import-input'), { target: { files: [file] } });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportFileFormat).toHaveBeenCalledWith('word', file, expect.any(Function));
  });

  it('shows the report after a PowerPoint import that left something out', async () => {
    const { onClose } = openFile(/^PowerPoint/, {
      status: 'done',
      failures: [{ title: 'Charts', message: '2 charts were left out.' }],
    });
    expect(screen.getByText('Drop a PowerPoint deck here')).toBeTruthy();
    fireEvent.change(screen.getByTestId('file-import-input'), {
      target: { files: [new File(['x'], 'deck.pptx')] },
    });
    expect((await screen.findByTestId('import-report')).textContent).toContain('2 charts');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes back to every format', () => {
    openFile(/^Word/, { status: 'done' });
    fireEvent.click(screen.getByRole('button', { name: /All formats/ }));
    expect(screen.getByRole('button', { name: /PowerPoint/ })).toBeTruthy();
  });
});
