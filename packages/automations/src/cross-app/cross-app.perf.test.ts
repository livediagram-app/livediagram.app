// Steps in other apps on their hot paths, held to CPU-time budgets (blueprint cross-app.md "Cost"): a save reading a
// rule of the five most such steps at their longest, a run filling the longest body with a value on every line, and
// a chain's check at its longest. CPU time, best of a few rounds, each budget several times what was measured.
import { CROSS_APP_HOPS_MAX, CROSS_APP_STEPS_MAX } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';
import { defineItemKinds, readItemRule } from '../item';
import { chainOf, chainStop, nextChain } from './chain';
import { fillCrossAppStep } from './fill';

type Usage = { user: number; system: number };
const { cpuUsage, stderr } = (
  globalThis as unknown as {
    process: { cpuUsage: () => Usage; stderr: { write: (text: string) => void } };
  }
).process;
const cpuMicros = (): number => {
  const { user, system } = cpuUsage();
  return user + system;
};
const budgetMicros = (micros: number): number => cpuBudgetMs(micros / 1000) * 1000;
const report = (name: string, value: string) => void stderr.write(`[perf] ${name}: ${value}\n`);

// The least CPU time one call of `work` took, in microseconds, over `rounds` rounds of `calls` calls.
function best(rounds: number, calls: number, work: () => unknown): number {
  let least = Infinity;
  for (let r = 0; r < rounds; r += 1) {
    const from = cpuMicros();
    for (let i = 0; i < calls; i += 1) work();
    least = Math.min(least, (cpuMicros() - from) / calls);
  }
  return least;
}

const KINDS = defineItemKinds({ itemWord: 'knowledgebase', collab: false, tabTemplates: true });

// The longest body a page takes, a value on every line.
const LONG_BODY = Array.from({ length: 800 }, (_, i) => `Line ${i}: {{item.name}} {{now.date}}`)
  .join('\n')
  .slice(0, 20_000);

const kbPage = (i: number) => ({
  kind: 'kb_page',
  target: { app: 'liveknowledge', item: `k${i}`, title: `Handbook ${i}` },
  title: `Release {{item.name}} ${i}`,
  body: LONG_BODY,
});

describe('steps in other apps', () => {
  it('read a rule of five at their longest in under 6 ms', () => {
    const body = {
      name: 'Five Pages',
      trigger: { kind: 'manual' },
      conditions: [],
      steps: Array.from({ length: CROSS_APP_STEPS_MAX }, (_, i) => kbPage(i)),
      chain: false,
      timeZone: 'UTC',
    };
    const read = readItemRule(body, KINDS);
    expect(read, JSON.stringify(read)).toHaveProperty('body');
    const micros = best(5, 20, () => readItemRule(body, KINDS));
    report(
      'read a rule of 5 steps in other apps, 20,000-character bodies',
      `${micros.toFixed(1)} µs`,
    );
    expect(micros).toBeLessThan(budgetMicros(6000));
  });

  it('fill the longest body, a value on every line, in under 2 ms', () => {
    const step = kbPage(1) as Parameters<typeof fillCrossAppStep>[0];
    const fill = (text: string) =>
      text.replaceAll('{{item.name}}', 'Launch Plan').replaceAll('{{now.date}}', '22 Nov 2026');
    expect(fillCrossAppStep(step, fill)).not.toBeNull();
    const micros = best(5, 20, () => fillCrossAppStep(step, fill));
    report('fill a 20,000-character body', `${micros.toFixed(1)} µs`);
    expect(micros).toBeLessThan(budgetMicros(2000));
  });

  it('check a chain at its longest in under 20 µs', () => {
    let chain = chainOf(undefined, 'run0');
    for (let i = 1; i < CROSS_APP_HOPS_MAX; i += 1)
      chain = nextChain(chain, `app:item${i}:rule${i}`);
    const micros = best(5, 1000, () => chainStop(chain, 'app:item9:rule9'));
    report('check a chain of 3 hops', `${micros.toFixed(2)} µs`);
    expect(micros).toBeLessThan(budgetMicros(20));
  });
});
