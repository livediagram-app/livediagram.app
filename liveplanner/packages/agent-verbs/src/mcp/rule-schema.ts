// The rule tools' input and output shapes (docs/specs/026-plan/automations.md "Agents and the CLI",
// docs/specs/015-api/mcp-server.md §4.9b): list_rules and change_rules. The rule body's whole format is described
// here, inline, so the tool is the complete reference for it; the api's readRuleBody is its one check, so a body is
// loosely shaped here and refused there with the part at fault.
import { z } from 'zod';
import {
  AUTOMATION_NAME_MAX,
  AUTOMATION_TRIGGER_KINDS,
  RULE_CONDITIONS_FORMAT,
  RULE_STEPS_FORMAT,
  RULE_TRIGGER_FORMAT,
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

const named = z.string().min(1).max(AUTOMATION_NAME_MAX);
const trigger = z
  .looseObject({ kind: z.enum(AUTOMATION_TRIGGER_KINDS) })
  .describe(`${RULE_TRIGGER_FORMAT} ${NAMING}`);
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

// What list_rules' `rule` answers beside its body: taken, so a rule read back writes back, and ignored.
const READ_BACK = 'list_rules’ own, accepted and ignored (on and off are their own changes).';
const readBack = {
  id: z.unknown().optional().describe(READ_BACK),
  enabled: z.unknown().optional().describe(READ_BACK),
  made: z.unknown().optional().describe(READ_BACK),
  edited: z.unknown().optional().describe(READ_BACK),
};

const ruleBody = z
  .strictObject({
    name: named.describe(`Its name, 1 to ${AUTOMATION_NAME_MAX} characters, unique in the plan.`),
    trigger,
    conditions: conditions.optional(),
    steps: steps.optional(),
    chain: chain.optional(),
    timeZone: timeZone.optional(),
    ...readBack,
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
    ...readBack,
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
