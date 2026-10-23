import { describe, expect, it } from 'vitest';
import { compileSeededTabs } from './document-seed';

describe('compileSeededTabs', () => {
  it('makes one tab per seeded template, under the name given', () => {
    const compiled = compileSeededTabs(
      [{ id: 't1', name: 'Retro', template: 'start-stop-continue' }],
      'd1',
    );
    if ('refusal' in compiled) throw new Error('refused');
    expect((compiled.tabs as { id: string; name: string }[]).map((t) => [t.id, t.name])).toEqual([
      ['t1', 'Retro'],
    ]);
  });
});
