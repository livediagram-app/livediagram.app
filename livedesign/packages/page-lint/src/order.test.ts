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
      raw('text-overflow', ['z'], { x: 0, y: 0 }),
      raw('label-overflow', ['b'], { x: 0, y: 100 }),
      raw('label-overflow', ['a'], { x: 50, y: 0 }),
      raw('label-overflow', ['c'], { x: 0, y: 0 }),
      raw('label-overflow', ['q', 'r'], null),
      raw('label-overflow', ['q', 'p'], null),
      raw('label-overflow', ['q', 'p'], null),
    ]);
    expect(sorted.map((f) => `${f.code} ${f.refs.join(',')}`)).toEqual([
      'label-overflow q,p',
      'label-overflow q,p',
      'label-overflow q,r',
      'label-overflow c',
      'label-overflow a',
      'label-overflow b',
      'text-overflow z',
    ]);
    expect(sorted[0]).toEqual({
      code: 'label-overflow',
      severity: 'warning',
      refs: ['q', 'p'],
      message: 'q p',
      fix: 'f',
    });
  });
});
