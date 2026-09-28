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
      report: {
        source: 'drawio',
        pages: 1,
        elements: 4,
        notes: [{ kind: 'label-moved', count: 2 }],
      },
    });
    await screen.findByTestId('import-report');
    expect(screen.getByText('Here is what changed on the way in.')).toBeTruthy();
    expect(screen.queryByText(/This replaces everything/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows the same report for an import that only met images', async () => {
    open({
      status: 'done',
      report: {
        source: 'excalidraw',
        pages: 1,
        elements: 2,
        notes: [],
        images: { imported: 2, deduped: 0, placeholders: {} },
      },
    });
    expect((await screen.findByTestId('import-report-images')).textContent).toContain(
      '2 images imported',
    );
    expect(screen.getByText("Here's how your images came across.")).toBeTruthy();
  });
});
