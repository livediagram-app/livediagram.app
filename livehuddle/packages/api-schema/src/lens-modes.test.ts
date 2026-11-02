import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livehuddle/document';
import { LENS_MODES } from './lens-modes';

describe('LENS_MODES', () => {
  it('names every editor mode, in the interface’s order, as the outbox reports it', () => {
    expect(LENS_MODES).toEqual([
      { value: 'diagram', label: 'Diagram' },
      { value: 'draw', label: 'Draw' },
      { value: 'workshop', label: 'Workshop' },
    ]);
    expect(LENS_MODES.map((m) => m.value)).toEqual(EDITOR_MODES);
  });
});
