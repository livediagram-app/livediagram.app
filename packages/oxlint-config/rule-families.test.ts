import { beforeAll, describe, expect, it } from 'vitest';
import config from './index';
import { lintFixtures, type Finding } from './lint-fixtures';

// One deliberate violation per rule family the shared config enforces
// (docs/specs/003-system-architecture/linting.md), linted the way a workspace lints.

const HOOKS = `import { useEffect, useRef, useState } from 'react';
export function Conditional({ on }: { on: boolean }) {
  if (on) useState(0);
  return null;
}
export function MissingDep({ id }: { id: string }) {
  useEffect(() => {
    console.log(id);
  }, []);
  return null;
}
export function Impure() {
  return <p>{Date.now()}</p>;
}
export function MirroredState({ value }: { value: number }) {
  const [copy, setCopy] = useState(0);
  useEffect(() => {
    setCopy(value);
  }, [value]);
  return <p>{copy}</p>;
}
export function RefInRender() {
  const ref = useRef(0);
  return <p>{ref.current}</p>;
}
`;

const FIXTURES = {
  'hooks.tsx': HOOKS,
  'any.ts': 'export const x: any = 1;\n',
  'unused-directive.ts':
    '// oxlint-disable-next-line typescript/no-explicit-any\nexport const x = 1;\n',
  'eslint-directive.ts':
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const x: any = 1;\n',
  'script.mjs': 'let a = 1;\nexport default a + undefinedGlobal;\n',
  'module.ts': 'let a = 1;\nexport default a;\n',
  'typed.ts': 'const xs = [1, 2];\nfor (const i in xs) console.log(i);\n',
};

let findings: Finding[];
beforeAll(() => {
  findings = lintFixtures(FIXTURES);
});

const rulesIn = (file: keyof typeof FIXTURES) =>
  findings.filter((f) => f.file === file).map((f) => f.rule);

describe('shared oxlint config', () => {
  it('makes every rule an error and enables no category wholesale', () => {
    const severities = Object.values(config.rules ?? {}).map((v) => (Array.isArray(v) ? v[0] : v));
    expect(new Set(severities)).toEqual(new Set(['error']));
    expect(new Set(Object.values(config.categories ?? {}))).toEqual(new Set(['off']));
  });

  it("enables every React hooks rule, the React Compiler's included", () => {
    const hooks = [
      'rules-of-hooks',
      'exhaustive-deps',
      'static-components',
      'use-memo',
      'preserve-manual-memoization',
      'incompatible-library',
      'immutability',
      'globals',
      'refs',
      'set-state-in-effect',
      'error-boundaries',
      'purity',
      'set-state-in-render',
      'unsupported-syntax',
    ].map((rule) => `react/${rule}`);
    expect(Object.keys(config.rules ?? {})).toEqual(expect.arrayContaining(hooks));
  });
});

describe('rule families', () => {
  it('rejects a conditional hook and an incomplete dependency list', () => {
    expect(rulesIn('hooks.tsx')).toEqual(
      expect.arrayContaining(['react-hooks(rules-of-hooks)', 'react-hooks(exhaustive-deps)']),
    );
  });

  it('rejects the React Compiler violations: impurity, effect-mirrored state, refs in render', () => {
    expect(rulesIn('hooks.tsx')).toEqual(
      expect.arrayContaining(['react(purity)', 'react(set-state-in-effect)', 'react(refs)']),
    );
  });

  it('rejects an explicit any', () => {
    expect(rulesIn('any.ts')).toEqual(['typescript(no-explicit-any)']);
  });

  it('rejects a disable directive that suppresses nothing', () => {
    const reported = findings.filter((f) => f.file === 'unused-directive.ts');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.message).toMatch(/Unused oxlint-disable directive/);
  });

  it('ignores eslint-disable directives', () => {
    expect(rulesIn('eslint-directive.ts')).toEqual(['typescript(no-explicit-any)']);
  });

  it('runs the type-aware rules, which need the type of an expression', () => {
    expect(rulesIn('typed.ts')).toEqual(['typescript(no-for-in-array)']);
  });

  it('runs the JavaScript-only rules on JavaScript and the TypeScript-only rules on TypeScript', () => {
    expect(rulesIn('script.mjs')).toContain('eslint(no-undef)');
    expect(rulesIn('script.mjs')).not.toContain('eslint(prefer-const)');
    expect(rulesIn('module.ts')).toEqual(['eslint(prefer-const)']);
  });
});
