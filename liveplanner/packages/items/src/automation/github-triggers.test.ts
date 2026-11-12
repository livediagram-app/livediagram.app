import { describe, expect, it } from 'vitest';
import {
  githubHears,
  githubTriggerWords,
  heardOfChecks,
  heardOfPull,
  heardOfTrigger,
} from './github-triggers';
import { TRIGGER_EVENT_KINDS, triggerMatches, type AutomationEvent } from './matches';
import { AUTOMATION_TRIGGER_NAMES, ruleSentence } from './sentence';
import { ruleBody } from './test-fixtures';
import {
  GITHUB_TRIGGER_KINDS,
  isGithubKind,
  isGithubTrigger,
  isPersonless,
  type AutomationTrigger,
} from './types';
import { readRuleBody } from './validate';

// docs/specs/026-plan/github-pull-requests.md "GitHub triggers"; automations.md "GitHub triggers".
const event = (github: AutomationEvent['github']): AutomationEvent => ({
  id: 'g:d1:c1',
  kind: 'github',
  cardId: 'c1',
  by: { id: 'github', name: 'GitHub', color: '#1f2328' },
  role: 'system',
  github,
  pr: 'acme/web#42',
  at: 0,
});

describe('what a pull request did', () => {
  it('opens ready for review, reopens or leaves draft; a draft opening is not yet open', () => {
    expect(heardOfPull('opened', 'open')).toBe('opened');
    expect(heardOfPull('reopened', 'open')).toBe('opened');
    expect(heardOfPull('ready_for_review', 'open')).toBe('opened');
    expect(heardOfPull('opened', 'draft')).toBeNull();
  });

  it('merges, or closes without merging; anything else says nothing', () => {
    expect(heardOfPull('closed', 'merged')).toBe('merged');
    expect(heardOfPull('closed', 'closed')).toBe('closed');
    expect(heardOfPull('closed', 'open')).toBeNull();
    expect(heardOfPull('edited', 'open')).toBeNull();
    expect(heardOfPull('synchronize', 'open')).toBeNull();
  });

  it('hears checks change into failing or passing, never running, a repeat or a closed one', () => {
    expect(heardOfChecks(undefined, { state: 'open', checks: 'failing' })).toBe('checks_failing');
    expect(
      heardOfChecks({ state: 'open', checks: 'running' }, { state: 'draft', checks: 'passing' }),
    ).toBe('checks_passing');
    expect(
      heardOfChecks({ state: 'open', checks: 'failing' }, { state: 'open', checks: 'failing' }),
    ).toBeNull();
    expect(heardOfChecks(undefined, { state: 'open', checks: 'running' })).toBeNull();
    expect(heardOfChecks(undefined, { state: 'open' })).toBeNull();
    expect(heardOfChecks(undefined, { state: 'merged', checks: 'failing' })).toBeNull();
  });
});

describe('which trigger hears it', () => {
  const triggers: AutomationTrigger[] = [
    { kind: 'pull_request_opened' },
    { kind: 'pull_request_merged' },
    { kind: 'pull_request_closed' },
    { kind: 'pull_request_checks', result: 'failing' },
    { kind: 'pull_request_checks', result: 'passing' },
  ];
  const heards = ['opened', 'merged', 'closed', 'checks_failing', 'checks_passing'] as const;

  it('each trigger hears its own and nothing else, and Test on a Card hears as it does', () => {
    triggers.forEach((t, i) => {
      if (!isGithubTrigger(t)) throw new Error('not a GitHub trigger');
      heards.forEach((h, j) => expect(githubHears(t, h), `${t.kind} ${h}`).toBe(i === j));
      expect(heardOfTrigger(t)).toBe(heards[i]);
      expect(triggerMatches(t, event(heards[i]), 'r1')).toBe(true);
      expect(triggerMatches(t, event(heards[(i + 1) % 5]), 'r1')).toBe(false);
      expect(triggerMatches(t, { ...event(heards[i]), github: undefined }, 'r1')).toBe(false);
      expect(TRIGGER_EVENT_KINDS[t.kind]).toEqual(['github']);
      expect(isPersonless(t)).toBe(true);
    });
    expect(triggerMatches({ kind: 'card_created' }, event('opened'), 'r1')).toBe(false);
  });

  it('names the kinds, and nothing else is one', () => {
    expect(GITHUB_TRIGGER_KINDS.every(isGithubKind)).toBe(true);
    expect(isGithubKind('card_moved')).toBe(false);
    expect(GITHUB_TRIGGER_KINDS.map((k) => AUTOMATION_TRIGGER_NAMES[k])).toEqual([
      'Pull Request Opened',
      'Pull Request Merged',
      'Pull Request Closed',
      'Checks Finished',
    ]);
  });

  it('words the Audit Trail’s first line', () => {
    expect(githubTriggerWords('merged', 'acme/web#42')).toBe('GitHub: acme/web#42 merged');
    expect(githubTriggerWords('checks_failing')).toBe('GitHub: a pull request checks failing');
    expect(githubTriggerWords('checks_passing', 'a/b#1')).toBe('GitHub: a/b#1 checks passing');
  });
});

describe('in a rule', () => {
  it('reads each trigger, Checks Finished with its result', () => {
    for (const trigger of [
      { kind: 'pull_request_opened' },
      { kind: 'pull_request_merged' },
      { kind: 'pull_request_closed' },
      { kind: 'pull_request_checks', result: 'passing' },
    ]) {
      const read = readRuleBody({ ...ruleBody(), trigger: { ...trigger, extra: 1 } });
      expect('body' in read && read.body.trigger).toEqual(trigger);
    }
    const bad = readRuleBody({
      ...ruleBody(),
      trigger: { kind: 'pull_request_checks', result: 'running' },
    });
    expect('path' in bad && bad.path).toBe('trigger.result');
  });

  it('refuses Who Did It, as a time trigger does', () => {
    const read = readRuleBody({
      ...ruleBody(),
      trigger: { kind: 'pull_request_merged' },
      conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
    });
    expect('body' in read).toBe(false);
  });

  it('says Checks Finished’s result in the sentence', () => {
    const outline = { statuses: [], fields: [], types: [], tabs: [], people: [] };
    const parts = ruleSentence(
      { trigger: { kind: 'pull_request_checks', result: 'failing' }, conditions: [], steps: [] },
      outline as never,
    );
    expect(parts).toEqual([
      { word: 'When' },
      { chip: 'Checks Finished', trigger: true },
      { word: 'as' },
      { chip: 'Failing' },
    ]);
    expect(
      ruleSentence(
        { trigger: { kind: 'pull_request_merged' }, conditions: [], steps: [] },
        outline as never,
      ),
    ).toEqual([{ word: 'When' }, { chip: 'Pull Request Merged', trigger: true }]);
  });
});
