// @vitest-environment jsdom

// The Import dialog's draw.io card and its routing: a clean import closes, an
// import with a report shows the summary (docs/specs/020-import-export/drawio-import.md "UI").

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
  fireEvent.click(screen.getByRole('button', { name: /draw\.io/ }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '<mxfile/>' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  return { onClose, onImportText };
}

describe('ImportTabDialog, draw.io', () => {
  it('offers draw.io and passes the pasted XML to it', async () => {
    const { onImportText, onClose } = open({ status: 'done' });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onImportText).toHaveBeenCalledWith('drawio', '<mxfile/>', expect.any(Function));
  });

  it('shows the summary instead of closing when the import reports changes', async () => {
    const { onClose } = open({
      status: 'done',
      scene: {
        landed: { shape: 4 },
        degraded: [
          { rule: 'Labels were moved inside their shapes or merged onto one line', count: 2 },
        ],
        skipped: [],
      },
    });
    await screen.findByTestId('import-image-report');
    expect(screen.getByText("Here's how your board came across.")).toBeTruthy();
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the same report for an import that only met images', async () => {
    open({
      status: 'done',
      images: { imported: 2, deduped: 0, placeholders: {} },
    });
    expect((await screen.findByTestId('import-image-report')).textContent).toContain(
      '2 images imported',
    );
    expect(screen.getByText("Here's how your images came across.")).toBeTruthy();
  });

  it("reports a JSON import's refused Plan cards (docs/specs/026-plan/items.md)", async () => {
    open({
      status: 'done',
      failures: [{ title: 'Plan Cards', message: "2 cards couldn't be added to this document." }],
    });
    expect((await screen.findByTestId('import-image-report')).textContent).toContain(
      "2 cards couldn't be added",
    );
    expect(screen.getByText("Here's how your import came across.")).toBeTruthy();
  });
});

describe('ImportTabDialog, offered formats', () => {
  const props = {
    tabName: 'Poster',
    onImportFile: vi.fn(),
    onImportText: vi.fn(),
    onClose: vi.fn(),
  };

  it('offers only the formats it is given', () => {
    render(<ImportTabDialog {...props} formats={['json', 'mermaid']} />);
    expect(screen.getByRole('button', { name: /JSON/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mermaid/ })).toBeTruthy();
    for (const other of [/Markdown/, /Excalidraw/, /draw\.io/]) {
      expect(screen.queryByRole('button', { name: other })).toBeNull();
    }
  });

  // Pages mode and a Dashboard tab (docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard").
  it('opens straight at the one format it offers, with no way back to a list', () => {
    render(<ImportTabDialog {...props} formats={['json']} />);
    expect(screen.getByText('Paste your JSON, or import a file.')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
  });
});

// docs/specs/020-import-export/markdown-import.md: two cards across on a phone; the warning's keys only for a keyboard.
describe('ImportTabDialog on a phone', () => {
  it('lays its formats out two across below sm and names Undo’s keys only on a fine pointer', () => {
    render(
      <ImportTabDialog
        tabName="Board"
        onImportFile={vi.fn()}
        onImportText={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const grid = screen.getByRole('button', { name: /draw\.io/ }).parentElement!;
    expect(grid.className).toContain('grid-cols-2');
    expect(grid.className).toContain('sm:grid-cols-3');
    const keys = screen.getByText(/⌘Z/);
    expect(keys.className).toContain('pointer-coarse:hidden');
    expect(keys.parentElement!.textContent).toMatch(/Undo \(⌘Z \/ Ctrl.Z\) brings it back\./);
  });
});
