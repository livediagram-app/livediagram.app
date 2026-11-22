// Automations for an item with no cards (liveworkspace/docs/specs/018-automations/automations.md; blueprint
// item-engine.md "Shapes"): the event a rule answers, the rule with open kinds, and the shapes of the kinds every app
// has. Plain JSON throughout.

import type { CrossAppChain } from '@liveworkspace/index-client';
import type {
  AutomationClock,
  AutomationIf,
  AutomationOutgoing,
  AutomationPerson,
  AutomationRule,
  AutomationRuleBody,
  AutomationRun,
  AutomationWait,
} from '../types';

// What an app calls the thing its rules belong to, as its copy says it.
export type ItemWord = 'document' | 'canvas' | 'design' | 'Space' | 'plan' | 'knowledgebase';

// Who made the change a rule answers. Absent: nobody of the item (a time, an Incoming Webhook call).
export type ItemRole = 'editor' | 'participant' | 'viewer' | 'agent' | 'automation';

// What a trigger carries beside its tab: the comment's text, a call's values (`webhook.<path>`), an app's own.
export type ItemEventData = Readonly<Record<string, string | number | boolean>>;

// One thing that happened, as the queue holds it.
export interface ItemEvent {
  id: string;
  kind: string;
  at: number;
  by?: AutomationPerson;
  role?: ItemRole;
  // The rule whose change this is, and how many rules deep the chain is.
  rule?: string;
  chain?: number;
  // The chain across apps a step in another app's rule started this with (cross-app/chain.ts): a rule here that
  // acts elsewhere carries it on, so a loop through other apps stops.
  cross?: CrossAppChain;
  tab?: string;
  data?: ItemEventData;
  // The one rule to run (Run Rule, a time, a call, a settle, a run going on after its Wait).
  ruleId?: string;
  // A run going on after its Wait: the step it goes on from, the rule's edit stamp when it waited, the hours it
  // waited and the waiting run.
  step?: number;
  edited?: number;
  waited?: number;
  origin?: string;
}

// A trigger, a condition or a step, whatever its kind holds.
export type ItemPart = { kind: string } & Record<string, unknown>;

export type ItemRuleBody = AutomationRuleBody<ItemPart, ItemPart, ItemPart>;
export type ItemRule = AutomationRule<ItemPart, ItemPart, ItemPart>;
export type ItemRun = AutomationRun;

// The item as a run reads it.
export interface ItemOutline {
  name: string;
  url: string;
  ownerId: string;
  tabs: readonly { id: string; name: string }[];
  people: readonly { id: string; name: string; email?: string }[];
  // When its content last changed (ms), where the app knows.
  editedAt?: number;
}

// ---- The shared kinds' shapes ----------------------------------------------------------------------------------------

export type ItemEdited = { kind: 'edited'; minutes: number; tab?: string };
export type ItemNotEdited = { kind: 'not_edited'; days: number; at: AutomationClock };
export type ItemTabTrigger = { kind: string; tab?: string };

export type ItemTabCondition = { kind: 'tab'; tabs: string[]; not?: true };
export type ItemWhoRole = 'editor' | 'participant' | 'agent';
export type ItemWho = { person: string } | { role: ItemWhoRole };
export type ItemWhoCondition = { kind: 'who'; who: ItemWho[]; not?: true };
export type ItemWeekdayCondition = { kind: 'weekday'; days: number[] };
export type ItemTextCondition = {
  kind: 'text';
  value: string;
  op: 'contains' | 'not_contains';
  text: string;
};

export type ItemTakeSnapshot = { kind: 'take_snapshot'; name: string };
export type ItemRevertSnapshot = { kind: 'revert_snapshot'; snapshot: string; name?: string };
export type ItemEmailTo =
  { owner: true } | { trigger: true } | { person: string } | { addresses: string[] };
export type ItemEmail = { kind: 'email'; to: ItemEmailTo; subject: string; body: string };
export type ItemAddTab = { kind: 'add_tab'; template: string; name: string };
// `tab`: 'run' for the run's own tab, a tab's id, or absent for the whole item.
export type ItemSummarise = { kind: 'ai'; task: 'summarise'; tab?: string };
export type ItemIf = AutomationIf<ItemPart, ItemPart>;
export type ItemSharedStep =
  | ItemTakeSnapshot
  | ItemRevertSnapshot
  | ItemEmail
  | ItemAddTab
  | ItemSummarise
  | ItemIf
  | AutomationWait
  | AutomationOutgoing;

// The event kind the SQL triggers stand for an edit by (never queued: it stamps `automation_edits`).
export const ITEM_EDIT_EVENT = 'edit';
// The kinds the engine itself queues: a time's moment, a call, Run Rule, a settle that fired, a Wait going on.
export const ITEM_TIME_EVENT = 'time';
export const ITEM_INCOMING_EVENT = 'incoming';
export const ITEM_MANUAL_EVENT = 'manual';
export const ITEM_SETTLED_EVENT = 'settled';
export const ITEM_RESUME_EVENT = 'resume';

// Snapshots rules may keep (spec "Revert to Snapshot").
export const AUTOMATION_KEPT_SNAPSHOTS_MAX = 5;
// A comment's opening, as `{{comment}}` reads it.
export const ITEM_COMMENT_MAX = 500;
export const EDITED_MINUTES_MIN = 5;
export const EDITED_MINUTES_MAX = 24 * 60;
export const NOT_EDITED_DAYS_MAX = 365;
