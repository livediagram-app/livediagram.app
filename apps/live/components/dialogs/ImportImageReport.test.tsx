// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportImageReport } from './ImportImageReport';

// docs/specs/020-import-export/board-scene.md "The report", board-import.md "new-document": what an
// import brought, the documents it made, the boards it could not.
afterEach(cleanup);

describe('ImportImageReport', () => {
  it('lists what landed, every rule, the new documents and the boards that failed', () => {
    render(
      <ImportImageReport
        scene={{
          landed: { ink: 3, sticky: 1 },
          degraded: [{ rule: 'Multicolour ink drawn in one colour', count: 2 }],
          skipped: [],
        }}
        documents={[
          { id: 'd1', name: 'Retro' },
          { id: 'd2', name: 'Whiteboard, 14 Aug 2020' },
        ]}
        failures={[{ title: 'Huge', message: 'Too big.' }]}
        onDone={vi.fn()}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('3 pen strokes, 1 sticky note');
    expect(status.textContent).toContain('2 · Multicolour ink drawn in one colour');
    expect(status.textContent).toContain('2 new documents:');
    const links = within(screen.getByTestId('import-documents')).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Retro', '/document/d1'],
      ['Whiteboard, 14 Aug 2020', '/document/d2'],
    ]);
    expect(status.textContent).toContain('Huge · Too big.');
  });
});
