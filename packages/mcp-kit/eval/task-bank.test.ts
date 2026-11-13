import { describe, expect, it } from 'vitest';
import { createTaskBank } from './task-bank.mjs';

const { TASKS, taskById, selectTasks } = createTaskBank({
  pages: [{ id: 'P1' }, { id: 'P2' }],
  forms: [{ id: 'F1' }],
});

describe('createTaskBank', () => {
  it('lists every area’s tasks, each with its area', () => {
    expect(TASKS).toEqual([
      { id: 'P1', area: 'pages' },
      { id: 'P2', area: 'pages' },
      { id: 'F1', area: 'forms' },
    ]);
    expect(taskById('F1').area).toBe('forms');
    expect(() => taskById('X9')).toThrow('No task X9');
  });

  it('selects all, an area or ids, each once', () => {
    expect(selectTasks()).toHaveLength(3);
    expect(selectTasks('all')).toHaveLength(3);
    expect(selectTasks('forms, P2,F1,,').map((t: { id: string }) => t.id)).toEqual(['F1', 'P2']);
    expect(() => selectTasks('nope')).toThrow('No task nope');
  });
});
