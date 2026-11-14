// Automations: one card's walk through a run's steps (docs/specs/026-plan/automations.md "Actions"; blueprint
// automations.md "Files"): what a run plans (the PlannedRun shapes), the state every card's walk in one run shares
// (lines, actions so far, turns taken, messages, related cards), and one card's patch as the steps build it.
// plan-actions.ts walks the steps over it. Pure.

import type { Item, ItemFieldValue, ItemFields, ItemPatch, ItemPerson } from '../item';
import type { ItemTypeDef } from '../item-types';
import { isEmptyFieldValue } from '../required-fields';
import { typeIn } from '../type-catalogue';
import {
  AUTOMATION_PERSON_ID,
  type AutomationGone,
  type AutomationOutgoing,
  type AutomationStepLine,
} from './types';
import type { ConditionContext } from './conditions';
import type { ValueContext } from './values';
import type { PullRequestValues } from './github-triggers';
import type { PlannedAi } from './ai-steps';
import type { WebhookValues } from './webhook-paths';

export interface PlanActionsContext extends ConditionContext {
  rule: { name: string };
  // The link that opens the card, for {{card.url}}.
  url: string;
  // The plan's cards, for a branch's related cards (absent: a branch finds none).
  items?: readonly Item[];
  // The link that opens another card (a branch's related card); absent, the triggering card's link.
  urlOf?: (cardId: string) => string;
  // The rule's place in Assign in Turn's list (the api's automation_rules.turn).
  turn?: number;
  // An Incoming Webhook run: the values its call gave; and whether it runs with no card (incoming.ts).
  webhook?: WebhookValues;
  cardless?: boolean;
  // A GitHub run: the pull request its values read (github-triggers.ts).
  github?: PullRequestValues;
}

// The card a Create Card makes: its type, its column (absent: the type's Default State) and fields.
export interface PlannedCard {
  type: string;
  status?: string;
  fields: ItemFields;
}

// An email to send: the person it goes to (null: nobody, so none is sent), or the typed-in addresses it goes to
// (spec "Typed-in addresses"), its subject and body, filled in.
export interface PlannedEmail {
  to: ItemPerson | null;
  addresses?: string[];
  subject: string;
  body: string;
}

// A thread @mentioning a person (null: nobody to mention, so none is started), its message filled in.
export interface PlannedMention {
  to: ItemPerson | null;
  text: string;
}

// A message through one of the plan's webhooks: the step it came from (its key with the run's), the webhook, the
// message filled in, and the line the run settles once the index answers.
export interface PlannedSend {
  step: number;
  via: AutomationOutgoing['via'];
  webhook: string;
  name?: string;
  text: string;
  line: number;
}

// A branch's related card: its one patch, its threads and emails, and why it failed (what came before still lands).
export interface PlannedRelated {
  card: Item;
  patch: ItemPatch;
  comments: string[];
  emails: PlannedEmail[];
  mentions: PlannedMention[];
  resolve: boolean;
  failed?: string;
  gone?: AutomationGone;
}

// The writes of the steps between two AI steps (or before the first, or after the last): the triggering card's one
// patch, the threads it starts, the card it makes, its emails and its related cards' writes (spec "How a step runs").
export interface PlannedSegment {
  patch: ItemPatch;
  comments: string[];
  created: PlannedCard[];
  emails: PlannedEmail[];
  mentions: PlannedMention[];
  // Resolve Threads: the card's open threads resolved.
  resolve: boolean;
  related: PlannedRelated[];
}

// What a run writes: the writes of the steps before its first AI step (all of them, with none), its outgoing
// messages, and how many turns Assign in Turn took. `ai`: its AI steps (present only when it has one), each asked
// in its place, its `after` the writes of the steps after it.
export interface PlannedWrites extends PlannedSegment {
  // A Wait reached: how long, and the step the rest of the rule goes on from.
  wait?: { hours: number; from: number };
  sends: PlannedSend[];
  turns: number;
  ai?: PlannedAi[];
}

// A failed run keeps `done`, the steps before the one that failed (spec "Actions": the steps before it stay done).
export type PlannedRun =
  | (PlannedWrites & { lines: AutomationStepLine[] })
  | { failed: string; gone?: AutomationGone; lines: AutomationStepLine[]; done: PlannedWrites };

const same = (a: ItemFieldValue | undefined, b: ItemFieldValue | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// What every card's walk in one run shares: the lines, the actions so far, the turns taken, the messages and the
// related cards' plans.
export class Run {
  readonly lines: AutomationStepLine[] = [];
  readonly sends: PlannedSend[] = [];
  readonly related: PlannedRelated[] = [];
  readonly ai: PlannedAi[] = [];
  actions = 0;
  turns = 0;
}

// One card's walk: the card as the steps so far left it, and the one patch that gets it there. Its lines go to the
// run's, after `prefix` (a related card's number).
export class Plan {
  readonly set: ItemFields = {};
  readonly clear = new Set<string>();
  readonly comments: string[] = [];
  readonly created: PlannedCard[] = [];
  readonly emails: PlannedEmail[] = [];
  readonly mentions: PlannedMention[] = [];
  resolve = false;
  // Change Card Type: the type the card becomes.
  type: string | undefined;
  card: Item;
  // The cards the run's earlier segments make (AUTOMATION_CREATED_PER_RUN counts the whole run's).
  madeBefore = 0;

  private readonly was: ItemFields;

  readonly run: Run;
  readonly prefix: string;

  constructor(card: Item, run: Run, prefix = '') {
    this.run = run;
    this.prefix = prefix;
    this.was = card.fields;
    this.card = { ...card, fields: { ...card.fields } };
  }

  // Sets or clears one field: whether that changed the card. The patch holds what differs from the card as it was.
  write(field: string, value: ItemFieldValue | undefined): boolean {
    const next = value === undefined || isEmptyFieldValue(value) ? undefined : value;
    if (same(this.card.fields[field], next)) return false;
    if (next === undefined) delete this.card.fields[field];
    else this.card.fields[field] = next;
    delete this.set[field];
    this.clear.delete(field);
    if (!same(this.was[field], next)) {
      if (next === undefined) this.clear.add(field);
      else this.set[field] = next;
    }
    return true;
  }

  line(text: string, changed = true): void {
    this.run.lines.push({
      kind: 'action',
      ok: true,
      text: `${this.prefix}${text}`,
      ...(changed ? {} : { already: true as const }),
    });
  }

  failure(reason: string, gone?: AutomationGone): void {
    this.run.lines.push({
      kind: 'action',
      ok: false,
      text: `${this.prefix}${reason}`,
      ...(gone ? { gone } : {}),
    });
  }

  // Changes the card's type: whether that changed it.
  retype(type: string): boolean {
    if (this.card.type === type) return false;
    this.card = { ...this.card, type };
    this.type = type;
    return true;
  }

  patch(): ItemPatch {
    return {
      ...(Object.keys(this.set).length ? { set: { ...this.set } } : {}),
      ...(this.clear.size ? { clear: [...this.clear] } : {}),
      ...(this.type !== undefined ? { type: this.type } : {}),
    };
  }
}

// What one card's walk reads: the run's context, the card's type and its values.
export type Walk = { plan: Plan; ctx: PlanActionsContext; type: ItemTypeDef; values: ValueContext };

export const walkOf = (card: Item, run: Run, ctx: PlanActionsContext, prefix = ''): Walk => {
  const type = typeIn(ctx.outline.types, card.type);
  const plan = new Plan(card, run, prefix);
  const values: ValueContext = {
    card: plan.card,
    type,
    outline: ctx.outline,
    url: ctx.url,
    // A time trigger's or a rule's change: Automation, never the rule's own name.
    person: ctx.by.id === AUTOMATION_PERSON_ID ? 'Automation' : ctx.by.name,
    rule: ctx.rule.name,
    now: ctx.now,
    timeZone: ctx.timeZone,
    ...(ctx.webhook ? { webhook: ctx.webhook } : {}),
    ...(ctx.cardless ? { cardless: true } : {}),
    ...(ctx.github ? { github: ctx.github } : {}),
  };
  return { plan, ctx, type, values };
};
