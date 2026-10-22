import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FUNCTION_DOCS } from './function-docs';
import { FUNCTIONS, FUNCTION_NAMES, familyOf, isKnownFunction } from './registry';

const spec = readFileSync(
  new URL('../../../../docs/specs/029-sheets/formulas.md', import.meta.url),
  'utf8',
);

// The names formulas.md lists under "Functions", in backticks on its bold family lines.
function specNames(): string[] {
  const section = spec.slice(spec.indexOf('## Functions'), spec.indexOf('## Recalculation'));
  const out: string[] = [];
  for (const line of section.split('\n\n')) {
    if (!line.startsWith('**')) continue;
    for (const m of line.matchAll(/`([A-Z][A-Z0-9.]*)`/g)) out.push(m[1]!);
  }
  return out;
}

describe('the function catalogue', () => {
  it('lists the same names in the registry, the docs and the spec', () => {
    const names = [...FUNCTION_NAMES].sort();
    expect(Object.keys(FUNCTION_DOCS).sort()).toEqual(names);
    expect([...new Set(specNames())].sort()).toEqual(names);
  });
  it('is closed: no prototype names, case ignored', () => {
    expect(Object.getPrototypeOf(FUNCTIONS)).toBeNull();
    expect(isKnownFunction('sum')).toBe(true);
    expect(isKnownFunction('constructor')).toBe(false);
    expect(familyOf('VLOOKUP')).toBe('Lookup');
    expect(familyOf('NOPE')).toBeUndefined();
  });
  it('gives every function an example that uses it', () => {
    for (const [name, doc] of Object.entries(FUNCTION_DOCS))
      expect(doc.example).toContain(`${name}(`);
  });
});
