// @vitest-environment jsdom

// The import summary (docs/specs/020-import-export/drawio-import.md "UI"):
// what arrived, one line per kind of degradation, and a Done button.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ImportReport } from '@/lib/import-report';
import { ImportSummary } from './ImportSummary';

const report: ImportReport = {
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
    { kind: 'image-placeholder', count: 1 },
  ],
};

describe('ImportSummary', () => {
  it('says what arrived and what changed on the way in', () => {
    render(<ImportSummary formatTitle="draw.io" report={report} onDone={() => {}} />);
    expect(screen.getByRole('region', { name: 'Imported from draw.io' })).toBeTruthy();
    expect(screen.getByText('3 pages became 3 tabs, 128 elements.')).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '3 shapes had no livediagram match and came in as labelled boxes.router ×2, hub',
      '1 image came in as a placeholder. Select one and upload the picture to fill it.',
    ]);
  });

  it('focuses Done, which closes', () => {
    const onDone = vi.fn();
    render(<ImportSummary formatTitle="draw.io" report={report} onDone={onDone} />);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(document.activeElement).toBe(done);
    fireEvent.click(done);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
