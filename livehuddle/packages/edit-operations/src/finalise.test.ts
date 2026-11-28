import { describe, expect, it } from 'vitest';
import { applyEditOperations } from './apply';
import { validateEditOperations } from './parse-json';

// docs/specs/002-project-scope/not-in-livehuddle.md "The Write category": a text or a sticky note is refused, made by
// `add` or sent whole.
describe('retired texts and sticky notes', () => {
  const run = (operations: unknown[]) => {
    const parsed = validateEditOperations(operations);
    if ('errors' in parsed) throw new Error('bad operations');
    return applyEditOperations({ id: 't', name: 'T', elements: [] }, parsed.operations, {});
  };

  it('refuses add text, add sticky and a raw note', () => {
    for (const operations of [
      [{ op: 'add', kind: 'text' }],
      [{ op: 'add', kind: 'sticky' }],
      [{ op: 'add', element: { id: 'n', type: 'sticky', x: 0, y: 0, width: 10, height: 10 } }],
    ]) {
      const out = run(operations);
      expect('errors' in out && out.errors[0]!.details[0]).toContain(
        'text and sticky notes are no longer supported in livehuddle',
      );
    }
  });
});
