import { describe, expect, it } from 'vitest';
import type { RuleSentenceOutline } from './sentence';
import { SUMMARY_AI_STEP, automationRuleSummary } from './summary';
import type { AutomationRule, AutomationRuleBody } from './types';

// docs/specs/026-plan/automations.md "On cards": the read-only sheet a Participant or a Viewer opens from a rule's name,
// built from an allow-list so a rule's private details never leave as anything but a label.

const OUTLINE: RuleSentenceOutline = {
  types: [
    {
      id: 'task',
      label: 'Task',
      fields: ['title', 'priority'],
      custom: [{ id: 'f-contact', label: 'Contact', kind: 'text' }],
    },
  ],
  statuses: new Map([
    ['todo', 'To Do'],
    ['done', 'Done'],
  ]),
  people: [{ id: 'p-ana', name: 'Ana Costa' }],
  boardNames: new Map([['b1', 'Support']]),
  goneWords: true,
};

const SECRETS = {
  address: 'private.person@example.com',
  domain: '@secret-sender.example',
  webhook: 'Launch Channel Hook',
  webhookId: 'wh_9f8e7d',
  repo: 'acme/secret-repo',
  setValue: 'ceo@example.com',
  link: 'https://internal.example/x',
  subject: 'Private subject line',
  body: 'Private body words',
  message: 'Private channel message',
};

function rule(
  body: Partial<AutomationRuleBody>,
  extra: Partial<AutomationRule> = {},
): AutomationRule {
  return {
    id: 'r1',
    name: 'Done Means Wrapped Up',
    trigger: { kind: 'card_moved', to: ['done'] },
    conditions: [],
    steps: [],
    chain: false,
    timeZone: 'Europe/London',
    enabled: true,
    made: { by: { id: 'p-ana', name: 'Ana Costa', color: '#123456' }, at: 1_700_000_000_000 },
    edited: { by: { id: 'p-ben', name: 'Ben', color: '#654321' }, at: 1_700_000_100_000 },
    ...body,
    ...extra,
  };
}

describe('a rule’s summary', () => {
  it('reads the trigger, conditions and steps in words, with who made it', () => {
    const summary = automationRuleSummary(
      rule({
        conditions: [{ kind: 'column', statuses: ['todo'], not: true }],
        steps: [
          { kind: 'move', status: 'done' },
          { kind: 'wait', hours: 26 },
          { kind: 'assign', to: { person: 'p-ana' } },
        ],
      }),
      OUTLINE,
    );
    expect(summary).toEqual({
      id: 'r1',
      name: 'Done Means Wrapped Up',
      on: true,
      paused: false,
      trigger: 'When Card Moved to Done',
      picks: false,
      conditions: ['Column is not To Do'],
      steps: [
        { kind: 'move', words: 'Move to Done' },
        { kind: 'wait', words: 'Wait 1 Day 2 Hours' },
        { kind: 'assign', words: 'Assign Ana Costa' },
      ],
      made: { by: 'Ana Costa', at: 1_700_000_000_000 },
    });
  });

  it('says a time trigger’s conditions pick its cards, and that a paused rule is off', () => {
    const summary = automationRuleSummary(
      rule(
        { trigger: { kind: 'scheduled', every: 'weekday', at: '09:00' } as never },
        { enabled: false, paused: { reason: 'failed', at: 1 } },
      ),
      OUTLINE,
    );
    expect(summary).toMatchObject({
      trigger: 'Every Weekday at 9:00',
      picks: true,
      on: false,
      paused: true,
    });
  });

  it('reads an If / Else and a For Related Cards with their own conditions and steps', () => {
    const summary = automationRuleSummary(
      rule({
        steps: [
          {
            kind: 'if',
            conditions: [{ kind: 'field', field: 'priority', op: 'is', value: 'high' }],
            then: [{ kind: 'flag' }],
            else: [
              {
                kind: 'email',
                to: { addresses: [SECRETS.address] },
                subject: SECRETS.subject,
                body: SECRETS.body,
              },
            ],
          },
          {
            kind: 'for',
            related: { kind: 'children' },
            conditions: [],
            then: [{ kind: 'move', status: 'done' }],
          },
        ],
      }),
      OUTLINE,
    );
    expect(summary.steps).toEqual([
      {
        kind: 'if',
        words: 'If',
        conditions: ['Priority is High'],
        then: [{ kind: 'flag', words: 'Flag' }],
        else: [{ kind: 'email', words: 'Email 1 Address' }],
      },
      {
        kind: 'for',
        words: 'For each Child Card',
        conditions: [],
        then: [{ kind: 'move', words: 'Move to Done' }],
      },
    ]);
  });

  it('never holds an address, a webhook, a sender, a repository or what an AI step is asked', () => {
    const rules = [
      rule({
        trigger: { kind: 'email_received', board: 'b1', sender: SECRETS.domain },
        steps: [
          {
            kind: 'email',
            to: { addresses: [SECRETS.address, 'b@example.com'] },
            subject: SECRETS.subject,
            body: SECRETS.body,
          },
          {
            kind: 'notify',
            via: 'webhook',
            webhook: SECRETS.webhookId,
            name: SECRETS.webhook,
            text: SECRETS.message,
          },
          {
            kind: 'notify',
            via: 'slack',
            webhook: SECRETS.webhookId,
            name: SECRETS.webhook,
            text: SECRETS.message,
          },
          {
            kind: 'notify',
            via: 'teams',
            webhook: SECRETS.webhookId,
            name: SECRETS.webhook,
            text: SECRETS.message,
          },
          { kind: 'ai', task: 'summarise', field: 'f-contact' },
          { kind: 'set_field', field: 'f-contact', value: { text: SECRETS.setValue } },
          { kind: 'set_field', field: 'f-contact', value: { text: SECRETS.link } },
        ],
      }),
      rule({ trigger: { kind: 'pull_request_merged', repositories: [SECRETS.repo] } }),
      rule({
        trigger: { kind: 'pull_request_checks', result: 'failing', repositories: [SECRETS.repo] },
      }),
      rule({ trigger: { kind: 'incoming_webhook' } as never }),
    ];
    const text = JSON.stringify(rules.map((r) => automationRuleSummary(r, OUTLINE)));
    for (const secret of Object.values(SECRETS)) expect(text).not.toContain(secret);
    expect(text).not.toContain('example.com');
    const [first] = rules.map((r) => automationRuleSummary(r, OUTLINE));
    expect(first!.trigger).toBe('When Email Received on Support');
    expect(first!.steps.find((s) => s.kind === 'notify' && s.via === 'slack')).toBeDefined();
    expect(first!.steps.map((s) => s.words)).toEqual([
      'Email 2 Addresses',
      'Send to Webhook',
      'Post to Slack',
      'Post to Microsoft Teams',
      SUMMARY_AI_STEP,
      'Set Contact',
      'Set Contact',
    ]);
  });

  it('keeps a short typed value that is no address, as the Rules list does', () => {
    const summary = automationRuleSummary(
      rule({ steps: [{ kind: 'set_field', field: 'f-contact', value: { text: 'Front desk' } }] }),
      OUTLINE,
    );
    expect(summary.steps).toEqual([{ kind: 'set_field', words: 'Set Contact Front desk' }]);
  });

  it('carries only the keys of the allow-list', () => {
    const summary = automationRuleSummary(rule({}), OUTLINE);
    expect(Object.keys(summary).sort()).toEqual(
      ['conditions', 'id', 'made', 'name', 'on', 'paused', 'picks', 'steps', 'trigger'].sort(),
    );
    expect(Object.keys(summary.made).sort()).toEqual(['at', 'by']);
  });
});
