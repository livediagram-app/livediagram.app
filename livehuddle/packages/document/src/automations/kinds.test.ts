import { describe, expect, it } from 'vitest';
import {
  itemNames,
  itemRuleFormat,
  itemRuleSentence,
  itemRuleSummary,
  itemTriggerLine,
  itemValueOptions,
  readItemRule,
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
  CLEAR_SUGGESTIONS_STEP,
  EVERYONE_LEFT_MINUTES_MAX,
  EVERYONE_LEFT_MINUTES_MIN,
  EVERYONE_LEFT_TRIGGER,
  KINDS,
  SOMEONE_ARRIVED_EVENT,
  SPACE_ACTIONS,
  SPACE_TRIGGERS,
  SPACE_VALUES,
  SUGGESTION_DROPPED_EVENT,
  TAB_EMPTIED_EVENT,
  TAB_FILLED_EVENT,
} from './index';

// livehuddle's Automations kinds (docs/specs/013-workspace/automations.md): the shared ones, Add a Tab from a
// Template, Someone Arrived, Everyone Left and Suggestion Dropped, Clear the Suggestion Box, and the visit and
// suggestion values. No comment triggers: livehuddle has no comment threads a rule may hear.

const OUTLINE = {
  name: 'Studio',
  url: 'https://www.livehuddle.app/document/d1',
  ownerId: 'user_ana',
  tabs: [
    { id: 't1', name: 'Lobby' },
    { id: 't2', name: 'Garden' },
  ],
  people: [{ id: 'user_ana', name: 'Ana Costa' }],
};
const NAMES = itemNames('Space', OUTLINE);

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
const event = (kind: string, more: Partial<ItemEvent> = {}): ItemEvent => ({
  id: `${kind}:1`,
  kind,
  at: 1,
  tab: 't1',
  ...more,
});
const offered = (kind: string) =>
  itemValueOptions(KINDS, { trigger: { kind }, afterAi: false }).map((v) => v.name);

describe('KINDS', () => {
  it('is a Space’s registry: its word, no comment threads, tab templates', () => {
    expect(KINDS.itemWord).toBe('Space');
    expect(KINDS.collab).toBe(false);
    expect(KINDS.tabTemplates).toBe(true);
    expect(AUTOMATIONS_TELEMETRY_CATEGORY).toBe('Document');
  });

  it('describes every kind for Describe a Rule', () => {
    expect(undescribedKinds(KINDS)).toEqual([]);
    const format = itemRuleFormat(KINDS);
    for (const kind of [SOMEONE_ARRIVED_EVENT, EVERYONE_LEFT_TRIGGER, SUGGESTION_DROPPED_EVENT])
      expect(format.trigger).toContain(`"kind":"${kind}"`);
    for (const kind of ['add_tab', CLEAR_SUGGESTIONS_STEP])
      expect(format.steps).toContain(`"kind":"${kind}"`);
  });

  it('holds the shared kinds and its own, and no comment trigger', () => {
    const kinds = KINDS.triggers.map((t) => t.kind);
    for (const kind of ['scheduled', 'edited', 'joined', 'access_requested', 'incoming_webhook'])
      expect(kinds).toContain(kind);
    expect(kinds).not.toContain('comment_added');
    expect(SPACE_TRIGGERS.map((t) => t.name)).toEqual([
      'Someone Arrived',
      'Everyone Left',
      'Suggestion Dropped',
    ]);
    expect(SPACE_ACTIONS.map((a) => a.name)).toEqual(['Clear the Suggestion Box']);
    expect(SPACE_VALUES.map((v) => v.name)).toEqual([
      'visit.people',
      'visit.count',
      'visit.minutes',
      'suggestion',
    ]);
    expect(KINDS.action('add_tab')?.name).toBe('Add a Tab from a Template');
  });
});

describe('Someone Arrived', () => {
  const def = KINDS.trigger(SOMEONE_ARRIVED_EVENT)!;
  const arrival = (empty: boolean, tab = 't1') =>
    event(SOMEONE_ARRIVED_EVENT, {
      tab,
      by: { id: '', name: 'Ben', color: '#222' },
      data: { 'visit.empty': empty },
    });

  it('reads empty as on unless it is false, with or without a tab', () => {
    expect(read(rule({ kind: SOMEONE_ARRIVED_EVENT })).trigger).toEqual({
      kind: SOMEONE_ARRIVED_EVENT,
      empty: true,
    });
    expect(read(rule({ kind: SOMEONE_ARRIVED_EVENT, tab: 't2', empty: false })).trigger).toEqual({
      kind: SOMEONE_ARRIVED_EVENT,
      tab: 't2',
      empty: false,
    });
    expect(def.defaults()).toEqual({ kind: SOMEONE_ARRIVED_EVENT, empty: true });
    expect(def.tabbed).toBe(true);
    expect(def.hears).toEqual([SOMEONE_ARRIVED_EVENT]);
  });

  it('refuses an empty that is not true or false, and a tab that is not one', () => {
    expect(refusal(rule({ kind: SOMEONE_ARRIVED_EVENT, empty: 'yes' }))).toMatchObject({
      path: 'trigger.empty',
    });
    expect(refusal(rule({ kind: SOMEONE_ARRIVED_EVENT, tab: 7 }))).toMatchObject({
      path: 'trigger.tab',
    });
  });

  it('hears only the first one into an empty tab unless empty is off, and keeps to its tab', () => {
    const first = read(rule({ kind: SOMEONE_ARRIVED_EVENT })).trigger;
    const anyone = read(rule({ kind: SOMEONE_ARRIVED_EVENT, empty: false })).trigger;
    const garden = read(rule({ kind: SOMEONE_ARRIVED_EVENT, tab: 't2' })).trigger;
    expect(def.matches(first, arrival(true))).toBe(true);
    expect(def.matches(first, arrival(false))).toBe(false);
    expect(def.matches(anyone, arrival(false))).toBe(true);
    expect(def.matches(garden, arrival(true))).toBe(false);
    expect(def.matches(garden, arrival(true, 't2'))).toBe(true);
  });

  it('says who arrived where, and reads as a sentence', () => {
    const body = read(rule({ kind: SOMEONE_ARRIVED_EVENT, tab: 't2' }));
    expect(itemTriggerLine(stored(body), arrival(true, 't2'), KINDS, NAMES).text).toBe(
      'Ben arrived in Garden',
    );
    expect(sentence(body)).toContain('Someone Arrived');
    expect(sentence(body)).toContain('Garden');
    expect(sentence(body)).toContain('when it was empty');
    expect(sentence(read(rule({ kind: SOMEONE_ARRIVED_EVENT, empty: false })))).not.toContain(
      'when it was empty',
    );
  });
});

describe('Everyone Left', () => {
  const def = KINDS.trigger(EVERYONE_LEFT_TRIGGER)!;

  it(`waits ${EVERYONE_LEFT_MINUTES_MIN} to ${EVERYONE_LEFT_MINUTES_MAX} minutes, on its tab or any`, () => {
    expect(read(rule({ kind: EVERYONE_LEFT_TRIGGER, minutes: 30, tab: 't1' })).trigger).toEqual({
      kind: EVERYONE_LEFT_TRIGGER,
      minutes: 30,
      tab: 't1',
    });
    for (const minutes of [0, EVERYONE_LEFT_MINUTES_MAX + 1, 1.5, undefined])
      expect(refusal(rule({ kind: EVERYONE_LEFT_TRIGGER, minutes }))).toMatchObject({
        path: 'trigger.minutes',
      });
    expect(def.defaults()).toEqual({ kind: EVERYONE_LEFT_TRIGGER, minutes: 10 });
    expect(def.personless).toBe(true);
    // Heard only through its quiet stretch, never straight.
    expect(def.hears).toEqual([]);
  });

  it('settles per tab on the room’s two edges, for its window', () => {
    const settle = def.settle!;
    const trigger = read(rule({ kind: EVERYONE_LEFT_TRIGGER, minutes: 90 })).trigger;
    expect(settle.after).toEqual([TAB_EMPTIED_EVENT]);
    expect(settle.cancel).toEqual([TAB_FILLED_EVENT]);
    expect(settle.quietMs(trigger)).toBe(90 * 60_000);
    expect(settle.key(event(TAB_EMPTIED_EVENT, { tab: 't2' }), trigger)).toBe('t2');
    expect(settle.key(event(TAB_EMPTIED_EVENT, { tab: undefined }), trigger)).toBe('');
    const onGarden = read(rule({ kind: EVERYONE_LEFT_TRIGGER, minutes: 5, tab: 't2' })).trigger;
    expect(def.matches(onGarden, event(TAB_EMPTIED_EVENT))).toBe(false);
    expect(def.matches(onGarden, event(TAB_EMPTIED_EVENT, { tab: 't2' }))).toBe(true);
  });

  it('reads its window in words, and says where everyone left', () => {
    const body = read(rule({ kind: EVERYONE_LEFT_TRIGGER, minutes: 90, tab: 't1' }));
    expect(sentence(body)).toContain('Everyone Left for 1 Hour 30 Minutes');
    expect(sentence(body)).toContain('Lobby');
    expect(itemTriggerLine(stored(body), event(TAB_EMPTIED_EVENT), KINDS, NAMES).text).toBe(
      'Everyone left Lobby',
    );
  });

  it('offers the visit values under it alone, filled from the event', () => {
    for (const name of ['visit.people', 'visit.count', 'visit.minutes']) {
      expect(offered(EVERYONE_LEFT_TRIGGER)).toContain(name);
      expect(offered(SOMEONE_ARRIVED_EVENT)).not.toContain(name);
    }
    const data = { 'visit.people': 'Ana, Ben', 'visit.count': 2, 'visit.minutes': 45 };
    const ctx = { event: event(TAB_EMPTIED_EVENT, { data }) } as never;
    expect(KINDS.value('visit.people')!.fill(ctx)).toBe('Ana, Ben');
    expect(KINDS.value('visit.count')!.fill(ctx)).toBe('2');
    expect(KINDS.value('visit.minutes')!.fill(ctx)).toBe('45');
    expect(KINDS.value('visit.count')!.fill({ event: event(TAB_EMPTIED_EVENT) } as never)).toBe('');
  });
});

describe('Suggestion Dropped', () => {
  const def = KINDS.trigger(SUGGESTION_DROPPED_EVENT)!;

  it('is nobody’s, picks no tab, and offers the note’s text', () => {
    expect(read(rule({ kind: SUGGESTION_DROPPED_EVENT })).trigger).toEqual({
      kind: SUGGESTION_DROPPED_EVENT,
    });
    expect(def.personless).toBe(true);
    expect(offered(SUGGESTION_DROPPED_EVENT)).toContain('suggestion');
    expect(offered(EVERYONE_LEFT_TRIGGER)).not.toContain('suggestion');
    const dropped = event(SUGGESTION_DROPPED_EVENT, { data: { suggestion: 'More plants' } });
    expect(KINDS.value('suggestion')!.fill({ event: dropped } as never)).toBe('More plants');
    const body = read(rule({ kind: SUGGESTION_DROPPED_EVENT }));
    expect(itemTriggerLine(stored(body), dropped, KINDS, NAMES).text).toBe(
      'A suggestion was dropped in Lobby',
    );
    expect(
      refusal(
        rule({ kind: 'manual' }, { steps: [{ kind: 'take_snapshot', name: '{{suggestion}}' }] }),
      ),
    ).toMatchObject({ error: 'automation_value_unknown' });
  });
});

describe('Clear the Suggestion Box', () => {
  it('takes no fields, reads as a sentence, and says what it would do', () => {
    const body = read(rule({ kind: 'manual' }, { steps: [{ kind: CLEAR_SUGGESTIONS_STEP }] }));
    expect(body.steps).toEqual([{ kind: CLEAR_SUGGESTIONS_STEP }]);
    expect(sentence(body)).toContain('Clear the Suggestion Box');
    const def = KINDS.action(CLEAR_SUGGESTIONS_STEP)!;
    expect(def.defaults()).toEqual({ kind: CLEAR_SUGGESTIONS_STEP });
    expect(def.would(body.steps[0]!, { names: NAMES } as never)).toBe(
      'Would clear every note in the Suggestion Box',
    );
    expect(JSON.stringify(itemRuleSummary(stored(body), KINDS, NAMES).steps)).toContain(
      'Clear the Suggestion Box',
    );
  });
});

describe('a copy', () => {
  it('keeps an Everyone Left rule’s tab at its new id, turned off', () => {
    const filed = [
      { ...rule({ kind: EVERYONE_LEFT_TRIGGER, minutes: 10, tab: 't1' }), enabled: true },
    ];
    const { rules } = rulesFromFile(filed, KINDS, {
      stamp: STAMP,
      copy: true,
      tabs: new Map([['t1', 'n1']]),
    });
    expect(rules[0]).toMatchObject({
      enabled: false,
      trigger: { kind: EVERYONE_LEFT_TRIGGER, minutes: 10, tab: 'n1' },
    });
  });
});
