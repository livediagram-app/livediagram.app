// What the item kit reads of a rule and of the registry (blueprint item-ui.md "Kinds", "Values", "Test Rule and Run
// Rule"): whether a Summarise step stands before a step, whether a rule reads the run's tab, Insert a Value's groups,
// and the pickers' groups from each kind's own `group`. Pure.

import { AUTOMATION_AI_PER_DAY, type AutomationKind } from '@liveworkspace/automations';
import {
  RUN_TAB,
  itemValueNames,
  itemValueOptions,
  inTabWords,
  itemWordTitle,
  type ItemKinds,
  type ItemValuePlace,
} from '@liveworkspace/automations/item';
import type { KindGroup } from '../kit';
import { isHolder, type RuleBody } from '../types';
import { WEBHOOK_VALUE_GROUP, type ValueGroup, type ValueOption } from '../value-groups';

/** Whether a Summarise step stands before `step` in the rule, so `{{summary}}` may be read there. An action inside
 *  an If / Else counts from the If. A step the rule lacks (or none): no. */
export function summarisedBefore(
  body: Pick<RuleBody, 'steps'> | null,
  step: AutomationKind | undefined,
): boolean {
  if (!body || !step) return false;
  let summarised = false;
  for (const s of body.steps) {
    if (s === step || (isHolder(s) && [...s.then, ...(s.else ?? [])].includes(step)))
      return summarised;
    if (s.kind === 'ai') summarised = true;
  }
  return false;
}

/** Whether the rule reads the run's tab: a Tab condition, a step on the run's tab, or a `{{tab.…}}` value. Run
 *  Rule asks which tab only then. */
export function ruleWantsTab(rule: Pick<RuleBody, 'conditions' | 'steps'>): boolean {
  const reads = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(reads);
    if (!value || typeof value !== 'object') return false;
    const part = value as Record<string, unknown>;
    if (part['kind'] === 'tab' && Array.isArray(part['tabs'])) return true;
    return part['tab'] === RUN_TAB || Object.values(part).some(reads);
  };
  const parts = [rule.conditions, rule.steps];
  return reads(parts) || itemValueNames(parts).some((name) => name.startsWith('tab.'));
}

// ---- Insert a Value --------------------------------------------------------------------------------------------------

const VALUE_GROUPS = ['item', 'tab', 'trigger', 'run', 'ai'] as const;
type ValueGroupId = (typeof VALUE_GROUPS)[number];

/** Insert a Value's groups at a place: the item, the tab, this trigger's own, who and when, AI; an Incoming Webhook
 *  rule's end with Webhook Field. An empty group is left out. */
export function itemValueGroups(kinds: ItemKinds, place: ItemValuePlace): ValueGroup[] {
  const labels: Readonly<Record<ValueGroupId, string>> = {
    item: itemWordTitle(kinds.itemWord),
    tab: inTabWords('Tab', kinds.itemWord),
    trigger: 'This Trigger',
    run: 'Who and When',
    ai: 'AI',
  };
  const groupOf = (name: string): ValueGroupId => {
    const def = kinds.value(name);
    // A name the registry lacks is one every app shares (person, rule, now).
    if (!def) return 'run';
    if (def.afterAi) return 'ai';
    if (name.startsWith('tab.')) return 'tab';
    return def.under ? 'trigger' : 'item';
  };
  const held = new Map<ValueGroupId, ValueOption[]>();
  for (const option of itemValueOptions(kinds, place)) {
    const id = groupOf(option.name);
    held.set(id, [
      ...(held.get(id) ?? []),
      { kind: 'value', id: `value:${option.name}`, label: option.label, name: option.name },
    ]);
  }
  return [
    ...VALUE_GROUPS.filter((id) => held.has(id)).map((id) => ({
      id,
      label: labels[id],
      options: held.get(id)!,
    })),
    ...(place.trigger.kind === 'incoming_webhook' ? [WEBHOOK_VALUE_GROUP] : []),
  ];
}

// ---- The pickers' groups ---------------------------------------------------------------------------------------------

/** A group's id from its name: "Other Tools" → `other-tools`. */
export const groupId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Kinds by group, each group in the order its first kind was registered.
function grouped(kinds: readonly { group: string; key: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const k of kinds) out.set(k.group, [...(out.get(k.group) ?? []), k.key]);
  return out;
}

// The groups in order: `first`, then whatever else there is as registered, then `last`.
function ordered(
  by: ReadonlyMap<string, string[]>,
  first: readonly string[],
  last: readonly string[],
  notes: Readonly<Record<string, string>> = {},
): KindGroup[] {
  const middle = [...by.keys()].filter((name) => !first.includes(name) && !last.includes(name));
  return [...first, ...middle, ...last]
    .filter((name) => by.has(name))
    .map((name) => ({
      id: groupId(name),
      name,
      kinds: by.get(name)!,
      ...(notes[name] ? { note: notes[name] } : {}),
    }));
}

/** Pick a Trigger's sections: Changes, Comments, People, the app's own groups, then Time and Other. */
export const triggerGroupsOf = (kinds: ItemKinds): KindGroup[] =>
  ordered(
    grouped(kinds.triggers.map((t) => ({ group: t.group, key: t.kind }))),
    ['Changes', 'Comments', 'People'],
    ['Time', 'Other'],
  );

export const MESSAGE_KEYS = ['notify_webhook', 'notify_slack', 'notify_teams'] as const;
export const SUMMARISE_KEY = 'ai_summarise';

// A registry action as Add an Action's tiles: its keys (`stepKey`) and the section they stand in. If / Else is no
// tile (the builder has its own button); the one message step is three tiles, by where it posts.
function tilesOf(kind: string, group: string): { group: string; key: string }[] {
  if (kind === 'if') return [];
  if (kind === 'notify') return MESSAGE_KEYS.map((key) => ({ group: 'Other Tools', key }));
  if (kind === 'ai') return [{ group: 'AI', key: SUMMARISE_KEY }];
  if (kind === 'wait') return [{ group: 'Timing', key: 'wait' }];
  return [{ group, key: kind }];
}

/** Add an Action's sections: Snapshots, Tabs, the app's own groups, then Messages, Timing, Other Tools and AI (with
 *  its daily allowance). */
export const actionGroupsOf = (kinds: ItemKinds): KindGroup[] =>
  ordered(
    grouped(kinds.actions.flatMap((a) => tilesOf(a.kind, a.group))),
    ['Snapshots', inTabWords('Tabs', kinds.itemWord)],
    ['Messages', 'Timing', 'Other Tools', 'AI'],
    { AI: `${AUTOMATION_AI_PER_DAY} a day per ${kinds.itemWord}` },
  );

/** Every tile key Add an Action offers, in order. */
export const actionKeysOf = (kinds: ItemKinds): string[] =>
  actionGroupsOf(kinds).flatMap((g) => [...g.kinds]);
