import { describe, expect, it } from 'vitest';
import type { LintSeverity, RawFindingOf } from './findings';
import { createSortFindings } from './order';

// A product's table, cut to the codes these cases use, in spec order.
const CODES = ['box-overlap', 'node-isolated', 'duplicate-label', 'aspect-extreme'] as const;
type Code = (typeof CODES)[number];
type RawFinding = RawFindingOf<Code>;
const SEVERITY: Record<Code, LintSeverity> = {
  'box-overlap': 'error',
  'node-isolated': 'warning',
  'duplicate-label': 'info',
  'aspect-extreme': 'info',
};
const sortFindings = createSortFindings({
  codes: CODES,
  severities: ['error', 'warning', 'info'],
  severity: SEVERITY,
});

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

  it('breaks the last tie by refs in code-unit order, whichever way they arrive', () => {
    const at = { x: 0, y: 0 };
    const refsOf = (sorted: { refs: string[] }[]) => sorted.map((f) => f.refs.join(','));
    const a = raw('box-overlap', ['a'], at);
    const b = raw('box-overlap', ['b'], at);
    expect(refsOf(sortFindings([b, a]))).toEqual(['a', 'b']);
    expect(refsOf(sortFindings([a, b]))).toEqual(['a', 'b']);
  });
});
