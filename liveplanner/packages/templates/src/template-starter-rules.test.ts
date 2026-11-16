// A Plan template's starter rules (docs/specs/026-plan/plan-templates.md "Starter rules").
import { describe, expect, it } from 'vitest';
import {
  automationTemplate,
  readRuleBody,
  ruleHasAction,
  type AutomationRuleBody,
} from '@liveplanner/items';
import { buildTemplateTabs } from './template-tab';
import { PLAN_TEMPLATE_KINDS, STARTER_RULE_KINDS, hasStarterRules } from './plan-template-kinds';
import {
  STARTER_STEP_KINDS,
  TEMPLATE_STARTER_RULES,
  starterOf,
  starterSafe,
  templateStarterRules,
} from './template-starter-rules';

// Every step kind a rule holds, inside a For Related Cards too.
const kindsOf = (steps: readonly unknown[]): string[] =>
  steps.flatMap((s) => {
    const step = s as { kind: string; then?: unknown[] };
    return [step.kind, ...(step.then ? kindsOf(step.then) : [])];
  });

describe('templateStarterRules', () => {
  it('lists the same templates in the leaf as in the catalogue', () => {
    expect(Object.keys(TEMPLATE_STARTER_RULES).sort()).toEqual([...STARTER_RULE_KINDS].sort());
  });

  it.each(STARTER_RULE_KINDS)('fills every starter rule %s lists, none left out', (kind) => {
    const rules = templateStarterRules(kind, 'Europe/London');
    expect(rules.map((r) => r.body.name)).toEqual(
      TEMPLATE_STARTER_RULES[kind].map((s) => automationTemplate(s.id)!.name),
    );
    for (const { body } of rules) {
      // As a save reads it: nothing to pick left, and an action.
      const read = readRuleBody(JSON.parse(JSON.stringify(body)));
      expect(read).not.toHaveProperty('error');
      expect(ruleHasAction(body)).toBe(true);
      expect(body.timeZone).toBe('Europe/London');
    }
  });

  it.each(STARTER_RULE_KINDS)(
    'never sends an email, calls a webhook or asks the AI (%s)',
    (kind) => {
      for (const { body } of templateStarterRules(kind, 'UTC')) {
        const kinds = kindsOf(body.steps);
        expect(kinds.every((k) => STARTER_STEP_KINDS.has(k))).toBe(true);
        for (const outgoing of ['email', 'notify', 'mention', 'ai', 'create_card', 'copy_card'])
          expect(kinds).not.toContain(outgoing);
        expect(body.trigger.kind).not.toBe('incoming_webhook');
      }
    },
  );

  it('ships the field, move and comment rules on, and the ones that need people off without Assign in Turn', () => {
    const rules = templateStarterRules('sprint-board', 'UTC');
    const by = Object.fromEntries(rules.map((r) => [r.body.name, r]));
    expect(by['Stamp the Finish Date']!.on).toBe(true);
    expect(by['Stamp the Finish Date']!.body.trigger).toEqual({
      kind: 'card_moved',
      to: ['sb-done'],
    });
    expect(by['Stamp the Finish Date']!.body.steps[0]).toMatchObject({
      kind: 'set_field',
      field: 'f-completed-on',
    });
    expect(by['Close the Parent']!.on).toBe(true);
    expect(by['Close the Parent']!.body.steps).toEqual([{ kind: 'move', status: 'sb-done' }]);
    for (const off of ['Triage New Bugs', 'Route Reviews']) {
      expect(by[off]!.on).toBe(false);
      expect(kindsOf(by[off]!.body.steps)).not.toContain('assign');
    }
    expect(by['Triage New Bugs']!.body.conditions).toEqual([{ kind: 'type', types: ['sb-bug'] }]);
    expect(by['Route Reviews']!.body.trigger).toEqual({ kind: 'card_moved', to: ['sb-review'] });
  });

  it('starts every template with a board with at least one rule on, and only those', () => {
    const boarded = PLAN_TEMPLATE_KINDS.filter((kind) =>
      buildTemplateTabs({ id: 't', name: 'T' }, kind, () => 'x')
        .flatMap((t) => t.elements)
        .some((e) => (e as { shape?: string }).shape === 'plan-board'),
    );
    expect([...STARTER_RULE_KINDS].sort()).toEqual([...boarded].sort());
    for (const kind of boarded)
      expect(
        templateStarterRules(kind, 'UTC').some((r) => r.on),
        kind,
      ).toBe(true);
  });

  it('gives every other template, and a kind no template has, none', () => {
    for (const kind of PLAN_TEMPLATE_KINDS.filter((k) => !hasStarterRules(k)))
      expect(templateStarterRules(kind, 'UTC')).toEqual([]);
    expect(templateStarterRules('not-a-template', 'UTC')).toEqual([]);
  });
});

describe('starterSafe', () => {
  const body = (steps: unknown[]) => ({ steps }) as unknown as AutomationRuleBody;

  it('takes moves, fields, labels, flags, assignees and comments', () => {
    expect(
      starterSafe(
        body([
          { kind: 'move', status: 'done' },
          { kind: 'comment', text: 'Hi' },
        ]),
      ),
    ).toBe(true);
  });

  it('refuses an email, a webhook, or either inside For Related Cards', () => {
    expect(starterSafe(body([{ kind: 'email' }]))).toBe(false);
    expect(starterSafe(body([{ kind: 'notify', webhook: 'w' }]))).toBe(false);
    expect(starterSafe(body([{ kind: 'for', then: [{ kind: 'email' }] }]))).toBe(false);
    expect(starterSafe(body([{ kind: 'for', then: [{ kind: 'flag' }] }]))).toBe(false);
  });
});

describe('starterOf', () => {
  const fill = (steps: unknown[], picks: { path: string; pick: string }[]) =>
    ({
      body: { name: 'R', trigger: { kind: 'manual' }, conditions: [], steps },
      picks,
    }) as unknown as Parameters<typeof starterOf>[0];
  const turn = { kind: 'assign', to: { rotate: [] } };

  it('leaves out a rule with a column, a type or a field still to pick', () => {
    expect(
      starterOf(fill([{ kind: 'move', status: '' }], [{ path: 'steps.0', pick: 'column' }]), true),
    ).toBeNull();
  });

  it('leaves out a rule whose people to pick sit inside a step, or that has nothing left once they go', () => {
    expect(
      starterOf(
        fill([{ kind: 'for', then: [turn] }], [{ path: 'steps.0.then.0', pick: 'people' }]),
        false,
      ),
    ).toBeNull();
    expect(starterOf(fill([turn], [{ path: 'steps.0', pick: 'people' }]), false)).toBeNull();
  });

  it('leaves out a rule with a step a starter may not take', () => {
    expect(starterOf(fill([{ kind: 'archive' }], []), true)).toBeNull();
  });
});
