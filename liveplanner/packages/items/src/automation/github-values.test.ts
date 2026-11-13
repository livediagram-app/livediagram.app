import { describe, expect, it } from 'vitest';
import { ruleSentence } from './sentence';
import {
  githubHearsRepository,
  pullRequestTitleValue,
  pullRequestValues,
  type PullRequestValues,
} from './github-triggers';
import { triggerMatches, type AutomationEvent } from './matches';
import { planActions } from './plan-actions';
import { ruleBody, OUTLINE, bug, ctxFor } from './test-fixtures';
import { readRuleBody } from './validate';
import { isKnownValue, unknownValueIn } from './values';
import { AUTOMATION_PULL_REQUEST_VALUE_NAMES, type AutomationTrigger } from './types';
import { parseRepositoryName } from '../pull-request-fields';

// Work Tracker 762 and 763 (docs/specs/026-plan/automations.md "GitHub triggers", "Values"): a GitHub rule's
// pull request values, a private repository's title kept out of everything but outgoing messages, and a trigger's
// repositories.

const REF = { owner: 'acme', repo: 'web', number: 42 };
const pull = (isPrivate: boolean): PullRequestValues =>
  pullRequestValues(REF, 'Ship the importer', isPrivate);

describe('pull request values', () => {
  it('reads the repository, number, title and address of a pull request', () => {
    expect(pull(false)).toEqual({
      repository: 'acme/web',
      number: 42,
      title: 'Ship the importer',
      url: 'https://github.com/acme/web/pull/42',
      private: false,
    });
  });

  it('keeps a private repository’s title to outgoing messages, its short name elsewhere', () => {
    expect(pullRequestTitleValue(pull(false), false)).toBe('Ship the importer');
    expect(pullRequestTitleValue(pull(true), true)).toBe('Ship the importer');
    expect(pullRequestTitleValue(pull(true), false)).toBe('acme/web#42');
  });

  it('knows the values only in a GitHub rule’s text', () => {
    for (const name of AUTOMATION_PULL_REQUEST_VALUE_NAMES) {
      expect(isKnownValue(name)).toBe(false);
      expect(isKnownValue(name, { github: true })).toBe(true);
    }
    expect(unknownValueIn('{{pull_request.body}}', { github: true })).toBe('pull_request.body');
    const save = (trigger: AutomationTrigger) =>
      readRuleBody(
        ruleBody({ trigger, steps: [{ kind: 'comment', text: '{{pull_request.title}}' }] }),
      );
    expect(save({ kind: 'pull_request_merged' })).toHaveProperty('body');
    expect(save({ kind: 'card_created' })).toMatchObject({ error: 'automation_value_unknown' });
  });

  const step = (text: string) => [
    { kind: 'comment' as const, text },
    { kind: 'notify' as const, via: 'slack' as const, webhook: 'w1', text },
  ];
  const TEXT = '{{pull_request.number}} {{pull_request.title}} {{pull_request.url}}';

  it('fills a comment and a message from the run’s pull request', () => {
    const run = planActions(step(TEXT), ctxFor(bug(), { github: pull(false) }));
    if ('failed' in run) throw new Error('failed');
    const filled = '#42 Ship the importer https://github.com/acme/web/pull/42';
    expect(run.comments).toEqual([filled]);
    expect(run.sends[0]!.text).toBe(filled);
  });

  it('fills a private repository’s title into the outgoing message alone', () => {
    const run = planActions(step(TEXT), ctxFor(bug(), { github: pull(true) }));
    if ('failed' in run) throw new Error('failed');
    expect(run.comments).toEqual(['#42 acme/web#42 https://github.com/acme/web/pull/42']);
    expect(run.sends[0]!.text).toBe('#42 Ship the importer https://github.com/acme/web/pull/42');
  });

  it('reads nothing with no pull request (Test on a Card)', () => {
    const run = planActions(step(`[${TEXT}]`), ctxFor(bug()));
    if ('failed' in run) throw new Error('failed');
    expect(run.comments).toEqual(['[  ]']);
  });
});

describe('a GitHub trigger’s repositories', () => {
  const merged = (repositories?: string[]): AutomationTrigger => ({
    kind: 'pull_request_merged',
    ...(repositories ? { repositories } : {}),
  });
  const event = (repository?: string): AutomationEvent => ({
    id: 'e',
    kind: 'github',
    cardId: 'c1',
    by: { id: 'github', name: 'GitHub', color: '#1f2328' },
    role: 'system',
    github: 'merged',
    ...(repository ? { pull: { ...pull(false), repository } } : {}),
    at: 1,
  });

  it('hears every repository when it names none, else the named ones, any case', () => {
    expect(githubHearsRepository({ kind: 'pull_request_merged' }, 'acme/web')).toBe(true);
    expect(githubHearsRepository({ kind: 'pull_request_merged', repositories: [] }, 'x/y')).toBe(
      true,
    );
    const named = { kind: 'pull_request_merged' as const, repositories: ['Acme/Web'] };
    expect(githubHearsRepository(named, 'acme/web')).toBe(true);
    expect(githubHearsRepository(named, 'acme/api')).toBe(false);
    // Test on a Card's event names no repository: heard, as if a named one had done it.
    expect(githubHearsRepository(named, undefined)).toBe(true);
  });

  it('matches an event only from a named repository', () => {
    const t = merged(['acme/web']);
    expect(triggerMatches(t, event('acme/web'), 'r1')).toBe(true);
    expect(triggerMatches(t, event('acme/api'), 'r1')).toBe(false);
    expect(triggerMatches(merged(), event('acme/api'), 'r1')).toBe(true);
    const checks: AutomationTrigger = {
      kind: 'pull_request_checks',
      result: 'failing',
      repositories: ['acme/web'],
    };
    expect(triggerMatches(checks, { ...event('acme/api'), github: 'checks_failing' }, 'r1')).toBe(
      false,
    );
  });

  it('reads repositories trimmed and once by case, drops an empty list, refuses a bad one', () => {
    const read = (trigger: unknown) => readRuleBody(ruleBody({ trigger } as never));
    expect(read(merged([' acme/web ', 'ACME/WEB', 'acme/api']))).toMatchObject({
      body: { trigger: { kind: 'pull_request_merged', repositories: ['acme/web', 'acme/api'] } },
    });
    const empty = read(merged([]));
    expect('body' in empty && empty.body.trigger).toEqual({ kind: 'pull_request_merged' });
    expect(
      read({ kind: 'pull_request_checks', result: 'passing', repositories: ['acme/web'] }),
    ).toMatchObject({ body: { trigger: { repositories: ['acme/web'] } } });
    expect(read(merged(['nope']))).toMatchObject({ path: 'trigger.repositories.0' });
    expect(read({ kind: 'pull_request_opened', repositories: 'acme/web' })).toMatchObject({
      path: 'trigger.repositories',
    });
    const many = Array.from({ length: 21 }, (_, i) => `acme/r${i}`);
    expect(read(merged(many))).toMatchObject({ path: 'trigger.repositories' });
  });

  it('names them at the end of the Rules list’s sentence', () => {
    const words = (trigger: AutomationTrigger) =>
      ruleSentence({ trigger, conditions: [], steps: [] }, OUTLINE as never)
        .map((p) => ('word' in p ? p.word : 'chip' in p ? `[${p.chip}]` : ''))
        .join(' ');
    expect(words(merged(['acme/web', 'acme/api']))).toContain('in [acme/web] or [acme/api]');
    expect(
      words({ kind: 'pull_request_checks', result: 'failing', repositories: ['acme/web'] }),
    ).toContain('[Failing] in [acme/web]');
    expect(words(merged())).not.toContain(' in ');
  });

  it('reads a repository’s name as owner/name, or nothing', () => {
    expect(parseRepositoryName(' acme/web ')).toBe('acme/web');
    expect(parseRepositoryName('acme')).toBeUndefined();
    expect(parseRepositoryName('acme/web/x')).toBeUndefined();
    expect(parseRepositoryName('acme/')).toBeUndefined();
    expect(parseRepositoryName(7)).toBeUndefined();
  });
});
