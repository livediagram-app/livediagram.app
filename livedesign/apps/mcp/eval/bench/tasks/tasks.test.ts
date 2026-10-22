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
    expect(selectTasks('pages').map((t) => t.id)).toEqual(['I1', 'I3', 'I4', 'I6']);
    expect(selectTasks('I4,pages').map((t) => t.id)).toEqual(['I4', 'I1', 'I3', 'I6']);
    expect(() => selectTasks('Z9')).toThrow('No task Z9');
  });
});
