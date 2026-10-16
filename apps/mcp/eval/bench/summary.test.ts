import { describe, expect, it } from 'vitest';
import {
  compareRounds,
  modelRows,
  normaliseError,
  recurringCheckFailures,
  recurringToolErrors,
  summarise,
} from './summary.mjs';

const metrics = {
  calls: 3,
  errors: 1,
  retries: 0,
  deprecatedCalls: 0,
  finished: true,
  durationMs: 2000,
  costUsd: 0.1,
};
const run = (
  task: string,
  model: string,
  n: number,
  pass: boolean[],
  errors: { tool: string; error: string }[] = [],
) => ({
  name: `${task}-${model}-${n}`,
  task,
  model,
  n,
  metrics: { ...metrics, errors: errors.length },
  checks: pass.map((p, i) => ({ name: `c${i}`, pass: p, detail: p ? null : `why ${i}` })),
  errors,
  tools: ['add_form'],
});

const err = (id: string) => ({
  tool: 'add_form',
  error: `Question "Name ${id}" (q-${id}) needs 2 options, has 1`,
});

const results = {
  round: 'r2',
  meta: { commit: 'abcdef1234', toolCount: 30, toolChars: 1000 },
  deprecated: [],
  runs: [
    run('Q1', 'haiku', 1, [true, false], [err('a')]),
    run('Q1', 'haiku', 2, [true, false], [err('b'), err('c')]),
    run('Q1', 'sonnet', 1, [true, true]),
    run('D1', 'sonnet', 1, [false, true], [{ tool: 'create_document', error: 'once only' }]),
  ],
};

describe('normaliseError', () => {
  it('takes out what differs between runs', () => {
    expect(normaliseError(err('a').error)).toBe(normaliseError(err('zz').error));
    expect(normaliseError('doc 981c336f-c993-4206-a00c-8d1cc03822ff missing')).toBe(
      'doc <id> missing',
    );
  });
});

describe('recurring findings', () => {
  it('keeps a tool error seen in two runs, counting each run once', () => {
    expect(recurringToolErrors(results.runs)).toEqual([
      expect.objectContaining({ tool: 'add_form', runs: 2, tasks: ['Q1'], models: ['haiku'] }),
    ]);
  });

  it('keeps a check that failed in two runs, out of the task’s runs', () => {
    expect(recurringCheckFailures(results.runs)).toEqual([
      { key: 'Q1 · c1', count: 2, of: 3, models: ['haiku'], detail: 'why 1' },
    ]);
  });
});

describe('modelRows', () => {
  it('totals each model', () => {
    const haiku = modelRows(results.runs).find((m) => m.model === 'haiku')!;
    expect(haiku).toMatchObject({
      runs: 2,
      checksPassed: 2,
      checks: 4,
      allPass: 0,
      errorsPerRun: 1.5,
    });
  });
});

describe('summarise', () => {
  it('writes every section', () => {
    const md = summarise(results);
    for (const heading of [
      '## By model',
      '## By task',
      '## Checks failing in 2+ runs',
      '## Tool errors in 2+ runs',
    ])
      expect(md).toContain(heading);
    expect(md).toContain('| Q1 · c1 | 2/3 | haiku | why 1 |');
    expect(summarise({ ...results, excluded: ['S1-sonnet-1'] })).toContain(
      'Left out, the MCP never connected: S1-sonnet-1.',
    );
  });

  it('escapes backslashes before pipes in a table cell', () => {
    const odd = (n: number) => ({
      ...run('P1', 'haiku', n, [false]),
      checks: [{ name: 'c0', pass: false, detail: 'a \\| b' }],
    });
    expect(summarise({ ...results, runs: [odd(1), odd(2)] })).toContain(
      '| P1 · c0 | 2/2 | haiku | a \\\\\\| b |',
    );
  });
});

describe('compareRounds', () => {
  it('lists only what moved', () => {
    const before = {
      ...results,
      round: 'r1',
      runs: results.runs.map((r) => ({
        ...r,
        checks: r.checks.map((c) => ({ ...c, pass: true })),
      })),
    };
    const md = compareRounds(before, results);
    expect(md).toContain('## Compared with r1');
    expect(md).toContain('| Q1 | haiku | 100% → 50% |');
    expect(md).not.toContain('| Q1 | sonnet |');
  });
});
