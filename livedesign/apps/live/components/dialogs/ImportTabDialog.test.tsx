// @vitest-environment jsdom

// The Import dialog's routing: a clean import closes, an import that left something
// out shows the report (docs/specs/020-import-export/README.md).

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const JSON_TEXT = '{"schemaVersion":1}';

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
  fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON_TEXT } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  return { onClose, onImportText };
}

describe('ImportTabDialog', () => {
  it('opens straight at JSON, its one format, with no way back to a list', () => {
    render(
      <ImportTabDialog
        tabName="Poster"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
  });

  it('passes the pasted JSON on and closes on a clean import', async () => {
    const { onImportText, onClose } = open({ status: 'done' });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('json', JSON_TEXT);
  });

  it('shows the report instead of closing when part of the import was left out (docs/specs/026-plan/items.md)', async () => {
    const { onClose } = open({
      status: 'done',
      failures: [{ title: 'Plan Cards', message: "2 cards couldn't be added to this document." }],
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
