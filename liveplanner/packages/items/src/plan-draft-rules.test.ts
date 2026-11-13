import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { PLAN_DRAFT_COLOURS, checkPlanDraft, readPlanDraft, type PlanDraft } from './plan-draft';
import {
  planDraftProblems,
  planFromDraft,
  withColumnName,
  withFieldName,
  withTypeName,
} from './plan-draft-preview';
import {
  PLAN_DRAFT_RULES_MAX,
  planDraftNeedWords,
  planDraftRuleBodies,
  planDraftRuleNames,
  planDraftRuleSentence,
  planDraftRuleView,
  readPlanDraftRules,
  renameFollows,
  starterRuleRefusal,
  type PlanDraftRule,
} from './plan-draft-rules';
import type { AutomationCondition, AutomationRuleBody } from './automation/types';

// docs/specs/026-plan/describe-a-plan.md "Starter rules" and "The preview": a draft's rules read by Describe a Rule's
// reader, kept named, checked in the preview, followed through renames and made by Make Plan.
const PROMPT = 'A hiring pipeline with Applied, Screen, Interview and Offer, and a Candidate card';

const base = (): PlanDraft => ({
  title: 'Hiring Pipeline',
  columns: ['Applied', 'Screen', 'Interview', 'Offer'],
  cardTypes: [
    {
      name: 'Candidate',
      color: PLAN_DRAFT_COLOURS[0]!,
      glyph: 'person',
      builtInFields: ['description', 'assignee'],
      fields: [
        { name: 'Role', kind: 'text' },
        { name: 'Offer Date', kind: 'date' },
      ],
    },
  ],
});

const stamp: PlanDraftRule = {
  name: 'Stamp Offer Date',
  on: true,
  trigger: { kind: 'card_moved', to: ['Offer'] },
  conditions: [{ kind: 'type', types: ['Candidate'] }],
  steps: [{ kind: 'set_field', field: 'Offer Date', value: { date: { today: 0 } } }],
};

const checked = (d: PlanDraft = base()) => {
  const c = checkPlanDraft(d);
  if (!c.ok) throw new Error(c.message);
  return c;
};

describe('readPlanDraftRules', () => {
  it('reads a rule against the drafted plan and keeps it named, on', () => {
    const raw = [
      {
        name: 'stamp offer date',
        trigger: { kind: 'card_moved', to: ['offer'] },
        conditions: [{ kind: 'type', types: ['candidate'] }],
        steps: [{ kind: 'set_field', field: 'offer date', value: { today: 0 } }],
      },
    ];
    const { rules, dropped } = readPlanDraftRules(raw, PROMPT, checked());
    expect(dropped).toBe(0);
    expect(rules).toEqual([{ ...stamp, name: 'stamp offer date' }]);
  });

  it('keeps a built-in field by its id, and reads a type with no fields of its own', () => {
    const d = base();
    d.cardTypes.push({ ...d.cardTypes[0]!, name: 'Referral', fields: [] });
    const raw = [
      {
        name: 'Due In A Week',
        trigger: { kind: 'card_created' },
        conditions: [{ kind: 'type', types: ['Referral'] }],
        steps: [{ kind: 'set_field', field: 'Due Date', value: { date: { today: 7 } } }],
      },
    ];
    expect(readPlanDraftRules(raw, PROMPT, checked(d)).rules[0]).toMatchObject({
      conditions: [{ kind: 'type', types: ['Referral'] }],
      steps: [{ kind: 'set_field', field: 'due', value: { date: { today: 7 } } }],
    });
  });

  it('cleans a rule’s texts as Describe a Rule does, links the request lacks removed', () => {
    const raw = [
      {
        name: 'Welcome',
        trigger: { kind: 'card_created' },
        conditions: [],
        steps: [{ kind: 'comment', text: 'Read https://evil.example/x\u0007 first' }],
      },
    ];
    const { rules } = readPlanDraftRules(raw, PROMPT, checked());
    expect(rules[0]!.steps).toEqual([{ kind: 'comment', text: 'Read first' }]);
  });

  it('reads at most two, and leaves out any that does not read, is no starter or names what the draft lacks', () => {
    const ok = {
      name: 'Flag',
      trigger: { kind: 'card_created' },
      conditions: [],
      steps: [{ kind: 'flag' }],
    };
    expect(readPlanDraftRules([ok, ok, ok], PROMPT, checked()).rules).toHaveLength(
      PLAN_DRAFT_RULES_MAX,
    );
    // Two of one name: the second made free, as Describe a Rule makes a name free among the plan's rules.
    expect(readPlanDraftRules([ok, ok], PROMPT, checked()).rules.map((r) => r.name)).toEqual([
      'Flag',
      'Flag 2',
    ]);
    const broken = { name: 'Broken', trigger: { kind: 'nope' }, conditions: [], steps: [] };
    const ai = { ...ok, steps: [{ kind: 'ai', task: 'summarise' }] };
    const gone = { ...ok, steps: [{ kind: 'move', status: 'Hired' }] };
    expect(readPlanDraftRules([broken, ai], PROMPT, checked())).toEqual({ rules: [], dropped: 2 });
    expect(readPlanDraftRules([gone], PROMPT, checked())).toEqual({ rules: [], dropped: 1 });
    expect(readPlanDraftRules('rules', PROMPT, checked())).toEqual({ rules: [], dropped: 0 });
  });

  it('rides readPlanDraft: rules only when one is kept, and how many were left out', () => {
    const reply = (rules: unknown) => ({
      outcome: 'plan',
      plan: { ...base(), cardTypes: [{ ...base().cardTypes[0], builtInFields: [] }], rules },
    });
    const read = readPlanDraft(reply([stamp, { name: 'x' }]), PROMPT);
    expect(read).toMatchObject({ draft: { rules: [{ name: 'Stamp Offer Date' }] }, dropped: 1 });
    const none = readPlanDraft(reply(undefined), PROMPT);
    expect(none).toEqual({ draft: expect.not.objectContaining({ rules: expect.anything() }) });
  });

  it('reads two hostile rules in linear time', () => {
    // One rule shared by every place: a huge list of huge rules, without the test itself holding millions.
    const condition = { kind: 'type', types: ['Candidate'] };
    const step = { kind: 'comment', text: 'y'.repeat(50_000) };
    const rule = {
      name: 'x'.repeat(50_000),
      trigger: { kind: 'card_created' },
      conditions: new Array(20_000).fill(condition),
      steps: new Array(20_000).fill(step),
    };
    const huge = new Array(20_000).fill(rule);
    const ms = cpuMsOf(() => readPlanDraftRules(huge, PROMPT, checked()));
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});

describe('starterRuleRefusal', () => {
  const rule = (over: Partial<AutomationRuleBody>) =>
    ({
      trigger: { kind: 'card_created' },
      conditions: [],
      steps: [{ kind: 'flag' }],
      ...over,
    }) as AutomationRuleBody;

  it('holds a rule to the starter’s kinds and counts', () => {
    expect(starterRuleRefusal(rule({}))).toBeNull();
    expect(starterRuleRefusal(rule({ trigger: { kind: 'comment_added' } }))?.path).toBe('trigger');
    const type: AutomationCondition = { kind: 'type', types: ['t'] };
    expect(starterRuleRefusal(rule({ conditions: [type, type, type, type] }))?.path).toBe(
      'conditions',
    );
    expect(
      starterRuleRefusal(rule({ conditions: [{ kind: 'who', who: [{ role: 'editor' }] }] }))?.path,
    ).toBe('conditions.0');
    expect(
      starterRuleRefusal(
        rule({ steps: [{ kind: 'flag' }, { kind: 'flag' }, { kind: 'flag' }, { kind: 'flag' }] }),
      )?.path,
    ).toBe('steps');
    expect(starterRuleRefusal(rule({ steps: [{ kind: 'archive' }] }))?.path).toBe('steps.0');
    expect(
      starterRuleRefusal(rule({ steps: [{ kind: 'assign', to: { person: 'Ana' } }] }))?.path,
    ).toBe('steps.0');
    expect(
      starterRuleRefusal(rule({ steps: [{ kind: 'assign', to: { trigger: true } }] })),
    ).toBeNull();
    expect(
      starterRuleRefusal(rule({ steps: [{ kind: 'assign', to: { nobody: true } }] })),
    ).toBeNull();
  });
});

describe('planDraftNeedWords', () => {
  it('says what a rule names that the plan won’t have', () => {
    expect(planDraftNeedWords({ kind: 'column', id: 'Offer' })).toBe(
      'This rule names the column “Offer”, which this plan won’t have.',
    );
    expect(planDraftNeedWords({ kind: 'type', id: 'Candidate' })).toContain(
      'card type “Candidate”',
    );
    expect(planDraftNeedWords({ kind: 'field', id: 'Role' })).toContain('field “Role”');
    expect(planDraftNeedWords({ kind: 'unheard', name: 'Votes' })).toBe(
      'Field Changed never hears Votes.',
    );
    expect(planDraftNeedWords({ kind: 'person', id: 'Ana' })).toBe(
      'This rule names something a new plan won’t have.',
    );
  });
});

describe('the preview’s rule problems', () => {
  const withRules = (rules: PlanDraftRule[], d = base()): PlanDraft => ({ ...d, rules });

  it('finds none in rules that read', () => {
    expect(planDraftProblems(withRules([stamp]))).toEqual([]);
  });

  it('asks for a rule’s name, and says both of a name given twice', () => {
    expect(planDraftProblems(withRules([{ ...stamp, name: ' ' }]))).toEqual([
      { path: 'rules.0.name', message: 'Give this rule a name.' },
    ]);
    expect(planDraftProblems(withRules([stamp, { ...stamp, name: 'stamp offer date' }]))).toEqual([
      { path: 'rules.0.name', message: 'Two rules are called “Stamp Offer Date”.' },
      { path: 'rules.1.name', message: 'Two rules are called “Stamp Offer Date”.' },
    ]);
  });

  it('says a rule names a column removed from the draft, once the plan reads', () => {
    const d = withRules([stamp], { ...base(), columns: ['Applied', 'Screen'] });
    expect(planDraftProblems(d)).toEqual([
      {
        path: 'rules.0',
        message: 'This rule names the column “Offer”, which this plan won’t have.',
      },
    ]);
  });

  it('holds a Set Field on a Checkbox to Yes or No, in the reader and the preview', () => {
    const d = base();
    d.cardTypes[0]!.fields.push({ name: 'Signed', kind: 'checkbox' });
    const sign = (text: string): PlanDraftRule => ({
      ...stamp,
      steps: [{ kind: 'set_field', field: 'Signed', value: { text } }],
    });
    expect(readPlanDraftRules([sign('Yes')], PROMPT, checked(d)).rules).toHaveLength(1);
    expect(readPlanDraftRules([sign('maybe')], PROMPT, checked(d))).toEqual({
      rules: [],
      dropped: 1,
    });
    expect(planDraftProblems({ ...d, rules: [sign('maybe')] })).toEqual([
      { path: 'rules.0', message: 'Signed is a Checkbox: set it to Yes or No' },
    ]);
  });

  it('says a rule that no longer reads or is no starter', () => {
    const odd = {
      ...stamp,
      trigger: { kind: 'card_moved', to: 'Offer' },
    } as unknown as PlanDraftRule;
    expect(planDraftProblems(withRules([odd]))).toEqual([
      { path: 'rules.0', message: expect.any(String) },
    ]);
    const archive = { ...stamp, steps: [{ kind: 'archive' }] } as PlanDraftRule;
    expect(planDraftProblems(withRules([archive]))).toEqual([
      { path: 'rules.0', message: 'A starter rule’s steps change only the card itself.' },
    ]);
  });
});

describe('renames that follow into the rules', () => {
  const d = (): PlanDraft => ({ ...base(), rules: [stamp] });

  it('renames a column in the rules that name it, and no other', () => {
    const both: PlanDraftRule = {
      ...stamp,
      trigger: { kind: 'card_moved', from: ['Applied'], to: ['Offer'] },
    };
    const next = withColumnName({ ...base(), rules: [both] }, 3, 'Offered');
    expect(next.columns[3]).toBe('Offered');
    expect(next.rules![0]!.trigger).toEqual({
      kind: 'card_moved',
      from: ['Applied'],
      to: ['Offered'],
    });
    expect(planDraftProblems(next)).toEqual([]);
  });

  it('follows through an empty name, and never onto a name another column has', () => {
    const cleared = withColumnName(d(), 3, '');
    expect(withColumnName(cleared, 3, 'Hired').rules![0]!.trigger).toEqual({
      kind: 'card_moved',
      to: ['Hired'],
    });
    const clash = withColumnName(d(), 3, 'screen');
    expect(clash.rules![0]!.trigger).toEqual({ kind: 'card_moved', to: ['Offer'] });
    expect(renameFollows(['A', 'A'], 0, 'B')).toBe(false);
    expect(renameFollows(['A'], 3, 'B')).toBe(false);
  });

  it('renames a card type and a field in the rules', () => {
    const twoTypes = d();
    twoTypes.cardTypes.push({ ...twoTypes.cardTypes[0]!, name: 'Referral' });
    const typed = withTypeName(twoTypes, 0, 'Applicant');
    expect(typed.cardTypes.map((t) => t.name)).toEqual(['Applicant', 'Referral']);
    expect(typed.rules![0]!.conditions).toEqual([{ kind: 'type', types: ['Applicant'] }]);
    const fielded = withFieldName(d(), 0, 1, 'Offered On');
    expect(fielded.cardTypes[0]!.fields[1]!.name).toBe('Offered On');
    expect(fielded.rules![0]!.steps).toEqual([
      { kind: 'set_field', field: 'Offered On', value: { date: { today: 0 } } },
    ]);
    // A field named alike in another type: the rule can't tell them apart, so it keeps the name.
    const two = d();
    two.cardTypes.push({ ...two.cardTypes[0]!, name: 'Referral' });
    expect(withFieldName(two, 0, 1, 'Offered On').rules![0]!.steps[0]).toMatchObject({
      field: 'Offer Date',
    });
    expect(withFieldName(d(), 5, 0, 'X').rules).toEqual([stamp]);
  });

  it('leaves a draft with no rules as it is', () => {
    expect(withColumnName(base(), 0, 'New').rules).toBeUndefined();
    expect(withTypeName(base(), 0, 'New').rules).toBeUndefined();
  });
});

describe('Make Plan’s rules', () => {
  it('names each rule against the board and types as made, in the person’s time zone, with its on', () => {
    const d: PlanDraft = { ...base(), rules: [stamp, { ...stamp, name: 'Second', on: false }] };
    const made = planFromDraft(d, { catalogue: null, statuses: [] }, () => 0.5, 'Europe/London');
    if (!made.ok) throw new Error(made.message);
    const offer = made.setup.columns.find((c) => c.name === 'Offer')!.status;
    const type = made.newTypes[0]!;
    const field = type.custom!.find((f) => f.label === 'Offer Date')!.id;
    expect(made.rules).toEqual([
      {
        on: true,
        body: {
          name: 'Stamp Offer Date',
          trigger: { kind: 'card_moved', to: [offer] },
          conditions: [{ kind: 'type', types: [type.id] }],
          steps: [{ kind: 'set_field', field, value: { date: { today: 0 } } }],
          chain: false,
          timeZone: 'Europe/London',
        },
      },
      expect.objectContaining({ on: false }),
    ]);
    expect(
      planFromDraft(base(), { catalogue: null, statuses: [] }).ok &&
        planFromDraft(base(), { catalogue: null, statuses: [] }),
    ).toMatchObject({ rules: [] });
  });

  it('leaves out a rule that doesn’t read', () => {
    const c = checked();
    const odd = { ...stamp, trigger: { kind: 'nope' } } as unknown as PlanDraftRule;
    expect(planDraftRuleBodies([odd, stamp], c, 'UTC')).toHaveLength(1);
    // A name left empty reads as a starter's (the preview asks for one before Make Plan can go).
    expect(planDraftRuleBodies([{ ...stamp, name: ' ' }], c, 'UTC')[0]!.body.name).toBe(
      'Starter Rule',
    );
    expect(planDraftRuleNames(c).names.people).toEqual([]);
  });
});

describe('the preview’s sentences', () => {
  const words = (rule: PlanDraftRule, d: PlanDraft = base(), planTypes = []) =>
    planDraftRuleSentence(rule, planDraftRuleView(d, planTypes))
      .map((p) => ('word' in p ? p.word : `[${p.chip}]`))
      .join(' ');

  it('reads a rule in the draft’s words, case aside', () => {
    const lower = { ...stamp, trigger: { kind: 'card_moved', to: ['offer'] } } as PlanDraftRule;
    expect(words(lower)).toContain('Offer');
    expect(words(stamp)).toContain('Offer Date');
    expect(words(stamp)).toContain('Candidate');
  });

  it('reads what the draft lacks as gone', () => {
    expect(words(stamp, { ...base(), columns: ['Applied'] })).toContain('a column no longer here');
  });

  it('reads a type the plan already has by its own fields', () => {
    const own = {
      id: 'cand',
      label: 'Candidate',
      newTitle: '',
      glyph: 'person' as const,
      color: '',
      fields: ['description', 'f1'],
      custom: [{ id: 'f1', label: 'Offer Date', kind: 'date' as const }],
    };
    expect(planDraftRuleView(base(), [own]).outline.types[0]!.fields).toEqual([
      'description',
      'Offer Date',
    ]);
    expect(words(stamp, base(), [own] as never)).toContain('Offer Date');
    const bare = { ...own, fields: ['description'], custom: undefined };
    expect(planDraftRuleView(base(), [bare]).outline.types[0]!.fields).toEqual(['description']);
  });
});
