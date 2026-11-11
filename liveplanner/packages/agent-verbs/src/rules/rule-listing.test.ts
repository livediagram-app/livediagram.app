import { describe, expect, it } from 'vitest';
import { listed, listOf, NOW, PLAN, run } from '../testing/rules';
import {
  listedRule,
  listedRuleBody,
  listedRun,
  resolveRule,
  runResultWords,
  sentenceText,
} from './rule-listing';
import { sentenceOutlineOf } from './rule-state';

// docs/specs/026-plan/automations.md "Agents and the CLI": a rule's line, its body, a run's row, a rule by name.
const OUTLINE = sentenceOutlineOf({ list: listOf(), plan: PLAN });
const at = new Date(NOW).toISOString();

describe('a rule as agents read it', () => {
  it('reads its line: the sentence in words, on, last run and this week', () => {
    expect(listedRule(listed(), OUTLINE)).toEqual({
      id: 'r1',
      name: 'Done stamp',
      on: true,
      trigger: 'card_moved',
      sentence: 'When Card Moved to Done then Add Label shipped',
      lastRun: at,
      runsThisWeek: 3,
    });
  });

  it('says it is paused, what it needs and a time trigger’s next run', () => {
    const timed = listed({
      trigger: { kind: 'overdue', at: '09:00' },
      enabled: false,
      paused: { reason: 'The card is gone', at: NOW },
      needs: ['Column qa is gone'],
      stats: { lastRunAt: null, nextAt: NOW, runsThisWeek: 0, failuresInARow: 10 },
    });
    expect(listedRule(timed, OUTLINE)).toMatchObject({
      on: false,
      paused: 'The card is gone',
      needsAttention: ['Column qa is gone'],
      lastRun: null,
      nextRun: at,
    });
    expect(listedRule({ ...timed, stats: { ...timed.stats, nextAt: null } }, OUTLINE).nextRun).toBe(
      null,
    );
  });

  it('answers the body whole, its stamps by name, an agent’s marked', () => {
    expect(listedRuleBody(listed())).toEqual({
      id: 'r1',
      name: 'Done stamp',
      enabled: true,
      trigger: { kind: 'card_moved', to: ['done'] },
      conditions: [],
      steps: [{ kind: 'add_label', label: 'shipped' }],
      chain: false,
      timeZone: 'Europe/London',
      made: { by: 'Ana Costa', at },
      edited: { by: 'Ana Costa', at, ai: true },
    });
  });

  it('words a rule on a plan read before its tabs were listed', () => {
    const outline = sentenceOutlineOf({ list: listOf(), plan: { ...PLAN, tabs: undefined } });
    const form = listed({ trigger: { kind: 'form_response', formTab: 'f_1' } });
    expect(listedRule(form, outline).sentence).toBe(
      'When Form Response on f_1 then Add Label shipped',
    );
  });

  it('joins a sentence’s words and chips', () => {
    expect(sentenceText([{ word: 'When' }, { chip: 'Card Created', trigger: true }])).toBe(
      'When Card Created',
    );
  });
});

describe('a run as agents read it', () => {
  it('reads its card, result and step lines as the Audit Trail shows them', () => {
    expect(listedRun(run())).toEqual({
      id: 'run1',
      rule: 'Done stamp',
      card: '#12 Basket',
      at,
      result: 'done',
      tookMs: 7,
      steps: [
        'Ana Costa moved #12 to Done',
        '✓ Card Type is Bug',
        '✓ Add Label shipped (Already so)',
        '✗ Move to Done',
        '✓ For each Child Card: on 1 related card',
      ],
    });
    expect(
      listedRun(run({ card: null, result: 'skipped', reason: 'Chain stopped' })),
    ).toMatchObject({ card: null, reason: 'Chain stopped' });
  });

  it('words a result as its pill, with the reason', () => {
    expect(runResultWords({ result: 'no_match' })).toBe('No Match');
    expect(runResultWords({ result: 'failed', reason: 'The card is gone' })).toBe(
      'Failed (The card is gone)',
    );
  });
});

describe('resolveRule', () => {
  const rules = [listed(), listed({ id: 'r2', name: 'Escalate' })];
  it('names a rule by id or exact name, case aside', () => {
    expect(resolveRule('r2', rules)).toMatchObject({ ok: true, rule: { name: 'Escalate' } });
    expect(resolveRule(' done STAMP ', rules)).toMatchObject({ ok: true, rule: { id: 'r1' } });
  });

  it('refuses a name matching none with the rules there are', () => {
    expect(resolveRule('Nope', rules)).toEqual({
      ok: false,
      code: 'rule_unknown',
      message: 'No rule "Nope". The rules: r1 "Done stamp"; r2 "Escalate"',
    });
    const many = Array.from({ length: 11 }, (_, i) => listed({ id: `r${i}`, name: `R${i}` }));
    expect((resolveRule('Nope', many) as { message: string }).message).toMatch(/r9 "R9"; …$/);
    expect(resolveRule('Nope', [])).toMatchObject({
      message: 'No rule "Nope": this plan has no rules. Add one with add.',
    });
  });
});
