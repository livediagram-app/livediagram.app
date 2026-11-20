import { describe, expect, it } from 'vitest';
import { tabIdNamed } from './tab-named';

const TABS = [
  { id: 't1', name: 'Overview' },
  { id: 't2', name: 'Roadmap' },
  { id: 't3', name: 'Notes' },
  { id: 't4', name: 'notes ' },
];

describe('tabIdNamed', () => {
  it('reads an id as itself, even when a tab is named like it', () => {
    expect(tabIdNamed(TABS, 't2')).toBe('t2');
    expect(tabIdNamed([...TABS, { id: 't5', name: 't1' }], 't1')).toBe('t1');
  });

  it('reads a name one tab alone has, in any case', () => {
    expect(tabIdNamed(TABS, 'Roadmap')).toBe('t2');
    expect(tabIdNamed(TABS, ' overview ')).toBe('t1');
  });

  it('answers nothing for a name two tabs share, or one no tab has', () => {
    expect(tabIdNamed(TABS, 'Notes')).toBeUndefined();
    expect(tabIdNamed(TABS, 'Budget')).toBeUndefined();
  });
});
