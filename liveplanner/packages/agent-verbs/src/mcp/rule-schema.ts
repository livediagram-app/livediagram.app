// The rule tools' input and output shapes (docs/specs/026-plan/automations.md "Agents and the CLI",
// docs/specs/015-api/mcp-server.md §4.9b): list_rules and change_rules. The rule body's whole format is described
// here, inline, so the tool is the complete reference for it; the api's readRuleBody is its one check, so a body is
// loosely shaped here and refused there with the part at fault.
import { z } from 'zod';
import {
  AUTOMATION_ACTIONS_MAX,
  AUTOMATION_CONDITIONS_MAX,
  AUTOMATION_NAME_MAX,
  AUTOMATION_TRIGGER_KINDS,
} from '@liveplanner/items';
import { RULE_CHANGES_MAX, RULE_RUNS_DEFAULT, RULE_RUNS_MAX } from '../rules/rule-state';

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');
const projectId = z.string().describe('The plan (from find_projects).');
const ruleRef = z.string().describe('The rule, by its id (from list_rules) or its exact name.');
const cardRef = z.string().describe('The card, by its number ("#12") as list_items names it.');

// How a body names the plan's things (spec "The rule body").
const NAMING =
  'A column (status), card type, field, person or Form tab may be its id or its name as the board shows it ' +
  '("Done", "Bug", "Due", "Ana Costa", "RSVP"): list_items lists the columns, card types and fields, list_rules the people. ' +
  'A name the plan lacks is kept as written: the rule saves and list_rules says it needs attention.';

export const RULE_TRIGGER_FORMAT =
  'What starts the rule, exactly one: ' +
  '{"kind":"card_created","status"?:column} (a card added, by anyone or anything, optionally landing in that column); ' +
  '{"kind":"form_response","formTab"?:Form tab} (a form response makes a card); ' +
  '{"kind":"card_moved","from"?:[columns],"to"?:[columns]} (its status changes); ' +
  '{"kind":"field_changed","fields":[fields, at least one]}; ' +
  '{"kind":"comment_added"} (a thread started or replied to); ' +
  '{"kind":"manual"} (Run from a Card: run it with change_rules run); ' +
  '{"kind":"scheduled","every":"day"|"weekday"|"week"|"month","days"?:[0 Sunday to 6 Saturday, for week],' +
  '"dayOfMonth"?:1 to 31 (for month; past the month’s end is its last day),"at":"HH:MM" on the quarter hour}; ' +
  '{"kind":"due_in","days":1 to 30,"at":"HH:MM"} (that many days before a card is due); ' +
  '{"kind":"overdue","at":"HH:MM"} (the day after a card’s due date passed, not in a done column); ' +
  '{"kind":"stuck","days":1 to 90,"at":"HH:MM","statuses"?:[columns]} (daily: cards unchanged that long, outside ' +
  'done columns, once per stretch unchanged); ' +
  '{"kind":"card_archived"}; {"kind":"card_restored"}; ' +
  '{"kind":"checklist_completed"} (the last checklist item is ticked); ' +
  '{"kind":"threads_resolved"} (the last open comment thread on a card is resolved); ' +
  '{"kind":"mentioned","people"?:[people]} (a comment @mentions someone, or one of them); ' +
  '{"kind":"card_unblocked"} (the last open card blocking it is done or archived; the unblocked card runs it); ' +
  '{"kind":"related_done","related":"children"|"linked"} (the last of its children, or of the cards its Card fields ' +
  'point at, reaches a done column; that card runs it); ' +
  '{"kind":"column_limit","status":column,"limit":1 to 500} (a card goes in and the column holds more than the ' +
  'limit; once each time it goes over); ' +
  '{"kind":"pull_request_opened"}; {"kind":"pull_request_merged"}; {"kind":"pull_request_closed"}; ' +
  '{"kind":"pull_request_checks","result":"failing"|"passing"} (a GitHub pull request the card links, by a Pull ' +
  'Request or Link field or by naming the card, opened ready for review, merged, closed unmerged, or its checks ' +
  'turned failing or passing; heard only once the plan is connected to GitHub, which a person does in the app). ' +
  'A time trigger (scheduled, due_in, overdue, stuck) runs once for each card its conditions match (every card with none), ' +
  'up to 100 a moment, at the time in the rule’s timeZone, and has nobody behind it: no who condition, no ' +
  '"trigger" assignee or recipient (nor does a GitHub trigger). ' +
  NAMING;

export const RULE_CONDITIONS_FORMAT =
  `Up to ${AUTOMATION_CONDITIONS_MAX}, every one must hold (for a time trigger, they pick its cards): ` +
  '{"kind":"type","types":[card types],"not"?:true}; ' +
  '{"kind":"column","statuses":[columns],"not"?:true}; ' +
  '{"kind":"field","field":field,"op":"is"|"is_not"|"empty"|"not_empty"|"contains"|"not_contains"|"before"|' +
  '"after"|"on_or_before"|"on_or_after"|"less_than"|"more_than","value"?:...} where value is absent for empty and ' +
  'not_empty, a day for the date ops ({"day":"YYYY-MM-DD"} or {"today":±whole days}), a number for less_than and ' +
  'more_than, else text, a number or a list; ' +
  '{"kind":"who","who":[{"person":person} or {"role":"editor"|"participant"|"agent"}],"not"?:true} (who made the ' +
  'change); {"kind":"saved_filter","tab":the board’s tab,"filter":the saved filter’s id}. ' +
  'A condition on a field the card’s type lacks does not hold. Defaults to none.';

export const RULE_STEPS_FORMAT =
  `1 to ${AUTOMATION_ACTIONS_MAX} actions in order, counting those inside an if or a for: ` +
  '{"kind":"move","status":column}; ' +
  '{"kind":"set_field","field":field,"value":{"text":"..."}|{"number":n}|{"list":["..."]}|' +
  '{"date":{"today":±days}|{"day":"YYYY-MM-DD"}}|{"from":another field of the card}}; ' +
  '{"kind":"clear_field","field":field}; ' +
  '{"kind":"assign","to":{"person":person}|{"trigger":true} (whoever triggered it)|{"nobody":true}|' +
  '{"rotate":[2 to 10 people]} (each run the next, in turn)}; ' +
  '{"kind":"add_label","label":"..."}; {"kind":"remove_label","label":"..."}; ' +
  '{"kind":"comment","text":"..."} (a new thread on the card, by Automation); ' +
  '{"kind":"flag"}; {"kind":"unflag"}; {"kind":"archive"}; ' +
  '{"kind":"create_card","type":card type,"title":"...","status"?:column,"copy"?:["assignee","labels","due"],' +
  '"linkField"?:a Card field of the new card pointing back}; at most one a run; ' +
  '{"kind":"email","to":{"assignee":true}|{"trigger":true}|{"person":person},"subject":"... up to 200",' +
  '"body":"..."} (people with an account only); ' +
  '{"kind":"set_type","type":card type} (its column must suit the new type); ' +
  '{"kind":"set_colour","colour":"#rrggbb"|null}; {"kind":"restore"} (out of the archive); ' +
  '{"kind":"copy_card","status"?:column} (a copy of the card, in its column or that one; counts as the run’s one ' +
  'new card); {"kind":"add_checklist","items":["... up to 200",1 to 20]} (unticked; an item already there is ' +
  'left out); {"kind":"link_card","field":a Card field,"to":{"card":card id}|{"trigger":true}} (trigger: the card ' +
  'that started it, inside a for only); ' +
  '{"kind":"mention","to":{"assignee":true}|{"trigger":true}|{"person":person},"text":"..."} (a thread ' +
  '@mentioning them, their Inbox and a mention email); {"kind":"resolve_threads"}; ' +
  '{"kind":"wait","hours":1 to 720} (top level only, up to 3 a rule: the steps after it run when the time is up, ' +
  'if the conditions still hold); ' +
  '{"kind":"notify","via":"webhook"|"slack"|"teams","webhook":the webhook’s id from the plan’s Webhooks dialog,' +
  '"text":"..."} (top level only, up to 5 a rule; only an Editor of the whole plan can name one); ' +
  '{"kind":"if","conditions":[conditions],"then":[actions],"else":[actions]} (actions only inside); ' +
  '{"kind":"for","related":{"kind":"linked","field"?:a Card field}|{"kind":"blocked_by"}|{"kind":"blocking"}|' +
  '{"kind":"children"}|{"kind":"saved_filter","tab":tab,"filter":id},"conditions":[conditions on the related card],' +
  '"then":[1 to 10 actions, no create_card, copy_card, notify or wait]} (each related card, up to 100). ' +
  'Text (a comment, a title, a text value, an email body, a message, up to 2,000 characters) may hold values: ' +
  '{{card.title}}, {{card.key}}, {{card.url}}, {{card.assignee}}, {{card.column}}, {{card.due}}, ' +
  '{{card.field.<Field Name>}}, {{person}} (who triggered it), {{rule}}, {{now}}, {{now.date}}, {{now + 3d}} and ' +
  '{{now - 1d}}; inside a for, {{trigger.title}}, {{trigger.key}} and {{trigger.url}} name the card that started ' +
  'it. Defaults to none: a rule with no action saves off.';

const named = z.string().min(1).max(AUTOMATION_NAME_MAX);
const trigger = z
  .looseObject({ kind: z.enum(AUTOMATION_TRIGGER_KINDS) })
  .describe(RULE_TRIGGER_FORMAT);
const conditions = z.array(z.looseObject({ kind: z.string() })).describe(RULE_CONDITIONS_FORMAT);
const steps = z.array(z.looseObject({ kind: z.string() })).describe(RULE_STEPS_FORMAT);
const chain = z
  .boolean()
  .describe(
    'Let this rule’s changes trigger other rules (chains stop after 5); false, the default, keeps them from it.',
  );
const timeZone = z
  .string()
  .describe(
    'The IANA time zone its times and Today are in ("Europe/London"); UTC when an added rule names none.',
  );

const ruleBody = z
  .strictObject({
    name: named.describe(`Its name, 1 to ${AUTOMATION_NAME_MAX} characters, unique in the plan.`),
    trigger,
    conditions: conditions.optional(),
    steps: steps.optional(),
    chain: chain.optional(),
    timeZone: timeZone.optional(),
  })
  .describe(
    'A whole rule. It starts off until it has a trigger and an action, then on. A plan holds up to 50 rules.',
  );

const ruleChange = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('add'), rule: ruleBody }),
  z.strictObject({
    op: z.literal('set'),
    rule: ruleRef,
    name: named.optional().describe('Its new name.'),
    trigger: trigger.optional(),
    conditions: conditions.optional(),
    steps: steps.optional(),
    chain: chain.optional(),
    timeZone: timeZone.optional(),
  }),
  z.strictObject({
    op: z.literal('on'),
    rule: ruleRef.describe('Turned on; a paused rule resumes.'),
  }),
  z.strictObject({ op: z.literal('off'), rule: ruleRef }),
  z.strictObject({ op: z.literal('duplicate'), rule: ruleRef }),
  z.strictObject({
    op: z.literal('delete'),
    rule: ruleRef.describe('Deleted; its runs stay in the Audit Trail until they age out.'),
  }),
  z.strictObject({
    op: z.literal('test'),
    rule: z
      .union([ruleRef, ruleBody])
      .describe('A saved rule by id or name, or a whole rule body to try before saving it.'),
    card: cardRef,
  }),
  z.strictObject({
    op: z.literal('run'),
    rule: ruleRef.describe('A Run from a Card rule (trigger manual) that is on.'),
    card: cardRef,
  }),
]);

export const listRulesShape = {
  projectId,
  rule: ruleRef
    .optional()
    .describe('Also answer this rule whole (its body as change_rules writes it).'),
  runs: z
    .boolean()
    .optional()
    .describe(
      'Also answer the recent Audit Trail, newest first (this rule’s alone when rule is given).',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(RULE_RUNS_MAX)
    .optional()
    .describe(`How many runs, ${RULE_RUNS_DEFAULT} by default, up to ${RULE_RUNS_MAX}.`),
};

export const changeRulesShape = {
  projectId,
  changes: z
    .array(ruleChange)
    .min(1)
    .max(RULE_CHANGES_MAX)
    .describe('Applied in order; each sees the ones before it. A refused change stops the rest.'),
};

const stamp = z.object({
  by: z.string().describe('Who, by name.'),
  at: z.string().describe('When, as an ISO time.'),
  ai: z.literal(true).optional().describe('Through an API token: an agent’s.'),
});

const listedRule = z.object({
  id: z.string().describe('What change_rules names it by, beside its name.'),
  name: z.string().describe('Its name, unique in the plan.'),
  on: z.boolean().describe('On: it runs. Off: it never runs.'),
  paused: z.string().optional().describe('It turned itself off after 10 failures in a row: why.'),
  needsAttention: z
    .array(z.string())
    .optional()
    .describe('What it names that the plan lacks ("Column qa is gone"): fix it with set.'),
  trigger: z.enum(AUTOMATION_TRIGGER_KINDS).describe('Its trigger’s kind.'),
  sentence: z.string().describe('The rule in words, as the Rules list reads it.'),
  lastRun: z.string().nullable().describe('When it last ran, as an ISO time, or null for never.'),
  runsThisWeek: z.number().describe('How many times it ran in the last 7 days (No Match aside).'),
  nextRun: z
    .string()
    .nullable()
    .optional()
    .describe('A time trigger’s next moment, as an ISO time (null while off).'),
});

const listedRun = z.object({
  id: z.string().describe('The run’s id.'),
  rule: z.string().describe('The rule’s name when it ran.'),
  card: z.string().nullable().describe('The card it ran on, "#12 Title", or null.'),
  at: z.string().describe('When, as an ISO time.'),
  result: z
    .enum(['done', 'no_match', 'skipped', 'failed', 'waiting'])
    .describe('done (its actions ran), no_match, skipped, failed or waiting (held by a Wait).'),
  reason: z.string().optional().describe('Why it was skipped or failed.'),
  tookMs: z.number().describe('How long it took, in milliseconds.'),
  steps: z
    .array(z.string())
    .describe(
      'Its lines as the Audit Trail shows them: the trigger, then ✓ or ✗ per condition and action.',
    ),
});

export const listRulesOutput = {
  rules: z.array(listedRule).describe('Every rule, in the plan’s order.'),
  people: z.array(z.string()).describe('The plan’s people, by name, as a rule names them.'),
  rule: z
    .object({
      id: z.string().describe('Its id.'),
      name: z.string().describe('Its name.'),
      enabled: z.boolean().describe('On (true) or off.'),
      trigger: z.record(z.string(), z.unknown()).describe('Its trigger, by id.'),
      conditions: z.array(z.record(z.string(), z.unknown())).describe('Its conditions, by id.'),
      steps: z.array(z.record(z.string(), z.unknown())).describe('Its steps, by id.'),
      chain: z.boolean().describe('Whether its changes may trigger other rules.'),
      timeZone: z.string().describe('The time zone its times are in.'),
      made: stamp.describe('Who made it, and when.'),
      edited: stamp.describe('Who last changed it, and when.'),
    })
    .optional()
    .describe('The rule asked for, whole: its body by id, as change_rules set takes it.'),
  runs: z
    .array(listedRun)
    .optional()
    .describe('The Audit Trail, newest first, when runs was asked.'),
  runsToday: z.number().describe('Runs today (UTC) that count toward the day’s limit.'),
  runsPerDay: z.number().describe('The day’s limit.'),
  count: z.number().describe('How many rules are listed.'),
  url,
};

export const changeRulesOutput = {
  applied: z
    .array(z.string())
    .describe(
      'One line per change: + added or copied, ~ changed or turned on or off, - deleted, ? tested, > ran.',
    ),
  runs: z.array(listedRun).optional().describe('What each test and run did, in order.'),
  url,
};
