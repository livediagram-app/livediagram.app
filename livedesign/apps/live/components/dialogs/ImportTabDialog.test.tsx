// @vitest-environment jsdom

// The Import dialog's routing: a clean import closes, an import that left something
// out shows the report (docs/specs/020-import-export/README.md). JSON replaces the tab; SVG adds shapes to the page
// (docs/specs/020-import-export/svg-import.md), so its panel carries a note rather than the warning.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const JSON_TEXT = '{"schemaVersion":1}';

// Picks a format from the grid.
const pick = (title: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));

function open(outcome: ImportOutcome) {
  const onClose = vi.fn();
  const onImportText = vi.fn(async () => outcome);
  render(
    <ImportTabDialog
      tabName="Board"
      onImportFile={vi.fn(async () => outcome)}
      onImportText={onImportText}
      onClose={onClose}
    />,
  );
  pick('JSON');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON_TEXT } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  return { onClose, onImportText };
}

describe('ImportTabDialog', () => {
  it('opens at the format grid, JSON and SVG, and a single offered format straight at its panel', () => {
    render(
      <ImportTabDialog
        tabName="Poster"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Pick a format to import into the current tab.')).toBeTruthy();
    pick('SVG');
    expect(screen.getByText('Paste your SVG, or import a file.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /All formats/ })).toBeTruthy();
  });

  it('opens straight at JSON when it is the one format offered, with no way back to a list', () => {
    render(
      <ImportTabDialog
        tabName="Poster"
        formats={['json']}
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
  });

  it('passes pasted SVG on as SVG, under a note that it adds to the page instead of the warning', async () => {
    const onImportText = vi.fn(async (): Promise<ImportOutcome> => ({ status: 'done' }));
    const onImportFile = vi.fn(async (): Promise<ImportOutcome> => ({ status: 'cancelled' }));
    render(
      <ImportTabDialog
        tabName="Logo"
        onImportFile={onImportFile}
        onImportText={onImportText}
        onClose={vi.fn()}
      />,
    );
    pick('SVG');
    expect(screen.getByTestId('import-adds-note').textContent).toBe(
      'The shapes land on the page you are on, fitted to it.',
    );
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'SVG to import' }), {
      target: { value: '<svg/>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onImportText).toHaveBeenCalledWith('svg', '<svg/>'));
  });

  it('passes the pasted JSON on and closes on a clean import', async () => {
    const { onImportText, onClose } = open({ status: 'done' });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('json', JSON_TEXT);
  });

  it('shows the report instead of closing when part of the import was left out', async () => {
    const { onClose } = open({
      status: 'done',
      failures: [{ title: 'Plan Cards', message: "2 cards couldn't be added to this design." }],
    });
    expect((await screen.findByTestId('import-report')).textContent).toContain(
      "2 cards couldn't be added",
    );
    expect(screen.getByText("Here's how your import came across.")).toBeTruthy();
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // The warning's keys only for a keyboard.
  it('names Undo’s keys only on a fine pointer', () => {
    render(
      <ImportTabDialog
        tabName="Board"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const keys = screen.getByText(/⌘Z/);
    expect(keys.className).toContain('pointer-coarse:hidden');
    expect(keys.parentElement!.textContent).toMatch(/Undo \(⌘Z \/ Ctrl.Z\) brings it back\./);
  });
});

// A screen reader hears what the paste field is for, and why an import did not land.
describe('ImportTabDialog for a screen reader', () => {
  it('names the paste field for its format and announces an error', async () => {
    open({ status: 'error', error: 'Not a livedesign tab.' });
    expect(screen.getByRole('textbox', { name: 'JSON to import' })).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toBe('Not a livedesign tab.');
  });
});
