import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { coloursSet } from './colours-set';
import { withoutFindings } from './without-findings';
import type { LintCode, LintFinding, LintSeverity } from '@liveplanner/api-schema';
import { box, lint, tabOf } from './fixtures/build';

describe('coloursSet', () => {
  it('names what a write added coloured or recoloured, not what it left or added plain', () => {
    const before: Element[] = [
      box('kept', 0, 0, { fillColor: '#123456' }),
      box('recoloured', 0, 0, { strokeColor: '#111111' }),
      box('plain', 0, 0),
    ];
    const after: Element[] = [
      box('kept', 0, 0, { fillColor: '#123456' }),
      box('recoloured', 0, 0, { strokeColor: '#222222' }),
      box('plain', 0, 0),
      box('new-plain', 0, 0),
      box('new-coloured', 0, 0, { fillColor: '#abcdef' }),
    ];
    expect([...coloursSet(before, after)]).toEqual(['recoloured', 'new-coloured']);
  });
});

describe('withoutFindings', () => {
  it('takes one code out and recounts the rest', () => {
    const finding = (code: LintCode, severity: LintSeverity): LintFinding => ({
      code,
      severity,
      refs: ['a'],
      message: 'm',
      fix: 'f',
    });
    const report = lint(tabOf(box('a', 0, 0)));
    const full = {
      ...report,
      findings: [
        finding('colour-on-themed', 'info'),
        finding('box-overlap', 'warning'),
        finding('aspect-extreme', 'info'),
      ],
      counts: { error: 0, warning: 1, info: 2 },
    };
    const out = withoutFindings(full, 'colour-on-themed');
    expect(out.findings.map((f) => f.code)).toEqual(['box-overlap', 'aspect-extreme']);
    expect(out.counts).toEqual({ error: 0, warning: 1, info: 1 });
    expect(out.measures).toBe(report.measures);
  });
});
