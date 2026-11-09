import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { budgetFiles } from './budgets.js';

// docs/ci.md "Speed budgets": vitest-budgets reruns, without coverage, the test files that hold a budget.
const roots = [];
afterEach(() => roots.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));

function workspace(files) {
  const root = mkdtempSync(join(tmpdir(), 'budgets-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const BUDGET = "import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';\n";

describe('budgetFiles', () => {
  it('finds the test files that import the CPU-time helpers, sorted', () => {
    const root = workspace({
      'src/z.perf.test.ts': BUDGET,
      'src/a.test.tsx': BUDGET,
      'lib/deep/b.spec.ts': BUDGET,
      'src/plain.test.ts': "import { it } from 'vitest';\n",
      'src/budget.ts': BUDGET,
    });
    expect(budgetFiles(root)).toEqual([
      'lib/deep/b.spec.ts',
      'src/a.test.tsx',
      'src/z.perf.test.ts',
    ]);
  });

  it('skips dependencies, build output and dot folders', () => {
    const root = workspace({
      'node_modules/x/a.test.ts': BUDGET,
      '.next/a.test.ts': BUDGET,
      'coverage/a.test.ts': BUDGET,
      '.hidden/a.test.ts': BUDGET,
      'src/kept.test.ts': BUDGET,
    });
    expect(budgetFiles(root)).toEqual(['src/kept.test.ts']);
  });

  it('finds nothing in a workspace without budgets', () => {
    expect(budgetFiles(workspace({ 'src/a.test.ts': "import { it } from 'vitest';\n" }))).toEqual(
      [],
    );
  });
});
