import { describe, expect, it } from 'vitest';
import { selectTasks, TASKS, taskById } from './index.mjs';

describe('the task bank', () => {
  it('has unique ids, a prompt and checks for every task', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    for (const t of TASKS) {
      expect(t.prompt.length, t.id).toBeGreaterThan(20);
      expect(t.checks.length, t.id).toBeGreaterThanOrEqual(3);
      for (const [name, fn] of t.checks) {
        expect(typeof name, t.id).toBe('string');
        expect(typeof fn, `${t.id} ${name}`).toBe('function');
      }
    }
  });

  it('builds every edit task on a task that exists and is no edit itself', () => {
    for (const t of TASKS.filter((x) => x.after))
      expect(taskById(t.after).after, t.id).toBeUndefined();
  });

  it('selects all, an area or ids', () => {
    expect(selectTasks('all')).toHaveLength(TASKS.length);
    expect(selectTasks('workshop').map((t) => t.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'W1', 'W2']);
    expect(selectTasks('workshop,D1,F1').map((t) => t.id)).toEqual([
      'F1',
      'F2',
      'F3',
      'F4',
      'W1',
      'W2',
      'D1',
    ]);
    expect(() => selectTasks('Z9')).toThrow('No task Z9');
  });
});
