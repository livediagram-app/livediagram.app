import { describe, expect, it } from 'vitest';
import type { BoxedElement } from './index';
import { elementDisplayLabel } from './element-display-label';

// Shared by the Collaborate Panel and the api's collaboration index
// (docs/specs/013-workspace/activity-page.md §2.1), so a change here changes what BOTH surfaces call a row.

const shape = (label: string | undefined): BoxedElement =>
  ({ id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as never;

const table = (cells: string[][]): BoxedElement =>
  ({ id: 't', type: 'table', x: 0, y: 0, width: 10, height: 10, cells }) as never;

describe('elementDisplayLabel', () => {
  it('uses the trimmed label', () => {
    expect(elementDisplayLabel(shape('  Retry budget '))).toBe('Retry budget');
  });

  it('falls back to Untitled for a blank or missing label', () => {
    expect(elementDisplayLabel(shape('   '))).toBe('Untitled');
    expect(elementDisplayLabel(shape(undefined))).toBe('Untitled');
  });

  it('names a table by its first non-empty cell', () => {
    expect(
      elementDisplayLabel(
        table([
          ['', ' '],
          ['', 'Owner'],
        ]),
      ),
    ).toBe('Table: Owner');
  });

  it('names an empty table plainly', () => {
    expect(elementDisplayLabel(table([['', '']]))).toBe('Table');
  });
});
