// Automations: the shapes every app's rules share (liveworkspace/docs/specs/018-automations/automations.md; blueprint
// engine.md "The pure entry"). A rule, its stamps, a run and its lines, generic over the kinds an app has: a trigger,
// a condition and a step are each `{ kind: string, ... }`, and an app's closed unions are instantiations of these.
// Plain JSON throughout: a rule is stored, sent and copied as written.

// A time of day, 'HH:MM' in the rule's time zone, on the quarter hour.
export type AutomationClock = string;

// Anything a rule holds by kind: a trigger, a condition, a step.
export type AutomationKind = { kind: string };

// The display identity of whoever made, changed or started something.
export type AutomationPerson = { id: string; name: string; color: string };

// Who a rule's changes are by: its `name` is the rule's name at the moment it ran.
export const AUTOMATION_PERSON_ID = 'automation';
export const AUTOMATION_COLOR = '#7c3aed';

// Who made the change a rule answers: a person through an Editor's or a Participant's access, an agent (an API
// token), a rule, or the item itself (a form response, a repeat).
export type AutomationRole = 'editor' | 'participant' | 'agent' | 'automation' | 'system';

// ---- Steps every app has ---------------------------------------------------------------------------------------------

// A day a date check compares with: a fixed day, or today shifted by whole days.
export type AutomationDay = { day: string } | { today: number };

// Wait: the rest of the rule holds for `hours`. The rule's top level only.
export type AutomationWait = { kind: 'wait'; hours: number };

// A message through one of the item's connections, by id.
export type AutomationOutgoing = {
  kind: 'notify';
  via: 'webhook' | 'slack' | 'teams';
  webhook: string;
  // The connection's name when it was picked, for the Audit Trail's "Queued for Launch Channel" (the room holds no
  // list of the item's connections); the builder's sentence reads the current name where it has one.
  name?: string;
  text: string;
};
export type AutomationVia = AutomationOutgoing['via'];

// If / Else over an app's own conditions and actions.
export type AutomationIf<Condition = AutomationKind, Action = AutomationKind> = {
  kind: 'if';
  conditions: Condition[];
  then: Action[];
  else: Action[];
};

// Scheduled: every day, every weekday, weekly on chosen days, or monthly on a day.
export type AutomationScheduled = {
  kind: 'scheduled';
  every: 'day' | 'weekday' | 'week' | 'month';
  // week: 0 Sunday … 6 Saturday, at least one.
  days?: number[];
  // month: 1 to 31; past the month's end is its last day.
  dayOfMonth?: number;
  at: AutomationClock;
};

// ---- A rule ----------------------------------------------------------------------------------------------------------

// What a person writes in the builder: everything but the stamps.
export interface AutomationRuleBody<
  Trigger extends AutomationKind = AutomationKind,
  Condition extends AutomationKind = AutomationKind,
  Step extends AutomationKind = AutomationKind,
> {
  name: string;
  trigger: Trigger;
  conditions: Condition[];
  steps: Step[];
  // "Let this rule's changes start other rules".
  chain: boolean;
  // The saver's IANA time zone, for Today and {{now}}.
  timeZone: string;
}

export interface AutomationStamp<Person = AutomationPerson> {
  by: Person;
  at: number;
  // Made through an API token (an agent), for "Edited by Ana Costa (Agent)".
  ai?: true;
  // The account behind `by`, where `by` is a person id an app made of it (liveplanner's): the author a step in another
  // app acts as (automations.md "Steps in other apps").
  account?: string;
}

// What a failed step or an unheld condition names that the item lacks, as data: its kind and its stored id.
export type AutomationGone<Kind extends string = string> = {
  kind: Kind;
  id: string;
  // A condition naming several of its kind gone: the rest of them, after `id` (absent for one).
  more?: string[];
};

// `Stamp`: the app's own stamp, where its people hold more than an AutomationPerson.
export interface AutomationRule<
  Trigger extends AutomationKind = AutomationKind,
  Condition extends AutomationKind = AutomationKind,
  Step extends AutomationKind = AutomationKind,
  Stamp = AutomationStamp,
  Gone = AutomationGone,
> extends AutomationRuleBody<Trigger, Condition, Step> {
  id: string;
  enabled: boolean;
  // Set when the rule turned itself off after AUTOMATION_FAILURES_TO_PAUSE failures; cleared by Resume. `webhook`:
  // the connection a message's failure names; `gone`: what the reason names that the item lacks.
  paused?: { reason: string; at: number; webhook?: string; gone?: Gone };
  made: Stamp;
  edited: Stamp;
}

export type AutomationPaused<Gone = AutomationGone> = NonNullable<
  AutomationRule<AutomationKind, AutomationKind, AutomationKind, AutomationStamp, Gone>['paused']
>;

// ---- Runs ------------------------------------------------------------------------------------------------------------

// `waiting`: a run held by a Wait until `waitsUntil`; it settles when the run goes on (its own row) or is dropped.
export type AutomationResult = 'done' | 'no_match' | 'skipped' | 'failed' | 'waiting';

// One line of a run on the Audit Trail. `Extra`: an app's lines of its own, beside the three every app has.
export type AutomationStepLine<Gone = AutomationGone, Person = AutomationPerson, Extra = never> =
  | { kind: 'trigger'; text: string; by?: Person }
  | { kind: 'condition'; ok: boolean; text: string; gone?: Gone }
  // `ai`: an AI step that asked the model (the day's AI count reads it).
  | {
      kind: 'action';
      ok: boolean;
      text: string;
      already?: true;
      ai?: true;
      gone?: Gone;
    }
  | Extra;

export type AutomationActionLine<Gone = AutomationGone> = Extract<
  AutomationStepLine<Gone>,
  { kind: 'action' }
>;

// A run's lines as the engine settles them: it writes action lines among whatever lines the app keeps.
export type AutomationLines = (AutomationActionLine | AutomationKind)[];

// Everything a run holds but what it is about, which an app may keep under a field of its own.
export interface AutomationRunShell<Line = AutomationStepLine, Gone = AutomationGone> {
  id: string;
  ruleId: string;
  ruleName: string;
  at: number;
  result: AutomationResult;
  // Why a run was skipped or failed, in a sentence; `gone`, what the reason names that the item lacks.
  reason?: string;
  gone?: Gone;
  tookMs: number;
  steps: Line[];
  // A waiting run's moment to go on (ms).
  waitsUntil?: number;
  // A run that went on after a Wait: how long it waited, in hours.
  afterWait?: number;
}

// What a run is about: a tab, or whatever an app's rules act on; `ref` is how people say it, `url` opens it.
export type AutomationSubject = { id: string; ref?: string; title: string; url?: string };

export interface AutomationRun<
  Line = AutomationStepLine,
  Gone = AutomationGone,
> extends AutomationRunShell<Line, Gone> {
  // Null for a run about the item alone, or one of the Audit Trail's own lines.
  subject: AutomationSubject | null;
}

// One rule's figures for the Rules list.
export interface AutomationRuleStats {
  lastRunAt: number | null;
  // A time trigger's next moment (ms), for "Next: Mon 9:00"; null otherwise.
  nextAt?: number | null;
  runsThisWeek: number;
  failuresInARow: number;
}

// The Audit Trail's filters.
export interface AutomationRunsQuery {
  rule?: string;
  result?: AutomationResult;
  since?: number;
  limit?: number;
}

// ---- Incoming Webhook ------------------------------------------------------------------------------------------------

// An Incoming Webhook rule's address, and its secret as an Editor sees it once made: its last 4 characters, when it
// was made and last used (null before Make Secret). Never the secret or its hash.
export interface AutomationHookInfo {
  url: string;
  secret: AutomationHookSecret | null;
}

export interface AutomationHookSecret {
  last4: string;
  madeAt: number;
  usedAt: number | null;
}
