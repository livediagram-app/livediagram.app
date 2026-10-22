import { describe, expect, it } from 'vitest';
import type { RawFinding } from './checks/types';
import { sortFindings } from './order';

const raw = (code: RawFinding['code'], refs: string[], at: RawFinding['at']): RawFinding => ({
  code,
  refs,
  message: refs.join(' '),
  fix: 'f',
  at,
});

describe('sortFindings', () => {
  it('orders by severity, then code, then reading position, then refs (LN18)', () => {
    const sorted = sortFindings([
      raw('duplicate-label', ['z'], { x: 0, y: 0 }),
      raw('node-isolated', ['b'], { x: 0, y: 100 }),
      raw('node-isolated', ['a'], { x: 50, y: 0 }),
      raw('node-isolated', ['c'], { x: 0, y: 0 }),
      raw('box-overlap', ['q', 'r'], { x: 0, y: 0 }),
      raw('box-overlap', ['q', 'p'], { x: 0, y: 0 }),
      raw('box-overlap', ['q', 'p'], { x: 0, y: 0 }),
      raw('aspect-extreme', [], null),
    ]);
    expect(sorted.map((f) => `${f.code} ${f.refs.join(',')}`)).toEqual([
      'box-overlap q,p',
      'box-overlap q,p',
      'box-overlap q,r',
      'node-isolated c',
      'node-isolated a',
      'node-isolated b',
      'duplicate-label z',
      'aspect-extreme ',
    ]);
    expect(sorted[0]).toEqual({
      code: 'box-overlap',
      severity: 'error',
      refs: ['q', 'p'],
      message: 'q p',
      fix: 'f',
    });
  });
});
