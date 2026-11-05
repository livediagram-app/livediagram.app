// @vitest-environment jsdom

// Import to Tab: a livehuddle tab's JSON is the one format (backup and restore); imports from other tools are gone
// (docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools").

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportOutcome } from '@/lib/import-tab';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function open(outcome: ImportOutcome = { status: 'done' }) {
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
  return { onClose, onImportText };
}

describe('ImportTabDialog', () => {
  it('opens straight at the JSON panel, with no format list and no other tool', () => {
    open();
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'JSON to import' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
    for (const gone of [/Excalidraw/, /Markdown/, /Mermaid/, /draw\.io/]) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
  });

  it('passes the pasted JSON on and closes on a clean import', async () => {
    const { onImportText, onClose } = open();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('json', '{}', expect.any(Function));
  });

  it('names Undo’s keys only on a fine pointer', () => {
    open();
    const keys = screen.getByText(/⌘Z/);
    expect(keys.className).toContain('pointer-coarse:hidden');
    expect(keys.parentElement!.textContent).toMatch(/Undo \(⌘Z \/ Ctrl.Z\) brings it back\./);
  });

  it('announces an error for a screen reader', async () => {
    open({ status: 'error', error: 'No nodes found.' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No nodes found.');
  });
});
