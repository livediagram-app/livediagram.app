// @vitest-environment jsdom

// The Import dialog: a clean import closes, an import that left something out
// shows the report.

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
      onClose={onClose}
    />,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  return { onClose, onImportText };
}

describe('ImportTabDialog', () => {
  it('opens straight at the paste panel and passes the pasted JSON on', async () => {
    const { onImportText, onClose } = open({ status: 'done' });
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('{}');
  });

  it("reports a JSON import's refused Plan cards (docs/specs/026-plan/items.md)", async () => {
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
