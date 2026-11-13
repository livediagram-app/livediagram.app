import { describe, expect, it } from 'vitest';
import { fieldsSetByAutomation, newestByGithub } from './set-by-automation';

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

// Work Tracker 768: the footer names GitHub when the newest entry is a GitHub-triggered rule's.
describe('newestByGithub', () => {
  it('reads the newest entry alone', () => {
    const entry = (tag?: 'automation' | 'automation_github') => ({
      at: 1,
      by,
      ...(tag ? { tag } : {}),
      changes: [{ kind: 'flagged' as const }],
    });
    expect(newestByGithub([entry('automation_github'), entry('automation')])).toBe(true);
    expect(newestByGithub([entry('automation'), entry('automation_github')])).toBe(false);
    expect(newestByGithub([entry()])).toBe(false);
    expect(newestByGithub([])).toBe(false);
  });
});
