import { describe, expect, it } from 'vitest';
import { isLintCode, LINT_CODES, LINT_SEVERITY } from './lint';

describe('lint wire types', () => {
  it("fixes each code's severity as the spec's table does", () => {
    const by = (severity: string) => LINT_CODES.filter((code) => LINT_SEVERITY[code] === severity);
    expect(by('error')).toEqual(['box-overlap', 'arrow-dangling']);
    expect(by('warning')).toEqual([
      'arrow-behind-box',
      'edge-crossings',
      'label-collision',
      'label-overflow',
      'node-isolated',
      'group-escape',
    ]);
    expect(by('info')).toEqual([
      'group-split-edges',
      'duplicate-label',
      'flow-backwards',
      'aspect-extreme',
      'colour-on-themed',
    ]);
  });

  it('tells a code from anything else', () => {
    expect(isLintCode('box-overlap')).toBe(true);
    expect(isLintCode('overlap')).toBe(false);
    expect(isLintCode(3)).toBe(false);
  });
});
