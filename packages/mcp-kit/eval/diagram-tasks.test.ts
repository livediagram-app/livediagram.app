import { describe, expect, it } from 'vitest';
import { diagramTasks } from './diagram-tasks.mjs';

// Each product hands in its own check helpers; any functions do for the bank's shape.
const helper = () => () => true;
const checks = Object.fromEntries(
  [
    'allLinked',
    'arrows',
    'atLeast',
    'boxes',
    'elementsFor',
    'find',
    'flows',
    'inside',
    'linked',
    'mentionsAll',
    'shapes',
  ].map((name) => [name, helper()]),
);

describe('the shared diagram tasks', () => {
  it('are D1 to D16 but D12 (livediagram adds its own), each with a prompt and named checks', () => {
    const tasks: { id: string; prompt: string; checks: [string, unknown][] }[] =
      diagramTasks(checks);
    expect(tasks.map((t) => t.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `D${i + 1}`).filter((id) => id !== 'D12'),
    );
    for (const t of tasks) {
      expect(t.prompt.length, t.id).toBeGreaterThan(20);
      expect(t.checks.length, t.id).toBeGreaterThanOrEqual(3);
      for (const [name, fn] of t.checks) {
        expect(typeof name, t.id).toBe('string');
        expect(typeof fn, `${t.id} ${name}`).toBe('function');
      }
    }
  });
});
