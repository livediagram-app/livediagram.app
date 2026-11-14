// A GitHub-triggered rule's stamp (docs/specs/026-plan/automations.md "On cards"): Automation's person with its source,
// so the card's footer draws GitHub's mark with no history read.
import { describe, expect, it } from 'vitest';
import { AUTOMATION_PERSON_ID, automationPerson, isGithubStamp } from './types';

describe('a rule stamp’s source', () => {
  it('is on the stamp only for a GitHub-triggered run', () => {
    expect(automationPerson('Done on Merge', 'github')).toEqual({
      id: AUTOMATION_PERSON_ID,
      name: 'Done on Merge',
      color: '#7c3aed',
      via: 'github',
    });
    expect('via' in automationPerson('Done on Merge')).toBe(false);
  });

  it('reads as GitHub only on Automation’s person', () => {
    expect(isGithubStamp(automationPerson('r', 'github'))).toBe(true);
    expect(isGithubStamp(automationPerson('r'))).toBe(false);
    expect(isGithubStamp({ id: 'q', name: 'Robin', color: '#16a34a', via: 'github' })).toBe(false);
    expect(isGithubStamp(undefined)).toBe(false);
  });
});
