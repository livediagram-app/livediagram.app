import { describe, expect, it } from 'vitest';
import { WORDED_PRODUCT } from '../testing/product';
import { AT, KINDS, TABS, listOf, listed, runOf } from '../testing/rules';
import {
  listedRule,
  listedRuleBody,
  listedRun,
  resolveRule,
  resolveRuleTab,
  ruleNamesOf,
  runResultWords,
} from './rule-listing';
import { namedRuleBody } from './rule-names';

// liveworkspace/docs/specs/018-automations/automations.md "Agents": a rule as list_rules reads it, its sentence in
// the kinds' own words, and a rule, a tab and a person named by id or name.
const names = ruleNamesOf(listOf(), {
  kinds: KINDS,
  templateNames: new Map([['retro', 'Retrospective']]),
});

describe('a listed rule', () => {
  it('reads as the Rules list says it', () => {
    expect(listedRule(listed(), KINDS, names)).toEqual({
      id: 'r1',
      name: 'Comments by email',
      on: true,
      trigger: 'comment_added',
      sentence: 'When Comment Added then Send Email to the owner',
      lastRun: null,
      runsThisWeek: 0,
    });
  });

  it('says it paused, what it needs, when it last ran and a time trigger’s next run', () => {
    const rule = listed({
      enabled: false,
      trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
      steps: [{ kind: 'add_tab', template: 'retro', name: 'Retro' }],
      paused: { reason: 'The template is gone', at: AT },
      needs: ['Tab t9 is gone'],
      stats: { lastRunAt: AT, nextAt: AT + 60_000, runsThisWeek: 4, failuresInARow: 10 },
    });
    const line = listedRule(rule, KINDS, names);
    expect(line).toMatchObject({
      on: false,
      paused: 'The template is gone',
      needsAttention: ['Tab t9 is gone'],
      lastRun: '2026-11-01T09:00:00.000Z',
      nextRun: '2026-11-01T09:01:00.000Z',
      runsThisWeek: 4,
    });
    expect(line.sentence).toContain('Add a Tab “Retro” from Retrospective');
    const off = listed({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    expect(listedRule(off, KINDS, names).nextRun).toBeNull();
  });

  it('gives an Incoming Webhook rule’s address and whether its secret is made, never the secret', () => {
    const hook = { url: 'https://api.example/hooks/x', secret: null };
    const rule = listed({ trigger: { kind: 'incoming_webhook' }, hook });
    expect(listedRule(rule, KINDS, names).hook).toEqual({ url: hook.url, secret: false });
    const made = { ...hook, secret: { last4: 'abcd', madeAt: AT, usedAt: null } };
    expect(listedRule(listed({ hook: made }), KINDS, names).hook).toEqual({
      url: hook.url,
      secret: true,
    });
  });

  it('reads a template as a template without the product’s titles', () => {
    const plain = ruleNamesOf({}, { kinds: KINDS });
    expect(plain.templates).toBeUndefined();
    expect(plain.tabs!.size).toBe(0);
    expect(plain.people!.size).toBe(0);
  });

  it('answers the body whole, as change_rules writes it, with who made and changed it', () => {
    expect(listedRuleBody(listed())).toEqual({
      id: 'r1',
      name: 'Comments by email',
      enabled: true,
      trigger: { kind: 'comment_added' },
      conditions: [],
      steps: [{ kind: 'email', to: { owner: true }, subject: 'New comment', body: '{{comment}}' }],
      chain: false,
      timeZone: 'UTC',
      made: { by: 'Ana Costa', at: '2026-11-01T09:00:00.000Z' },
      edited: { by: 'Ana Costa', at: '2026-11-01T09:00:00.000Z', ai: true },
    });
  });
});

describe('a listed run', () => {
  it('reads as the Audit Trail shows it, a tick or a cross a line', () => {
    expect(listedRun(runOf())).toEqual({
      id: 'run1',
      rule: 'Comments by email',
      tab: 'Overview',
      at: '2026-11-01T09:00:00.000Z',
      result: 'done',
      tookMs: 12,
      steps: ['Ana Costa commented', '✗ Tab is Retro', '✓ Sent email to the owner (Already so)'],
    });
  });

  it('names no tab for a run about the whole item, and says why it failed', () => {
    const run = listedRun(runOf({ subject: null, result: 'failed', reason: 'No such template' }));
    expect(run.tab).toBeNull();
    expect(run.reason).toBe('No such template');
    expect(runResultWords({ result: 'failed', reason: 'No such template' })).toBe(
      'Failed (No such template)',
    );
    expect(runResultWords({ result: 'no_match' })).toBe('No Match');
  });
});

describe('naming a rule and a tab', () => {
  const rules = Array.from({ length: 12 }, (_, i) => listed({ id: `r${i}`, name: `Rule ${i}` }));

  it('finds a rule by id, else by exact name, case and outer spaces aside', () => {
    expect(resolveRule('r3', rules, 'document')).toMatchObject({ ok: true, value: { id: 'r3' } });
    expect(resolveRule('  rule 4 ', rules, 'document')).toMatchObject({ value: { id: 'r4' } });
  });

  it('refuses an unknown rule with the first ten there are', () => {
    const found = resolveRule('Nope', rules, 'document');
    expect(found).toMatchObject({ ok: false, code: 'rule_unknown' });
    expect(!found.ok && found.message).toMatch(
      /^No rule "Nope"\. The rules: r0 "Rule 0"; .*r9 "Rule 9"; …$/,
    );
    expect(resolveRule('Nope', rules.slice(0, 1), 'document')).toMatchObject({
      message: 'No rule "Nope". The rules: r0 "Rule 0"',
    });
    expect(resolveRule('Nope', [], WORDED_PRODUCT.word)).toMatchObject({
      message: 'No rule "Nope": this drawing has no rules. Add one with add.',
    });
  });

  it('finds a tab by id or name, and refuses one it lacks with the tabs', () => {
    expect(resolveRuleTab('retro', TABS)).toEqual({ ok: true, value: TABS[1] });
    expect(resolveRuleTab('Plans', TABS)).toEqual({
      ok: false,
      code: 'tab_unknown',
      message: 'No tab "Plans". The tabs: t1 "Overview"; t2 "Retro"',
    });
  });

  it('puts a body’s tabs and people back to ids, keeping what the item lacks as written', () => {
    const body = {
      trigger: { kind: 'edited', minutes: 30, tab: 'Overview' },
      conditions: [
        { kind: 'tab', tabs: ['retro', 'Gone'] },
        { kind: 'who', who: [{ person: 'ana costa' }, { role: 'agent' }] },
      ],
      steps: [
        { kind: 'email', to: { person: 'Nobody' }, subject: 's', body: 'b' },
        { kind: 'add_tab', template: 'retro', name: 'Retro' },
        { kind: 'ai', task: 'summarise', tab: 'run' },
      ],
    };
    expect(namedRuleBody(body, listOf())).toEqual({
      trigger: { kind: 'edited', minutes: 30, tab: 't1' },
      conditions: [
        { kind: 'tab', tabs: ['t2', 'Gone'] },
        { kind: 'who', who: [{ person: 'u1' }, { role: 'agent' }] },
      ],
      steps: [
        { kind: 'email', to: { person: 'Nobody' }, subject: 's', body: 'b' },
        { kind: 'add_tab', template: 'retro', name: 'Retro' },
        { kind: 'ai', task: 'summarise', tab: 'run' },
      ],
    });
    expect(body.trigger.tab).toBe('Overview');
    expect(namedRuleBody({ tab: 'Overview', person: 'Ana Costa' }, {})).toEqual({
      tab: 'Overview',
      person: 'Ana Costa',
    });
  });
});
