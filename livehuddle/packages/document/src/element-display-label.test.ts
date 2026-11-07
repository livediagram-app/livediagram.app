import { describe, expect, it } from 'vitest';
import type { BoxedElement } from './index';
import { elementDisplayLabel } from './element-display-label';

// Shared by the Collaborate Panel and the api's collaboration index
// (docs/specs/013-workspace/inbox.md §2.1), so a change here changes what BOTH surfaces call a row.

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

  it('names a stored table Table, as its placeholder does, whatever its cells hold', () => {
    expect(
      elementDisplayLabel(
        table([
          ['', ' '],
          ['', 'Owner'],
        ]),
      ),
    ).toBe('Table');
    expect(elementDisplayLabel(table([['', '']]))).toBe('Table');
  });
});

describe('an unlabelled retired element (docs/specs/002-project-scope/not-in-livehuddle.md)', () => {
  const retired = (kind: string, label = ''): BoxedElement =>
    ({ ...shape(label), shape: kind }) as never;

  it('is named by what it was, not "Untitled"', () => {
    expect(elementDisplayLabel(retired('action-card'))).toBe('Action Panel');
    expect(elementDisplayLabel(retired('comment-pin'))).toBe('Comment Panel');
    expect(elementDisplayLabel(retired('never-a-kind'))).toBe('Unknown Element');
  });

  it('keeps its stored label when it has one', () => {
    expect(elementDisplayLabel(retired('action-card', 'Follow-ups'))).toBe('Follow-ups');
  });
});
