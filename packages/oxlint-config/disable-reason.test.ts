import { beforeAll, describe, expect, it } from 'vitest';
import { directiveProblem } from './disable-reason';
import { findingsOf, lintFixtures, type Finding } from './lint-fixtures';

// Every lint disable names its rule and says why, and console.log is a script's stdout only (docs/ci.md "Lint
// disables and console.log"): the shared config holds both lines.
const REASON = 'liveworkspace(disable-reason)';
const CONSOLE = 'eslint(no-console)';

const FIXTURES = {
  'reasoned.ts':
    '// oxlint-disable-next-line typescript/no-explicit-any -- a fixture needs it\nexport const x: any = 1;\n',
  'bare.ts': '// oxlint-disable-next-line typescript/no-explicit-any\nexport const x: any = 1;\n',
  'eslint.ts':
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- old habit\nexport const x = 1;\n',
  'block.tsx':
    'export const A = () => (\n  <div>\n    {/* oxlint-disable-next-line liveworkspace/no-native-title */}\n    <span title="x" />\n  </div>\n);\n',
  'prose.ts':
    '// Only `oxlint-disable` directives count, so a pasted one never hides a finding.\nexport const x = 1;\n',
  'worker.ts':
    "console.log('[index] created');\nconsole.info('[index] created');\nconsole.warn('w');\n",
  'scripts/build.mjs': "console.log('built');\n",
  'eval/run.mjs': "console.log('scored');\n",
  'worker.test.ts': "console.log('timing');\n",
};

let findings: Finding[];
beforeAll(() => {
  findings = lintFixtures(FIXTURES);
});

const reasonErrors = (file: keyof typeof FIXTURES) => findingsOf(findings, file, REASON);
const consoleErrors = (file: keyof typeof FIXTURES) => findingsOf(findings, file, CONSOLE);

describe('disable directives', () => {
  it('accepts a directive that names its rule and says why', () => {
    expect(reasonErrors('reasoned.ts')).toEqual([]);
  });

  it('refuses one with no reason, in a line or a JSX block comment', () => {
    expect(reasonErrors('bare.ts')).toHaveLength(1);
    expect(reasonErrors('bare.ts')[0]?.message).toMatch(/Say why/);
    expect(reasonErrors('block.tsx')).toHaveLength(1);
  });

  it('refuses an eslint-disable, which the shared config never reads', () => {
    expect(reasonErrors('eslint.ts')).toHaveLength(1);
    expect(reasonErrors('eslint.ts')[0]?.message).toMatch(/does nothing here/);
  });

  it('leaves prose that mentions a directive alone', () => {
    expect(reasonErrors('prose.ts')).toEqual([]);
  });
});

describe('directiveProblem', () => {
  it('reads every directive form', () => {
    expect(directiveProblem(' oxlint-disable-line rule -- why')).toBeNull();
    expect(directiveProblem(' oxlint-disable rule-a, rule-b -- why ')).toBeNull();
    expect(directiveProblem(' oxlint-disable-next-line rule')).toBe('noReason');
    expect(directiveProblem(' oxlint-disable-next-line rule -- ')).toBe('noReason');
    expect(directiveProblem(' oxlint-disable-next-line -- why')).toBe('noRule');
    expect(directiveProblem(' oxlint-disable')).toBe('noRule');
    expect(directiveProblem(' eslint-disable-line')).toBe('eslint');
  });

  it('ignores comments that are not directives', () => {
    expect(directiveProblem(' oxlint-enable rule')).toBeNull();
    expect(directiveProblem(' oxlint-disabled is not a directive')).toBeNull();
    expect(directiveProblem(' see oxlint-disable above')).toBeNull();
  });
});

describe('console.log', () => {
  it('is refused in shipped code, where info, warn and error carry the intent', () => {
    expect(consoleErrors('worker.ts')).toHaveLength(1);
    expect(consoleErrors('worker.ts')[0]?.line).toBe(1);
  });

  it("is a script's, an eval harness's and a test's to use", () => {
    expect(consoleErrors('scripts/build.mjs')).toEqual([]);
    expect(consoleErrors('eval/run.mjs')).toEqual([]);
    expect(consoleErrors('worker.test.ts')).toEqual([]);
  });
});
