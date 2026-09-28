// @vitest-environment jsdom

// The one end-of-import view every importer shares
// (docs/specs/020-import-export/drawio-import.md "The import report" +
// docs/specs/020-import-export/import-image-pipeline.md "The report"): what
// arrived, how its images came across, what changed on the way in, and Done.

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportReport } from '@/lib/import-report';
import { ImportSummary } from './ImportSummary';

const drawio: ImportReport = {
  source: 'drawio',
  pages: 3,
  elements: 128,
  notes: [
    {
      kind: 'shape-unmatched',
      count: 3,
      names: [
        { name: 'router', count: 2 },
        { name: 'hub', count: 1 },
      ],
    },
    { kind: 'label-moved', count: 1 },
  ],
  images: { imported: 2, deduped: 0, placeholders: { 'gallery-full': 1 } },
};

describe('ImportSummary', () => {
  it('announces the result: what arrived, the images, then what changed', () => {
    render(<ImportSummary report={drawio} onDone={() => {}} />);
    const summary = screen.getByTestId('import-report');
    expect(summary.getAttribute('role')).toBe('status');
    expect(within(summary).getByRole('heading', { name: 'Import complete' })).toBeTruthy();
    expect(summary.textContent).toContain('3 pages became 3 tabs, 128 elements.');
    const images = within(summary).getByTestId('import-report-images');
    expect(images.textContent).toContain('2 images imported');
    expect(images.textContent).toContain('1 left as a placeholder');
    expect(images.querySelector('[data-failure="gallery-full"]')?.textContent).toContain(
      'Your image gallery is full.',
    );
    expect(images.textContent).toContain('Double-click a placeholder to add its image.');
    const notes = within(summary).getByTestId('import-report-notes').querySelectorAll('li');
    expect([...notes].map((li) => li.textContent)).toEqual([
      '3 shapes had no livediagram match and came in as labelled boxes.router ×2, hub',
      '1 label was moved inside its shape or merged onto one line.',
    ]);
  });

  it('shows only the images for an import that met images and changed nothing else', () => {
    render(
      <ImportSummary
        report={{
          source: 'excalidraw',
          pages: 1,
          elements: 4,
          notes: [],
          images: { imported: 3, deduped: 1, placeholders: {} },
        }}
        onDone={() => {}}
      />,
    );
    expect(screen.getByTestId('import-report-images').textContent).toContain('3 images imported');
    expect(screen.queryByTestId('import-report-notes')).toBeNull();
  });

  it('focuses Done, which closes', () => {
    const onDone = vi.fn();
    render(<ImportSummary report={drawio} onDone={onDone} />);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(document.activeElement).toBe(done);
    fireEvent.click(done);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
