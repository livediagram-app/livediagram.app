import { describe, expect, it } from 'vitest';
import { fieldsSetByAutomation } from './set-by-automation';

const by = { name: 'Wrap Up', color: '#7c3aed' };

describe('fieldsSetByAutomation', () => {
  it('marks a field whose newest set or clear was a rule’s', () => {
    const fields = fieldsSetByAutomation([
      {
        at: 3,
        by,
        tag: 'automation',
        changes: [{ kind: 'set', field: 'due' }, { kind: 'flagged' }],
      },
      {
        at: 2,
        by: { name: 'Ana', color: '#000' },
        changes: [{ kind: 'cleared', field: 'labels' }],
      },
      {
        at: 1,
        by,
        tag: 'automation',
        changes: [
          { kind: 'set', field: 'labels' },
          { kind: 'cleared', field: 'due' },
        ],
      },
    ]);
    expect([...fields]).toEqual(['due']);
  });

  it('marks a field a GitHub-triggered rule set', () => {
    const fields = fieldsSetByAutomation([
      { at: 1, by, tag: 'automation_github', changes: [{ kind: 'set', field: 'status' }] },
    ]);
    expect([...fields]).toEqual(['status']);
  });

  it('marks a field an AI action set', () => {
    const fields = fieldsSetByAutomation([
      { at: 1, by, tag: 'automation_ai', changes: [{ kind: 'set', field: 'priority' }] },
    ]);
    expect([...fields]).toEqual(['priority']);
  });
});
