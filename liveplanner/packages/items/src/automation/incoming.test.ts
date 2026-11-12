import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  INCOMING_WEBHOOK_PERSON,
  NO_CARDS_NAMED,
  WEBHOOK_BODY_MAX,
  WEBHOOK_VALUE_MAX,
  cardlessCard,
  incomingTriggerWords,
  readHookBody,
  runsWithoutCard,
  webhookPathOf,
  webhookPathsIn,
  webhookValues,
} from './index';
import { fillValues, isKnownValue, unknownValueIn, type ValueContext } from './values';
import { readRuleBody } from './validate';
import { planActions } from './plan-actions';
import { triggerMatches, TRIGGER_EVENT_KINDS, type AutomationEvent } from './matches';
import { ruleSentence } from './sentence';
import { BUG, NOW, OUTLINE, ZONE, bug, ctxFor, ruleBody } from './test-fixtures';

// docs/specs/026-plan/automations.md "Incoming Webhook", "Values".
describe('a webhook value’s path', () => {
  it('is 1 to 5 names of letters, digits, _ or -, after webhook.', () => {
    expect(webhookPathOf('webhook.build')).toEqual(['build']);
    expect(webhookPathOf('webhook.a-b.c_d.0.e.F9')).toEqual(['a-b', 'c_d', '0', 'e', 'F9']);
    expect(webhookPathOf('webhook.a.b.c.d.e.f')).toBeNull();
    expect(webhookPathOf('webhook.')).toBeNull();
    expect(webhookPathOf('webhook.a..b')).toBeNull();
    expect(webhookPathOf('webhook.a b')).toBeNull();
    expect(webhookPathOf(`webhook.${'x'.repeat(65)}`)).toBeNull();
    expect(webhookPathOf(`webhook.${'x'.repeat(64)}`)).toEqual(['x'.repeat(64)]);
    expect(webhookPathOf('card.title')).toBeNull();
  });

  it('is checked in linear time however long and hostile the name', () => {
    const hostile = `webhook.${'a.'.repeat(50_000)}!`;
    expect(cpuMsOf(() => webhookPathOf(hostile))).toBeLessThan(cpuBudgetMs(50));
  });

  it('is a known value only where the rule is an Incoming Webhook rule', () => {
    expect(isKnownValue('webhook.build.status')).toBe(false);
    expect(isKnownValue('webhook.build.status', { webhook: true })).toBe(true);
    expect(unknownValueIn('{{webhook.a.b.c.d.e.f}}', { webhook: true })).toBe(
      'webhook.a.b.c.d.e.f',
    );
  });
});

describe('the values a rule names', () => {
  it('are every {{webhook.…}} in its steps’ text, once each, wherever it sits', () => {
    const rule = ruleBody({
      steps: [
        { kind: 'comment', text: '{{webhook.a}} {{ webhook.b.c }} {{card.title}} {{webhook.a}}' },
        { kind: 'set_field', field: 'title', value: { text: '{{webhook.d}}' } },
        { kind: 'set_field', field: 'points', value: { number: 3 } },
        {
          kind: 'if',
          conditions: [],
          then: [{ kind: 'comment', text: '{{webhook.e}}' }],
          else: [],
        },
      ],
    });
    expect(webhookPathsIn(rule.steps)).toEqual(['a', 'b.c', 'd', 'e']);
  });

  it('read strings (cut at 500), numbers and booleans; never objects, lists, null or the prototype', () => {
    const payload = {
      s: 'x'.repeat(WEBHOOK_VALUE_MAX + 10),
      n: 4.5,
      inf: Number.POSITIVE_INFINITY,
      t: false,
      o: { deep: { er: 'yes' } },
      list: ['zero', { one: 1 }],
      nil: null,
    };
    expect(
      webhookValues(payload, [
        's',
        'n',
        'inf',
        't',
        'o',
        'o.deep.er',
        'list',
        'list.0',
        'list.1.one',
        'list.01',
        'list.x',
        'list.9',
        'nil',
        'nil.x',
        'missing',
        's.length',
        'constructor',
        '__proto__',
      ]),
    ).toEqual({
      s: 'x'.repeat(WEBHOOK_VALUE_MAX),
      n: 4.5,
      t: false,
      'o.deep.er': 'yes',
      'list.0': 'zero',
      'list.1.one': 1,
    });
  });
});

describe('a call’s body', () => {
  it('names up to 10 cards by number, each once, beside the payload', () => {
    expect(readHookBody({ cards: [3, 1, 3], x: 1 })).toEqual({
      cards: [3, 1],
      payload: { cards: [3, 1, 3], x: 1 },
    });
    expect(readHookBody({ x: 1 })).toEqual({ cards: [], payload: { x: 1 } });
    expect(readHookBody({ cards: [] })).toEqual({ cards: [], payload: { cards: [] } });
  });

  it('is refused when it isn’t an object or its cards aren’t numbers', () => {
    for (const raw of [null, [1], 'x', 3, undefined])
      expect(readHookBody(raw)).toEqual({ error: 'The body must be a JSON object' });
    for (const cards of [
      '1',
      [0],
      [-1],
      [1.5],
      ['1'],
      [2 ** 31],
      Array.from({ length: 11 }, (_, i) => i + 1),
    ])
      expect(readHookBody({ cards })).toHaveProperty('error');
  });

  it('caps at 16 KB', () => {
    expect(WEBHOOK_BODY_MAX).toBe(16_384);
  });
});

describe('a rule with no card', () => {
  it('runs only with no conditions and only Create Card (copying and linking nothing) and outgoing actions', () => {
    const notify = { kind: 'notify', via: 'slack', webhook: 'w1', text: 'Hi' } as const;
    const create = { kind: 'create_card', type: 'bug', title: 'New' } as const;
    expect(runsWithoutCard(ruleBody({ steps: [create, notify] }))).toBe(true);
    expect(runsWithoutCard(ruleBody({ steps: [] }))).toBe(false);
    expect(runsWithoutCard(ruleBody({ steps: [{ ...create, copy: ['labels'] }] }))).toBe(false);
    expect(runsWithoutCard(ruleBody({ steps: [{ ...create, copy: [] }] }))).toBe(true);
    expect(runsWithoutCard(ruleBody({ steps: [{ ...create, linkField: 'f' }] }))).toBe(false);
    expect(runsWithoutCard(ruleBody({ steps: [{ kind: 'flag' }] }))).toBe(false);
    expect(
      runsWithoutCard(
        ruleBody({ steps: [create], conditions: [{ kind: 'type', types: ['bug'] }] }),
      ),
    ).toBe(false);
  });

  it('walks a blank card whose card values read nothing', () => {
    const blank = cardlessCard();
    expect(blank).toMatchObject({ id: '', key: 0, fields: {} });
    const plan = planActions(
      [{ kind: 'create_card', type: 'bug', title: 'v{{webhook.v}} {{card.key}}{{card.title}}' }],
      {
        ...ctxFor(blank),
        webhook: { v: '2' },
        cardless: true,
      },
    );
    expect(plan).toMatchObject({ created: [{ type: 'bug', fields: { title: 'v2' } }] });
  });

  it('logs why it was skipped, and its trigger line says how many cards the call named', () => {
    expect(NO_CARDS_NAMED).toBe("No cards named: this rule's steps need a card");
    expect(incomingTriggerWords(0)).toBe('Webhook received: no card');
    expect(incomingTriggerWords(1)).toBe('Webhook received: 1 card');
    expect(incomingTriggerWords(2)).toBe('Webhook received: 2 cards');
  });
});

describe('filling a webhook value', () => {
  const ctx = (extra: Partial<ValueContext> = {}): ValueContext => ({
    card: bug({ title: 'Real title' }, { key: 48 }),
    type: BUG,
    outline: OUTLINE,
    url: 'https://app.test/c/48',
    person: INCOMING_WEBHOOK_PERSON.name,
    rule: 'From CI',
    now: NOW,
    timeZone: ZONE,
    ...extra,
  });

  it('puts the call’s value in as plain text, once: a value or markup in it stays as written', () => {
    const webhook = { s: '{{card.title}} <b>x</b>', n: 3, t: true };
    expect(
      fillValues(
        '{{webhook.s}}|{{webhook.n}}|{{webhook.t}}|{{webhook.none}}|{{person}}',
        ctx({ webhook }),
      ),
    ).toBe('{{card.title}} <b>x</b>|3|true||Incoming webhook');
    expect(fillValues('{{webhook.s}}', ctx())).toBe('');
  });

  it('reads nothing for the card’s values in a run with no card', () => {
    expect(
      fillValues('[{{card.title}}][{{card.field.Severity}}][{{rule}}]', ctx({ cardless: true })),
    ).toBe('[][][From CI]');
  });
});

describe('the trigger', () => {
  it('is saved bare, its text may name webhook values, and nobody is behind it', () => {
    const saved = readRuleBody(
      ruleBody({
        trigger: { kind: 'incoming_webhook' },
        steps: [
          { kind: 'comment', text: '{{webhook.a}}' },
          { kind: 'create_card', type: 'bug', title: '{{webhook.t}}' },
          { kind: 'notify', via: 'slack', webhook: 'w1', text: '{{webhook.m}}' },
          {
            kind: 'if',
            conditions: [{ kind: 'type', types: ['bug'] }],
            then: [{ kind: 'comment', text: '{{webhook.b}}' }],
            else: [],
          },
          {
            kind: 'for',
            related: { kind: 'children' },
            conditions: [],
            then: [{ kind: 'comment', text: '{{webhook.c}} {{trigger.key}}' }],
          },
        ],
      }),
    );
    expect(saved).toHaveProperty('body.trigger', { kind: 'incoming_webhook' });
    expect(
      readRuleBody(ruleBody({ steps: [{ kind: 'comment', text: '{{webhook.a}}' }] })),
    ).toMatchObject({ error: 'automation_value_unknown', path: 'steps.0.text' });
    expect(
      readRuleBody(
        ruleBody({
          trigger: { kind: 'incoming_webhook' },
          conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
        }),
      ),
    ).toEqual({
      error: 'automation_condition_unsupported',
      path: 'conditions.0',
      message: 'An incoming webhook has no person behind it to check',
    });
    expect(
      readRuleBody(
        ruleBody({
          trigger: { kind: 'incoming_webhook' },
          steps: [{ kind: 'assign', to: { trigger: true } }],
        }),
      ),
    ).toMatchObject({ error: 'automation_condition_unsupported', path: 'steps.0' });
  });

  it('hears only an incoming event for its own rule, which no write builds', () => {
    expect(TRIGGER_EVENT_KINDS.incoming_webhook).toEqual(['incoming']);
    const event = {
      id: 'w:1:c',
      kind: 'incoming',
      cardId: 'c',
      by: INCOMING_WEBHOOK_PERSON,
      role: 'system',
      ruleId: 'r1',
      at: NOW,
    } satisfies AutomationEvent;
    expect(triggerMatches({ kind: 'incoming_webhook' }, event, 'r1')).toBe(true);
    expect(triggerMatches({ kind: 'incoming_webhook' }, event, 'r2')).toBe(false);
    expect(triggerMatches({ kind: 'incoming_webhook' }, { ...event, kind: 'manual' }, 'r1')).toBe(
      false,
    );
    expect(triggerMatches({ kind: 'manual' }, event, 'r1')).toBe(false);
  });

  it('reads “When a Webhook Is Received”', () => {
    expect(
      ruleSentence(ruleBody({ trigger: { kind: 'incoming_webhook' }, steps: [] }), {
        statuses: [],
        types: [],
      } as never).slice(0, 2),
    ).toEqual([{ word: 'When a' }, { chip: 'Webhook Is Received', trigger: true }]);
  });
});
