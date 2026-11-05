import { describe, expect, it } from 'vitest';
import { dropRetiredVote } from './retired-vote';
import { migrateStoredTab } from './stored-tab';

// docs/specs/002-project-scope/not-in-livehuddle.md "The Vote": a tab saved with a dot vote still opens.
const oldVote = {
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes: { a: ['p1', 'p1'] },
  voteLayerId: 'l1',
  round: 'r1',
};

describe('dropRetiredVote', () => {
  it('hands back the same tab when it carries no vote', () => {
    const tab = { id: 't', name: 'T', elements: [] };
    expect(dropRetiredVote(tab)).toBe(tab);
  });

  it('drops a stored vote, whatever it holds, and keeps the rest', () => {
    const timer = { mode: 'stopwatch', running: false, frozenMs: 0 };
    for (const vote of [oldVote, 'x', null, undefined]) {
      const out = dropRetiredVote({ id: 't', name: 'T', elements: [], timer, vote });
      expect(out).toEqual({ id: 't', name: 'T', elements: [], timer });
    }
  });

  it('runs in the stored-tab migration, beside the retired layers', () => {
    const tab = {
      id: 't',
      name: 'T',
      layers: [{ id: 'l1', name: 'Layer 1' }],
      elements: [],
      vote: oldVote,
    };
    const out = migrateStoredTab(tab as never) as unknown as Record<string, unknown>;
    expect('vote' in out).toBe(false);
    expect('layers' in out).toBe(false);
  });
});
