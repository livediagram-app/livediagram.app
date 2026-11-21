// A kind of trigger, condition, step or value, as one self-describing definition (blueprint item-engine.md "Kinds").
// The check, the sentence, the format agents are told, Describe a Rule and the builder's pickers all read these and
// nothing else, so a kind an app adds is whole once it is defined. Pure.

import type { AutomationGone } from '../types';
import type { Obj, TextCheck } from '../validate-read';
import type { RuleSentencePart } from '../words';
import type { ItemNames } from './names';
import type { ItemOwnRef } from './refs';
import type { ItemEvent, ItemOutline, ItemPart, ItemWord } from './types';

// What a condition or a step reads of the rule around it as it is checked.
export interface ItemReadContext {
  // The rule's trigger, as read.
  trigger: ItemPart;
  // Nobody is behind the trigger: no Who Did It, no email to whoever started it.
  personless: boolean;
  // The check of a text's values under this trigger.
  text: TextCheck;
  // Whether `name` is a value a text may hold here (a Text condition names one).
  known: (name: string) => boolean;
  // An If / Else's own conditions and actions.
  conditions: (value: unknown, path: string) => ItemPart[];
  action: (value: unknown, path: string) => ItemPart;
}

interface KindBase<Part extends ItemPart> {
  kind: string;
  // Title Case, as the picker shows it.
  name: string;
  group: string;
  // The picker's one line.
  line: string;
  // The JSON it is written as, in prose, for agents and Describe a Rule.
  format: string;
  defaults(): Part;
  words(part: Part, names: ItemNames): RuleSentencePart[];
}

// A time kind's moment, and when the item was last edited.
export interface ItemTimeMoment {
  moment: number;
  editedAt: number;
}

// A trigger that fires once things go quiet.
export interface ItemSettle<Trigger extends ItemPart = ItemPart> {
  // The event kinds that start the quiet, or push it back.
  after: readonly string[];
  // The event kinds that call it off.
  cancel?: readonly string[];
  quietMs(trigger: Trigger): number;
  // What one quiet stretch is about: a tab's id, or '' for the whole item.
  key(event: ItemEvent, trigger: Trigger): string;
}

export interface TriggerKind<Trigger extends ItemPart = ItemPart> extends KindBase<Trigger> {
  read(value: Obj, path: string): Trigger;
  // The event kinds that may start it.
  hears: readonly string[];
  matches(trigger: Trigger, event: ItemEvent): boolean;
  // The run's first line on the Audit Trail.
  said(trigger: Trigger, event: ItemEvent, names: ItemNames): string;
  personless?: true;
  // It has an `at`: the schedule wakes the item for it.
  time?: true;
  // Its runs are about a tab: Test Rule asks which.
  tabbed?: true;
  // Only where the app has comment threads and actions.
  collab?: true;
  // A time kind that runs once per stretch: the stretch's key at this moment, or null when it is not due.
  due?(trigger: Trigger, at: ItemTimeMoment): string | null;
  settle?: ItemSettle<Trigger>;
}

export interface ItemHoldContext {
  event: ItemEvent;
  now: number;
  timeZone: string;
  names: ItemNames;
  // A value's text, as a step would fill it in.
  value(name: string): string;
}

export type ItemHeld = { ok: boolean; text: string; gone?: AutomationGone };

export interface ConditionKind<Condition extends ItemPart = ItemPart> extends KindBase<Condition> {
  read(value: Obj, path: string, ctx: ItemReadContext): Condition;
  holds(condition: Condition, ctx: ItemHoldContext): ItemHeld;
  // It reads Who Did It: refused under a personless trigger.
  personal?: true;
}

export interface ItemWouldContext {
  fill(text: string): string;
  names: ItemNames;
}

export interface ActionKind<Action extends ItemPart = ItemPart> extends KindBase<Action> {
  read(value: Obj, path: string, ctx: ItemReadContext): Action;
  // What a dry run says it would do: "Would …".
  would(action: Action, ctx: ItemWouldContext): string;
  // A reader's words for it, where its sentence would say what a reader must not see.
  summary?(action: Action, names: ItemNames): string;
  // Nothing may follow it.
  last?: true;
  // Only a person saves it, never an API token.
  needsPerson?: true;
  // The rule's top level only.
  top?: true;
}

export interface ItemValueContext {
  event: ItemEvent;
  outline: ItemOutline;
  // The run's tab, when it has one.
  tab: { id: string; name: string; url: string } | null;
  // What a Summarise step before this one made.
  summary: string;
}

export interface ValueKind {
  // As written between the braces.
  name: string;
  // The chip in Insert a Value.
  label: string;
  // Only under these triggers; absent, under any.
  under?: readonly string[];
  // Only after a Summarise step.
  afterAi?: true;
  fill(ctx: ItemValueContext): string;
}

export interface ItemKindsInput {
  itemWord: ItemWord;
  // The app has comment threads and actions.
  collab: boolean;
  // The app can add a tab from a template.
  tabTemplates: boolean;
  triggers?: readonly TriggerKind[];
  conditions?: readonly ConditionKind[];
  actions?: readonly ActionKind[];
  values?: readonly ValueKind[];
  // The references of its own its kinds hold (refs.ts ItemOwnRef): a tab's named version.
  ownRefs?: readonly ItemOwnRef[];
}

export interface ItemKinds {
  itemWord: ItemWord;
  collab: boolean;
  tabTemplates: boolean;
  ownRefs?: readonly ItemOwnRef[];
  triggers: readonly TriggerKind[];
  conditions: readonly ConditionKind[];
  actions: readonly ActionKind[];
  values: readonly ValueKind[];
  trigger(kind: string): TriggerKind | undefined;
  condition(kind: string): ConditionKind | undefined;
  action(kind: string): ActionKind | undefined;
  value(name: string): ValueKind | undefined;
}

// A definition written over its own part's type, as the registry holds it (over any part). The engine only ever
// hands a definition the parts its own `read` made, which is what makes the widening sound; these give each
// definition's functions their part's type as it is written.
export const defineTrigger = <Trigger extends ItemPart>(def: TriggerKind<Trigger>): TriggerKind =>
  def;
export const defineCondition = <Condition extends ItemPart>(
  def: ConditionKind<Condition>,
): ConditionKind => def;
export const defineAction = <Action extends ItemPart>(def: ActionKind<Action>): ActionKind => def;

// Each kind once, by its key: a kind registered twice is a mistake in the app's own definitions.
function byKey<Kind>(list: readonly Kind[], key: (k: Kind) => string): Map<string, Kind> {
  const out = new Map<string, Kind>();
  for (const k of list) {
    if (out.has(key(k))) throw new Error(`automation kind defined twice: ${key(k)}`);
    out.set(key(k), k);
  }
  return out;
}

/** The registry over the lists given: the lookups every reader of a rule uses. */
export function kindsOf(
  input: Pick<ItemKindsInput, 'itemWord' | 'collab' | 'tabTemplates' | 'ownRefs'>,
  lists: Pick<ItemKinds, 'triggers' | 'conditions' | 'actions' | 'values'>,
): ItemKinds {
  const triggers = byKey(lists.triggers, (k) => k.kind);
  const conditions = byKey(lists.conditions, (k) => k.kind);
  const actions = byKey(lists.actions, (k) => k.kind);
  const values = byKey(lists.values, (k) => k.name);
  return {
    itemWord: input.itemWord,
    collab: input.collab,
    tabTemplates: input.tabTemplates,
    ...(input.ownRefs && input.ownRefs.length > 0 ? { ownRefs: input.ownRefs } : {}),
    ...lists,
    trigger: (kind) => triggers.get(kind),
    condition: (kind) => conditions.get(kind),
    action: (kind) => actions.get(kind),
    value: (name) => values.get(name),
  };
}
