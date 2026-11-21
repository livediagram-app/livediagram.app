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
  DOCUMENT_ACTIONS,
  DOCUMENT_TRIGGERS,
  DOCUMENT_VALUES,
  KINDS,
  VERSION_NAMED_EVENT,
  VERSION_REF,
  VERSION_RESTORED_EVENT,
  versionWords,
} from './index';

// livedocuments' Automations kinds (docs/specs/013-workspace/automations.md): the shared ones, the comment and action
// triggers, Add a Tab from a Template, and Version Named, Version Restored and Agent Made Changes, Name This Version
// and Restore a Version, with `version.name`.

const OUTLINE = {
  name: 'Handbook',
  url: 'https://www.livedocuments.app/document/d1',
  ownerId: 'user_ana',
  tabs: [
    { id: 't1', name: 'Letter' },
    { id: 't2', name: 'Deck' },
  ],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
};
const NAMES = itemNames('document', OUTLINE);

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
  it('is a document’s registry: its word, comment threads, tab templates and the version reference', () => {
    expect(KINDS.itemWord).toBe('document');
    expect(KINDS.collab).toBe(true);
    expect(KINDS.tabTemplates).toBe(true);
    expect(KINDS.ownRefs).toEqual([VERSION_REF]);
    expect(AUTOMATIONS_TELEMETRY_CATEGORY).toBe('Document');
  });

  it('describes every kind for agents and Describe a Rule', () => {
    expect(undescribedKinds(KINDS)).toEqual([]);
    const format = itemRuleFormat(KINDS);
    for (const kind of [VERSION_NAMED_EVENT, VERSION_RESTORED_EVENT, AGENT_CHANGED_EVENT])
      expect(format.trigger).toContain(`"kind":"${kind}"`);
    for (const kind of ['add_tab', 'name_version', 'restore_version'])
      expect(format.steps).toContain(`"kind":"${kind}"`);
  });

  it('holds the shared kinds, the comment and action triggers, and its own', () => {
    const kinds = KINDS.triggers.map((t) => t.kind);
    for (const kind of ['scheduled', 'edited', 'comment_added', 'action_done', 'joined'])
      expect(kinds).toContain(kind);
    expect(DOCUMENT_TRIGGERS.map((t) => t.name)).toEqual([
      'Version Named',
      'Version Restored',
      'Agent Made Changes',
    ]);
    expect(DOCUMENT_ACTIONS.map((a) => a.name)).toEqual(['Name This Version', 'Restore a Version']);
    expect(DOCUMENT_VALUES.map((v) => v.name)).toEqual(['version.name']);
    expect(KINDS.action('add_tab')?.name).toBe('Add a Tab from a Template');
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
  ])('%s reads with or without a tab, keeps to its tab, and says who', (kind, said) => {
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
      'Would name the current version of the tab “WEEK OF {{NOW.DATE}}”',
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
