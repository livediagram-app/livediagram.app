// The pure parts (blueprint ui.md "Tests"): who sees Automations, a refusal in words, the Audit Trail's words, the
// values' search, and how a step names its tile. Each held at 100% (vitest.config.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOMATIONS_PARAM,
  automationsGateFor,
  automationsScopeFor,
  type AutomationsGateInput,
} from './automations-gate';
import { refusalWords } from './refusal-words';
import {
  lastRunWords,
  meterWords,
  nextRunWords,
  RESULT_LABELS,
  RESULT_PILL,
  runsWords,
  runWhen,
  tookWords,
} from './run-words';
import { isAi, isHolder, isIf, isOutgoing, isWait, stepKey } from './types';
import { filterValueGroups, valueGroup, WEBHOOK_VALUE_GROUP } from './value-groups';

const EDITOR: AutomationsGateInput = {
  level: 'edit',
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
  signedIn: true,
  authLoaded: true,
  scope: { ownerId: 'o1', itemId: 'i1', shareCode: 'abc', tabId: null },
};

describe('who sees Automations', () => {
  it('gives a signed-in Editor of the whole item its scope, and no gate', () => {
    expect(automationsScopeFor(EDITOR)).toEqual({
      ownerId: 'o1',
      itemId: 'i1',
      shareCode: 'abc',
      as: ':edit',
    });
    // Who asks, so a refused list is read again for someone else.
    expect(automationsScopeFor({ ...EDITOR, viewer: 'u1' })?.as).toBe('u1:edit');
    expect(automationsGateFor(EDITOR)).toBeNull();
    expect(AUTOMATIONS_PARAM).toBe('automations');
  });

  it.each([
    ['a Participant', { level: 'participate', structureReadOnly: true }],
    ['a Viewer', { level: 'view', structureReadOnly: true }],
    ['an Editor read-only for structure', { structureReadOnly: true }],
    ['an Editor confined to one tab', { scope: { ...EDITOR.scope!, tabId: 't1' } }],
    ['an embed', { embed: true }],
    ['before the item has loaded', { hydrated: false }],
  ] as [string, Partial<AutomationsGateInput>][])('gives %s neither', (_who, over) => {
    expect(automationsScopeFor({ ...EDITOR, ...over })).toBeNull();
    expect(automationsGateFor({ ...EDITOR, ...over })).toBeNull();
  });

  it('asks a guest to sign in, once sign-in has answered, and before anything else', () => {
    const guest = { ...EDITOR, signedIn: false };
    expect(automationsScopeFor(guest)).toBeNull();
    expect(automationsGateFor(guest)).toBe('sign_in');
    expect(automationsGateFor({ ...guest, authLoaded: false })).toBeNull();
    expect(automationsGateFor({ ...guest, offline: true, scope: null })).toBe('sign_in');
    // No item on the server and none kept Offline: nothing to sign in for.
    expect(automationsGateFor({ ...guest, scope: null })).toBeNull();
  });

  it('asks for a sync on an item kept Offline', () => {
    const offline = { ...EDITOR, offline: true };
    expect(automationsScopeFor(offline)).toBeNull();
    expect(automationsGateFor(offline)).toBe('sync');
    expect(automationsScopeFor({ ...EDITOR, scope: null })).toBeNull();
    expect(automationsGateFor({ ...EDITOR, scope: null, offline: true })).toBe('sync');
  });
});

describe('a refusal in words', () => {
  const say = (code: string, path: string | null, message: string, picks = {}) =>
    refusalWords({ code, path, message }, 'Space', picks);

  it('says each code it knows in fixed words, with the item’s word', () => {
    expect(say('automation_name_taken', 'name', 'taken')).toBe(
      'Another rule here has this name. Pick another.',
    );
    expect(say('automation_rules_full', null, 'full')).toBe(
      'This Space has 50 rules, the most it can hold. Delete one to add another.',
    );
    expect(say('automation_condition_unsupported', 'conditions.0', 'x')).toContain(
      'nobody of the Space behind it',
    );
  });

  it('takes the path off the api’s message, as a sentence', () => {
    expect(say('automation_invalid', 'steps.3.text', 'steps.3.text must be text')).toBe(
      'Must be text.',
    );
    expect(say('automation_invalid', 'steps.0', 'steps.0 ends a run.')).toBe('Ends a run.');
    // No path, a message that does not lead with it, or nothing after it: the message as it is.
    expect(say('automation_invalid', null, 'No good')).toBe('No good');
    expect(say('automation_invalid', 'steps.0', 'Something else')).toBe('Something else');
    expect(say('automation_invalid', 'steps.0', 'steps.0 ')).toBe('steps.0 ');
  });

  it('says a pick left empty as what to pick: a connection, the app’s own names, or one', () => {
    const empty = (path: string, picks = {}) =>
      say('automation_invalid', path, `${path} must name one`, picks);
    expect(empty('steps.0.webhook')).toBe('Pick a connection.');
    expect(empty('steps.1.then.0.to.person')).toBe('Pick a person.');
    expect(empty('trigger.status', { status: 'a column' })).toBe('Pick a column.');
    expect(empty('steps.2')).toBe('Pick one.');
    expect(empty('conditions.0.tabs.1')).toBe('Pick one.');
    expect(refusalWords({ code: 'x', path: 'a.0', message: 'a.0 must name one' }, 'plan')).toBe(
      'Pick one.',
    );
  });
});

describe('the Audit Trail’s words', () => {
  const NOW = new Date(2026, 10, 20, 12, 0).getTime();
  afterEach(() => vi.useRealTimers());

  it('names each result and tints its pill', () => {
    expect(Object.keys(RESULT_LABELS)).toEqual(Object.keys(RESULT_PILL));
    expect(RESULT_LABELS.no_match).toBe('No Match');
  });

  it('says when a rule last ran and how often', () => {
    expect(lastRunWords(null, NOW)).toBe('Never');
    expect(lastRunWords(NOW - 4 * 60_000, NOW)).toMatch(/^[A-Z0-9]/);
    expect(lastRunWords(NOW + 1000, NOW)).toBe(lastRunWords(NOW, NOW));
    expect(runsWords(1)).toBe('1 run');
    expect(runsWords(1200)).toBe('1,200 runs');
    expect(tookWords(38.4)).toBe('38 ms');
    expect(tookWords(1240)).toBe('1.2 s');
    expect(meterWords(142, 1000)).toBe('142 of 1,000');
  });

  it('says a run’s when: its time today, Yesterday, else its day', () => {
    expect(runWhen(NOW - 60 * 60_000, NOW)).toMatch(/11/);
    expect(runWhen(new Date(2026, 10, 19, 23, 0).getTime(), NOW)).toBe('Yesterday');
    expect(runWhen(new Date(2026, 10, 9, 9, 0).getTime(), NOW)).toMatch(/9/);
  });

  it('says a time rule’s next moment: today, tomorrow, within the week, else its day', () => {
    expect(nextRunWords(new Date(2026, 10, 20, 17, 5).getTime(), NOW)).toBe('Today 17:05');
    expect(nextRunWords(new Date(2026, 10, 21, 9, 0).getTime(), NOW)).toBe('Tomorrow 9:00');
    expect(nextRunWords(new Date(2026, 10, 23, 9, 0).getTime(), NOW)).toBe('Mon 9:00');
    expect(nextRunWords(new Date(2026, 11, 12, 9, 0).getTime(), NOW)).toBe('12 Dec 9:00');
  });
});

describe('values and steps', () => {
  it('builds a group of named values, and searches by label', () => {
    const group = valueGroup('item', 'This Space', ['item.name', 'rule'] as const, {
      'item.name': 'Space Name',
      rule: 'Rule Name',
    });
    expect(group.options).toEqual([
      { kind: 'value', id: 'value:item.name', label: 'Space Name', name: 'item.name' },
      { kind: 'value', id: 'value:rule', label: 'Rule Name', name: 'rule' },
    ]);
    const groups = [group, WEBHOOK_VALUE_GROUP];
    expect(filterValueGroups(groups, '  ')).toEqual(groups);
    expect(filterValueGroups(groups, 'RULE').map((g) => g.options.map((o) => o.label))).toEqual([
      ['Rule Name'],
    ]);
    expect(filterValueGroups(groups, 'webhook')).toEqual([WEBHOOK_VALUE_GROUP]);
    expect(filterValueGroups(groups, 'nothing')).toEqual([]);
  });

  it('knows the steps every app has by their shape, and names each step’s tile', () => {
    const ifElse = { kind: 'if', conditions: [], then: [], else: [] };
    const branch = { kind: 'for', conditions: [], then: [] };
    expect(isIf(ifElse)).toBe(true);
    expect(isIf(undefined)).toBe(false);
    expect(isWait({ kind: 'wait' })).toBe(true);
    expect(isOutgoing({ kind: 'notify' })).toBe(true);
    expect(isAi({ kind: 'ai' })).toBe(true);
    expect(isHolder(ifElse)).toBe(true);
    expect(isHolder(branch)).toBe(true);
    expect(isHolder({ kind: 'move' })).toBe(false);
    expect(isHolder({ kind: 'odd', conditions: [] } as never)).toBe(false);
    expect(isHolder(undefined)).toBe(false);
    expect(stepKey({ kind: 'notify', via: 'slack' } as never)).toBe('notify_slack');
    expect(stepKey({ kind: 'ai', task: 'summarise' } as never)).toBe('ai_summarise');
    expect(stepKey({ kind: 'take_snapshot' })).toBe('take_snapshot');
  });
});
