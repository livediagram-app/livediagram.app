import { describe, expect, it } from 'vitest';
import {
  itemNames,
  itemRuleFormat,
  itemRuleSentence,
  itemRuleSummary,
  itemTriggerLine,
  itemValueOptions,
  readItemRule,
  ruleLeftToPick,
  rulesFromFile,
  sentenceText,
  undescribedKinds,
  type ItemEvent,
  type ItemPart,
  type ItemRule,
  type ItemRuleBody,
} from '@liveworkspace/automations/item';
import {
  AGENT_CHANGED_EVENT,
  AUTOMATIONS_TELEMETRY_CATEGORY,
  OWNER_CHANGED_EVENT,
  PAGES_DISAGREE_EVENT,
  PAGE_VERIFIED_EVENT,
  QUESTION_UNANSWERED_EVENT,
  REVIEW_DUE_EVENT,
  SUGGESTION_ADDED_EVENT,
  ownerToWords,
  DOCUMENT_ACTIONS,
  DOCUMENT_TRIGGERS,
  DOCUMENT_VALUES,
  KINDS,
  VERSION_NAMED_EVENT,
  VERSION_REF,
  VERSION_RESTORED_EVENT,
  versionWords,
} from './index';

// liveknowledge's Automations kinds (docs/specs/013-workspace/automations.md): the shared ones in a knowledgebase's
// words, the comment and action triggers, Add a Page from a Template, and its own triggers, steps and values.

const OUTLINE = {
  name: 'Handbook',
  url: 'https://www.liveknowledge.app/document/d1',
  ownerId: 'user_ana',
  tabs: [
    { id: 't1', name: 'Letter' },
    { id: 't2', name: 'Deck' },
  ],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
};
const NAMES = itemNames('knowledgebase', OUTLINE);

const rule = (trigger: ItemPart, more: Partial<ItemRuleBody> = {}): ItemRuleBody => ({
  name: 'A Rule',
  trigger,
  conditions: [],
  steps: [{ kind: 'take_snapshot', name: 'Kept' }],
  chain: false,
  timeZone: 'UTC',
  ...more,
});

const STAMP = { by: { id: 'user_ana', name: 'Ana', color: '#111' }, at: 1 };
const stored = (body: ItemRuleBody): ItemRule => ({
  ...body,
  id: 'r1',
  enabled: true,
  made: STAMP,
  edited: STAMP,
});
const read = (body: unknown): ItemRuleBody => {
  const out = readItemRule(body, KINDS);
  if ('error' in out) throw new Error(`${out.path}: ${out.message}`);
  return out.body;
};
const refusal = (body: unknown) => {
  const out = readItemRule(body, KINDS);
  return 'error' in out ? out : null;
};
const sentence = (body: ItemRuleBody) => sentenceText(itemRuleSentence(stored(body), KINDS, NAMES));

describe('KINDS', () => {
  it('is a knowledgebase’s registry: its word, comment threads, page templates and the version reference', () => {
    expect(KINDS.itemWord).toBe('knowledgebase');
    expect(KINDS.collab).toBe(true);
    expect(KINDS.tabTemplates).toBe(true);
    expect(KINDS.ownRefs).toEqual([VERSION_REF]);
    expect(AUTOMATIONS_TELEMETRY_CATEGORY).toBe('Document');
  });

  it('describes every kind for agents and Describe a Rule', () => {
    expect(undescribedKinds(KINDS)).toEqual([]);
    const format = itemRuleFormat(KINDS);
    for (const t of DOCUMENT_TRIGGERS) expect(format.trigger).toContain(`"kind":"${t.kind}"`);
    for (const kind of [
      'add_tab',
      'set_owner',
      'clear_verification',
      'email_owner',
      'context',
      'name_version',
      'restore_version',
    ])
      expect(format.steps).toContain(`"kind":"${kind}"`);
  });

  it('holds the shared kinds, the comment and action triggers, and its own', () => {
    const kinds = KINDS.triggers.map((t) => t.kind);
    for (const kind of ['scheduled', 'edited', 'comment_added', 'action_done', 'joined'])
      expect(kinds).toContain(kind);
    expect(DOCUMENT_TRIGGERS.map((t) => `${t.group}: ${t.name}`)).toEqual([
      'Trust: Page Verified',
      'Trust: Review Due',
      'Trust: Page Owner Changed',
      'AI Knowledge: Unanswered Question',
      'AI Knowledge: Pages Disagree',
      'AI Knowledge: Agent Suggested a Change',
      'AI Knowledge: Agent Made Changes',
      'Versions: Version Named',
      'Versions: Version Restored',
    ]);
    expect(DOCUMENT_ACTIONS.map((a) => a.name)).toEqual([
      'Set the Page Owner',
      'Clear Verification',
      'Email the Page Owner',
      'Always in Context',
      'Name This Version',
      'Restore a Version',
    ]);
    expect(DOCUMENT_VALUES.map((v) => v.name)).toEqual([
      'page.owner',
      'question',
      'other.name',
      'suggestion.reason',
      'version.name',
    ]);
    expect(KINDS.action('add_tab')?.name).toBe('Add a Page from a Template');
    expect(KINDS.trigger('tab_added')?.name).toBe('Page Added');
  });
});

describe('the trust and AI Knowledge triggers', () => {
  const by = { id: 'user_ana', name: 'Ana Costa', color: '#111' };
  it.each([
    [PAGE_VERIFIED_EVENT, true, false, 'Ana Costa verified Letter'],
    [REVIEW_DUE_EVENT, true, true, 'Letter came due for review'],
    [OWNER_CHANGED_EVENT, true, false, 'Ana Costa changed the owner of Letter'],
    [PAGES_DISAGREE_EVENT, true, true, 'Letter disagrees with another page'],
    [SUGGESTION_ADDED_EVENT, true, false, 'Ana Costa suggested an edit to Letter'],
  ])(
    '%s keeps to its page (tabbed %s, personless %s) and says what happened',
    (kind, _t, personless, said) => {
      const any = read(rule({ kind }));
      const onPage = read(rule({ kind, tab: 't2' }));
      const def = KINDS.trigger(kind)!;
      expect(def.tabbed).toBe(true);
      expect(def.personless === true).toBe(personless);
      const event: ItemEvent = { id: 'e', kind, at: 1, tab: 't1', ...(personless ? {} : { by }) };
      expect(def.matches(any.trigger, event)).toBe(true);
      expect(def.matches(onPage.trigger, event)).toBe(false);
      expect(itemTriggerLine(stored(any), event, KINDS, NAMES).text).toBe(said);
      expect(sentence(onPage)).toContain('on Deck');
    },
  );

  it('keeps Unanswered Question to the knowledgebase and fills its values from the event', () => {
    expect(KINDS.trigger(QUESTION_UNANSWERED_EVENT)?.tabbed).toBeUndefined();
    expect(read(rule({ kind: QUESTION_UNANSWERED_EVENT, tab: 't1' })).trigger).toEqual({
      kind: QUESTION_UNANSWERED_EVENT,
    });
    const offered = (kind: string) =>
      itemValueOptions(KINDS, { trigger: { kind }, afterAi: false }).map((v) => v.name);
    expect(offered(QUESTION_UNANSWERED_EVENT)).toContain('question');
    expect(offered(PAGES_DISAGREE_EVENT)).toEqual(
      expect.arrayContaining(['question', 'other.name']),
    );
    expect(offered(SUGGESTION_ADDED_EVENT)).toContain('suggestion.reason');
    expect(offered(PAGE_VERIFIED_EVENT)).not.toContain('question');
    // Nobody is behind a review coming due: no {{person}}.
    expect(offered(REVIEW_DUE_EVENT)).not.toContain('person');
    const event: ItemEvent = {
      id: 'e',
      kind: PAGES_DISAGREE_EVENT,
      at: 1,
      tab: 't1',
      data: { question: 'Which port?', 'other.tab': 't2', 'suggestion.reason': 'Typo' },
    };
    const fill = (name: string) =>
      KINDS.value(name)!.fill({ event, outline: OUTLINE, tab: null, summary: '' });
    expect(fill('question')).toBe('Which port?');
    expect(fill('other.name')).toBe('Deck');
    expect(fill('suggestion.reason')).toBe('Typo');
    expect(fill('page.owner')).toBe('');
    expect(
      KINDS.value('other.name')!.fill({
        event: { id: 'e', kind: PAGES_DISAGREE_EVENT, at: 1 },
        outline: OUTLINE,
        tab: null,
        summary: '',
      }),
    ).toBe('');
  });
});

describe('the trust and AI Knowledge steps', () => {
  const steps = (step: ItemPart, trigger: ItemPart = { kind: 'manual' }) =>
    rule(trigger, { steps: [step] });
  const ctx = { names: NAMES, fill: (text: string) => text } as never;

  it('Set the Page Owner makes a person, or whoever started the rule, the owner', () => {
    const toAna = read(steps({ kind: 'set_owner', tab: 't2', to: { person: 'user_ana' } }));
    const toStarter = read(steps({ kind: 'set_owner', tab: 'run', to: { trigger: true } }));
    expect(sentence(toAna)).toContain('Set the Page Owner to Ana Costa on Deck');
    expect(sentence(toStarter)).toContain('Set the Page Owner to whoever started it');
    const def = KINDS.action('set_owner')!;
    expect(def.would(toStarter.steps[0]!, ctx)).toBe(
      'Would make whoever started it the owner of the page',
    );
    expect(def.summary?.(toAna.steps[0]!, NAMES)).toBe('Set the Page Owner to a person');
    expect(def.defaults()).toEqual({ kind: 'set_owner', tab: 'run', to: { trigger: true } });
    expect(ownerToWords({ person: 'user_ana' })).toBe('a person');
    // Nobody is behind a review coming due, so nobody started it to own the page.
    expect(
      refusal(
        steps({ kind: 'set_owner', tab: 'run', to: { trigger: true } }, { kind: REVIEW_DUE_EVENT }),
      ),
    ).toMatchObject({ path: 'steps.0.to' });
    expect(refusal(steps({ kind: 'set_owner', tab: 'run', to: {} }))).toMatchObject({
      path: 'steps.0.to.person',
    });
  });

  it('Clear Verification, Email the Page Owner and Always in Context read and say themselves', () => {
    const clear = read(steps({ kind: 'clear_verification', tab: 'run' }));
    expect(sentence(clear)).toContain('Clear Verification');
    expect(KINDS.action('clear_verification')!.would(clear.steps[0]!, ctx)).toBe(
      'Would clear the verification of the page',
    );
    const mail = read(
      steps({ kind: 'email_owner', subject: '{{tab.name}}', body: 'Check {{tab.url}}' }),
    );
    expect(sentence(mail)).toContain('Email the Page Owner');
    expect(KINDS.action('email_owner')!.would(mail.steps[0]!, ctx)).toBe(
      'Would email the page’s owner: {{tab.name}}',
    );
    expect(refusal(steps({ kind: 'email_owner', subject: '', body: 'x' }))).toMatchObject({
      path: 'steps.0.subject',
    });
    const add = read(steps({ kind: 'context', tab: 't1', on: true }));
    const remove = read(steps({ kind: 'context', tab: 'run', on: false }));
    expect(sentence(add)).toContain('Add to Always in Context on Letter');
    expect(sentence(remove)).toContain('Remove from Always in Context');
    const def = KINDS.action('context')!;
    expect(def.would(add.steps[0]!, ctx)).toBe('Would add Letter to Always in Context');
    expect(def.would(remove.steps[0]!, ctx)).toBe('Would remove the page from Always in Context');
    expect(def.summary?.(remove.steps[0]!, NAMES)).toBe('Remove from Always in Context');
    expect(refusal(steps({ kind: 'context', tab: 't1' }))).toMatchObject({ path: 'steps.0.on' });
  });
});

describe('the version triggers and Agent Made Changes', () => {
  const event = (kind: string, tab = 't1'): ItemEvent => ({
    id: `${kind}:1`,
    kind,
    at: 1,
    tab,
    by: { id: 'user_ana', name: 'Ana Costa', color: '#111' },
    data: { 'version.name': 'Signed off' },
  });

  it.each([
    [VERSION_NAMED_EVENT, 'Ana Costa named a version of Letter'],
    [VERSION_RESTORED_EVENT, 'Ana Costa restored a version of Letter'],
    [AGENT_CHANGED_EVENT, 'Ana Costa changed Letter'],
  ])('%s reads with or without a page, keeps to its page, and says who', (kind, said) => {
    const any = read(rule({ kind }));
    const onTab = read(rule({ kind, tab: 't2' }));
    expect(any.trigger).toEqual({ kind });
    expect(onTab.trigger).toEqual({ kind, tab: 't2' });
    const def = KINDS.trigger(kind)!;
    expect(def.tabbed).toBe(true);
    expect(def.matches(any.trigger, event(kind))).toBe(true);
    expect(def.matches(onTab.trigger, event(kind))).toBe(false);
    expect(def.matches(onTab.trigger, event(kind, 't2'))).toBe(true);
    expect(itemTriggerLine(stored(any), event(kind), KINDS, NAMES).text).toBe(said);
    expect(sentence(onTab)).toContain('Deck');
  });

  it('offers version.name under the two version triggers only, filled from the event', () => {
    const offered = (kind: string) =>
      itemValueOptions(KINDS, { trigger: { kind }, afterAi: false }).map((v) => v.name);
    expect(offered(VERSION_NAMED_EVENT)).toContain('version.name');
    expect(offered(VERSION_RESTORED_EVENT)).toContain('version.name');
    expect(offered(AGENT_CHANGED_EVENT)).not.toContain('version.name');
    const fill = KINDS.value('version.name')!.fill;
    expect(fill({ event: event(VERSION_NAMED_EVENT) } as never)).toBe('Signed off');
    expect(fill({ event: { id: 'e', kind: VERSION_RESTORED_EVENT, at: 1 } } as never)).toBe('');
    expect(
      refusal(
        rule({ kind: 'manual' }, { steps: [{ kind: 'take_snapshot', name: '{{version.name}}' }] }),
      ),
    ).toMatchObject({ error: 'automation_value_unknown' });
  });
});

describe('Name This Version', () => {
  it('names the run’s tab or a chosen one, values allowed', () => {
    const run = read(
      rule(
        { kind: 'scheduled', every: 'week', days: [5], at: '17:00' },
        { steps: [{ kind: 'name_version', tab: 'run', name: 'Week of {{now.date}}' }] },
      ),
    );
    expect(run.steps[0]).toEqual({
      kind: 'name_version',
      tab: 'run',
      name: 'Week of {{now.date}}',
    });
    const chosen = read(
      rule({ kind: 'manual' }, { steps: [{ kind: 'name_version', tab: 't2', name: 'Reviewed' }] }),
    );
    expect(sentence(run)).toContain('Name This Version “Week of {{now.date}}”');
    expect(sentence(run)).not.toContain('” on ');
    expect(sentence(chosen)).toContain('Name This Version “Reviewed” on Deck');
    const def = KINDS.action('name_version')!;
    expect(def.defaults()).toEqual({ kind: 'name_version', tab: 'run', name: '{{now.date}}' });
    const ctx = { names: NAMES, fill: (text: string) => text.toUpperCase() } as never;
    expect(def.would(run.steps[0]!, ctx)).toBe(
      'Would name the current version of the page “WEEK OF {{NOW.DATE}}”',
    );
    expect(def.would(chosen.steps[0]!, ctx)).toBe(
      'Would name the current version of Deck “REVIEWED”',
    );
    expect(JSON.stringify(itemRuleSummary(stored(chosen), KINDS, NAMES).steps)).toContain(
      'Name This Version',
    );
  });

  it('refuses no name, no tab, and a value no kind offers', () => {
    const steps = (step: ItemPart) => rule({ kind: 'manual' }, { steps: [step] });
    expect(refusal(steps({ kind: 'name_version', tab: 'run', name: ' ' }))).toMatchObject({
      path: 'steps.0.name',
    });
    expect(refusal(steps({ kind: 'name_version', name: 'X' }))).toMatchObject({
      path: 'steps.0.tab',
    });
    expect(refusal(steps({ kind: 'name_version', tab: 'run', name: '{{nope}}' }))).toMatchObject({
      error: 'automation_value_unknown',
    });
  });
});

describe('Restore a Version', () => {
  const restore = (more: Record<string, unknown> = {}): ItemRuleBody =>
    rule(
      { kind: 'scheduled', every: 'day', at: '00:00' },
      { steps: [{ kind: 'restore_version', tab: 't1', version: 'v_1', ...more }] },
    );

  it('names a tab and one of its versions, and may be followed by other steps', () => {
    const body = read(restore({ name: ' Form letter ' }));
    expect(body.steps[0]).toEqual({
      kind: 'restore_version',
      tab: 't1',
      version: 'v_1',
      name: 'Form letter',
    });
    expect(sentence(body)).toContain('Restore “Form letter” on Letter');
    const followed = read({
      ...restore(),
      steps: [...restore().steps, { kind: 'take_snapshot', name: 'After' }],
    });
    expect(followed.steps).toHaveLength(2);
    expect(sentence(followed)).toContain('Restore a named version on Letter');
    const def = KINDS.action('restore_version')!;
    expect(def.last).toBeUndefined();
    expect(def.needsPerson).toBeUndefined();
    expect(def.defaults()).toEqual({ kind: 'restore_version', tab: '', version: '' });
    expect(def.would(body.steps[0]!, { names: NAMES } as never)).toBe(
      'Would restore Letter to “Form letter”',
    );
    expect(JSON.stringify(itemRuleSummary(stored(body), KINDS, NAMES).steps)).toContain(
      'Restore a Version',
    );
    expect(versionWords({ version: '' })).toBe('a version');
  });

  it('refuses the run’s tab, no tab and no version', () => {
    expect(refusal(restore({ tab: 'run' }))).toMatchObject({ path: 'steps.0.tab' });
    expect(refusal(restore({ tab: undefined }))).toMatchObject({ path: 'steps.0.tab' });
    expect(refusal(restore({ version: undefined }))).toMatchObject({ path: 'steps.0.version' });
  });

  it('leaves its version to pick in a copy, where the tab keeps its new id', () => {
    const filed = [{ ...restore({ name: 'Form letter' }), enabled: true }];
    const { rules } = rulesFromFile(filed, KINDS, {
      stamp: STAMP,
      copy: true,
      tabs: new Map([['t1', 'n1']]),
    });
    expect(rules[0]).toMatchObject({
      enabled: false,
      steps: [{ kind: 'restore_version', tab: 'n1', version: '' }],
    });
    expect(ruleLeftToPick(rules[0]!, KINDS)).toBe(true);
    expect(sentenceText(itemRuleSentence(rules[0]!, KINDS, NAMES))).toContain('Restore a version');
  });
});
