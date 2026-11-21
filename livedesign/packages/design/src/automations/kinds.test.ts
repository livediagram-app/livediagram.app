import { describe, expect, it } from 'vitest';
import {
  AGENT_CHANGED_EVENT,
  ITEM_SETTLED_EVENT,
  itemNames,
  itemRuleFormat,
  itemRuleSentence,
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
  AUTOMATIONS_TELEMETRY_CATEGORY,
  COMPONENT_CHANGED_EVENT,
  COMPONENT_QUIET_MS,
  COMPONENT_REF,
  DESIGN_TRIGGERS,
  DESIGN_VALUES,
  KINDS,
  componentWords,
} from './index';

// livedesign's Automations kinds (docs/specs/013-workspace/automations.md): the shared ones, the comment and action
// triggers, Add a Tab from a Template, Component Changed (settling 2 minutes after the last change) and Agent Made
// Changes, with `component.name`.

const OUTLINE = {
  name: 'Brand',
  url: 'https://www.livedesign.app/design/d1',
  ownerId: 'user_ana',
  tabs: [
    { id: 't1', name: 'Logo' },
    { id: 't2', name: 'Screens' },
  ],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
};
const NAMES = itemNames('design', OUTLINE);

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

const ANA = { id: 'user_ana', name: 'Ana Costa', color: '#111' };
const changed = (component: string, name: string): ItemEvent => ({
  id: `component:${component}:1`,
  kind: COMPONENT_CHANGED_EVENT,
  at: 1,
  by: ANA,
  data: { 'component.id': component, 'component.name': name },
});

describe('KINDS', () => {
  it('is a design’s registry: its word, comment threads, tab templates and the component reference', () => {
    expect(KINDS.itemWord).toBe('design');
    expect(KINDS.collab).toBe(true);
    expect(KINDS.tabTemplates).toBe(true);
    expect(KINDS.ownRefs).toEqual([COMPONENT_REF]);
    expect(AUTOMATIONS_TELEMETRY_CATEGORY).toBe('Document');
  });

  it('describes every kind for agents and Describe a Rule', () => {
    expect(undescribedKinds(KINDS)).toEqual([]);
    const format = itemRuleFormat(KINDS);
    for (const kind of [COMPONENT_CHANGED_EVENT, AGENT_CHANGED_EVENT])
      expect(format.trigger).toContain(`"kind":"${kind}"`);
    expect(format.steps).toContain('"kind":"add_tab"');
  });

  it('holds the shared kinds, the comment and action triggers, and its own', () => {
    const kinds = KINDS.triggers.map((t) => t.kind);
    for (const kind of ['scheduled', 'edited', 'comment_added', 'action_done', 'joined'])
      expect(kinds).toContain(kind);
    expect(DESIGN_TRIGGERS.map((t) => t.name)).toEqual(['Component Changed', 'Agent Made Changes']);
    expect(DESIGN_VALUES.map((v) => v.name)).toEqual(['component.name']);
    expect(KINDS.action('add_tab')?.name).toBe('Add a Tab from a Template');
    expect(KINDS.actions.map((a) => a.kind)).not.toContain('name_version');
  });
});

describe('Component Changed', () => {
  const def = KINDS.trigger(COMPONENT_CHANGED_EVENT)!;

  it('reads with or without a component, and keeps the name it was saved with', () => {
    const any = read(rule({ kind: COMPONENT_CHANGED_EVENT }));
    const one = read(rule({ kind: COMPONENT_CHANGED_EVENT, component: 'c1', name: ' Button ' }));
    expect(any.trigger).toEqual({ kind: COMPONENT_CHANGED_EVENT });
    expect(one.trigger).toEqual({ kind: COMPONENT_CHANGED_EVENT, component: 'c1', name: 'Button' });
    const unnamed = read(rule({ kind: COMPONENT_CHANGED_EVENT, component: 'c1', name: '  ' }));
    expect(unnamed.trigger).toEqual({ kind: COMPONENT_CHANGED_EVENT, component: 'c1' });
    expect(def.defaults()).toEqual({ kind: COMPONENT_CHANGED_EVENT });
    expect(def.tabbed).toBeUndefined();
    expect(def.personless).toBeUndefined();
    expect(sentence(any)).toContain('Component Changed');
    expect(sentence(one)).toContain('Component Changed for “Button”');
    expect(sentence(unnamed)).toContain('Component Changed for a component');
  });

  it('refuses a component that names nothing', () => {
    expect(refusal(rule({ kind: COMPONENT_CHANGED_EVENT, component: '' }))).toMatchObject({
      path: 'trigger.component',
    });
    expect(refusal(rule({ kind: COMPONENT_CHANGED_EVENT, component: 7 }))).toMatchObject({
      path: 'trigger.component',
    });
  });

  it('settles 2 minutes after the last change: on the whole library, or on its one component', () => {
    const settle = def.settle!;
    expect(COMPONENT_QUIET_MS).toBe(120_000);
    expect(settle.after).toEqual([COMPONENT_CHANGED_EVENT]);
    expect(def.hears).toEqual([]);
    const any = { kind: COMPONENT_CHANGED_EVENT };
    const one = { kind: COMPONENT_CHANGED_EVENT, component: 'c1' };
    expect(settle.quietMs(any)).toBe(COMPONENT_QUIET_MS);
    expect(settle.key(changed('c2', 'Card'), any)).toBe('');
    expect(settle.key(changed('c1', 'Button'), one)).toBe('c1');
    expect(def.matches(any, changed('c2', 'Card'))).toBe(true);
    expect(def.matches(one, changed('c1', 'Button'))).toBe(true);
    expect(def.matches(one, changed('c2', 'Card'))).toBe(false);
  });

  it('says who changed which component, from what the settle carried', () => {
    const body = read(rule({ kind: COMPONENT_CHANGED_EVENT }));
    const settled = { ...changed('c1', 'Button'), kind: ITEM_SETTLED_EVENT, ruleId: 'r1' };
    expect(itemTriggerLine(stored(body), settled, KINDS, NAMES).text).toBe(
      'Ana Costa changed “Button”',
    );
    const bare: ItemEvent = { id: 's', kind: ITEM_SETTLED_EVENT, at: 1, ruleId: 'r1' };
    expect(itemTriggerLine(stored(body), bare, KINDS, NAMES).text).toBe(
      'Someone changed a component',
    );
  });

  it('offers component.name under Component Changed only, filled from the event', () => {
    const offered = (kind: string) =>
      itemValueOptions(KINDS, { trigger: { kind }, afterAi: false }).map((v) => v.name);
    expect(offered(COMPONENT_CHANGED_EVENT)).toContain('component.name');
    expect(offered(AGENT_CHANGED_EVENT)).not.toContain('component.name');
    const fill = KINDS.value('component.name')!.fill;
    expect(fill({ event: changed('c1', 'Button') } as never)).toBe('Button');
    expect(fill({ event: { id: 'e', kind: ITEM_SETTLED_EVENT, at: 1 } } as never)).toBe('');
    expect(
      refusal(
        rule(
          { kind: 'manual' },
          { steps: [{ kind: 'take_snapshot', name: '{{component.name}}' }] },
        ),
      ),
    ).toMatchObject({ error: 'automation_value_unknown' });
  });

  it('leaves its component to pick in a copy, and words one still to pick', () => {
    const filed = [
      {
        ...rule({ kind: COMPONENT_CHANGED_EVENT, component: 'c1', name: 'Button' }),
        enabled: true,
      },
      { ...rule({ kind: COMPONENT_CHANGED_EVENT }), name: 'Any Component', enabled: true },
    ];
    const { rules } = rulesFromFile(filed, KINDS, { stamp: STAMP, copy: true });
    expect(rules[0]).toMatchObject({
      enabled: false,
      trigger: { kind: COMPONENT_CHANGED_EVENT, component: '' },
    });
    expect(ruleLeftToPick(rules[0]!, KINDS)).toBe(true);
    expect(ruleLeftToPick(rules[1]!, KINDS)).toBe(false);
    expect(sentenceText(itemRuleSentence(rules[0]!, KINDS, NAMES))).toContain(
      'Component Changed for a component',
    );
    expect(componentWords({ component: '' })).toBe('a component');
    expect(componentWords({ component: 'c1', name: 'Button' })).toBe('“Button”');
  });
});

describe('Agent Made Changes', () => {
  it('reads with or without a tab, keeps to its tab, and says who', () => {
    const def = KINDS.trigger(AGENT_CHANGED_EVENT)!;
    const any = read(rule({ kind: AGENT_CHANGED_EVENT }));
    const onTab = read(rule({ kind: AGENT_CHANGED_EVENT, tab: 't2' }));
    const event: ItemEvent = {
      id: 'agent:cs1',
      kind: AGENT_CHANGED_EVENT,
      at: 1,
      tab: 't1',
      by: { ...ANA, name: 'Robot' },
    };
    expect(def.tabbed).toBe(true);
    expect(def.line).toContain('a component');
    expect(def.matches(any.trigger, event)).toBe(true);
    expect(def.matches(onTab.trigger, event)).toBe(false);
    expect(itemTriggerLine(stored(any), event, KINDS, NAMES).text).toBe('Robot changed Logo');
    expect(sentence(onTab)).toContain('Screens');
  });
});
