// The MCP's Automations rule tools for a product whose items run the item engine
// (liveworkspace/docs/specs/018-automations/automations.md "Agents"): list_rules reads an item's rules and recent runs,
// change_rules adds, changes, turns on and off, duplicates, deletes, tests and runs them. Each product declares them
// from here in its own words, id key and kinds, so the rule format they describe is that product's triggers,
// conditions, steps and values, read off the kinds themselves; the run is ../rules over each api's rules routes.
import { z } from 'zod';
import { AUTOMATION_NAME_MAX, AUTOMATION_RULES_MAX } from '@liveworkspace/automations';
import { itemRuleFormat } from '@liveworkspace/automations/item';
import { RULE_CHANGES_MAX, RULE_RUNS_DEFAULT, RULE_RUNS_MAX, type RuleProduct } from '../rules';
import { mcpTool } from './tool';

export function createRuleTools<K extends string>(binding: RuleProduct, idKey: K) {
  const { product, kinds } = binding;
  const { cli, collection } = product;
  const word = product.word ?? product.noun;
  const format = itemRuleFormat(kinds);
  const triggerKinds = kinds.triggers.map((t) => t.kind) as [string, ...string[]];

  const itemId = z.string().describe(`The ${word} (from find_${collection}).`);
  const url = z.string().describe(`Link that opens the ${word} in the ${cli} editor.`);
  const ruleRef = z.string().describe('The rule, by its id (from list_rules) or its exact name.');
  const tabRef = z
    .string()
    .optional()
    .describe(
      'The tab the run is about, by its id or name (list_rules lists them), where the trigger is about a tab; none for the whole item.',
    );

  // How a body names the item's things.
  const naming =
    'A tab or a person may be its id or its name ("Tab 1", "Ana Costa"), as list_rules lists them; a template is ' +
    'its kind, as list_templates lists them. A name the item lacks is kept as written: the rule saves and list_rules ' +
    `says it needs attention. A notify step names a connection by its id; connections are added in the editor.${binding.naming ? ` ${binding.naming}` : ''}`;

  const named = z.string().min(1).max(AUTOMATION_NAME_MAX);
  // The format is spelled out once, on add's rule; set and test point at it, so the tool's schema carries it once.
  const triggerOf = () => z.looseObject({ kind: z.enum(triggerKinds) });
  const partsOf = () => z.array(z.looseObject({ kind: z.string() }));
  const trigger = triggerOf().describe(`${format.trigger} ${naming}`);
  const conditions = partsOf().describe(format.conditions);
  const steps = partsOf().describe(format.steps);
  const AS_ADD = 'in the format add’s rule describes';
  const sameTrigger = triggerOf().describe(`Its trigger, ${AS_ADD}.`);
  const sameConditions = partsOf().describe(`Its conditions, ${AS_ADD}.`);
  const sameSteps = partsOf().describe(`Its steps, ${AS_ADD}.`);
  const chain = z
    .boolean()
    .describe(
      'Let this rule’s changes start other rules (chains stop 5 deep); false, the default, keeps them from it.',
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

  const bodyOf = (parts: {
    trigger: ReturnType<typeof triggerOf>;
    conditions: ReturnType<typeof partsOf>;
    steps: ReturnType<typeof partsOf>;
  }) =>
    z.strictObject({
      name: named.describe(
        `Its name, 1 to ${AUTOMATION_NAME_MAX} characters, unique in the ${word}.`,
      ),
      trigger: parts.trigger,
      conditions: parts.conditions.optional(),
      steps: parts.steps.optional(),
      chain: chain.optional(),
      timeZone: timeZone.optional(),
      ...readBack,
    });
  const ruleBody = bodyOf({ trigger, conditions, steps }).describe(
    `A whole rule. It is on once it has a step, off until then. A ${word} holds up to ${AUTOMATION_RULES_MAX} rules.`,
  );
  const triedBody = bodyOf({
    trigger: sameTrigger,
    conditions: sameConditions,
    steps: sameSteps,
  });

  const change = z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('add'), rule: ruleBody }),
    z.strictObject({
      op: z.literal('set'),
      rule: ruleRef,
      name: named.optional().describe('Its new name.'),
      trigger: sameTrigger.optional(),
      conditions: sameConditions.optional(),
      steps: sameSteps.optional(),
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
        .union([ruleRef, triedBody])
        .describe('A saved rule by id or name, or a whole rule body to try before saving it.'),
      tab: tabRef,
    }),
    z.strictObject({
      op: z.literal('run'),
      rule: ruleRef.describe('A Run by Hand rule (trigger manual) that is on.'),
      tab: tabRef,
    }),
  ]);

  const listInput = {
    [idKey]: itemId,
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
  } as { [P in K]: z.ZodString } & {
    rule: z.ZodOptional<z.ZodString>;
    runs: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodOptional<z.ZodNumber>;
  };

  const changeInput = {
    [idKey]: itemId,
    changes: z
      .array(change)
      .min(1)
      .max(RULE_CHANGES_MAX)
      .describe('Applied in order; each sees the ones before it. A refused change stops the rest.'),
  } as { [P in K]: z.ZodString } & { changes: z.ZodArray<typeof change> };

  const stamp = z.object({
    by: z.string().describe('Who, by name.'),
    at: z.string().describe('When, as an ISO time.'),
    ai: z.literal(true).optional().describe('Through an API token: an agent’s.'),
  });

  const listedRule = z.object({
    id: z.string().describe('What change_rules names it by, beside its name.'),
    name: z.string().describe(`Its name, unique in the ${word}.`),
    on: z.boolean().describe('On: it runs. Off: it never runs.'),
    paused: z.string().optional().describe('It turned itself off after 10 failures in a row: why.'),
    needsAttention: z
      .array(z.string())
      .optional()
      .describe(
        `What it names that the ${word} lacks ("Tab t1 is gone"), or has still to pick: fix it with set.`,
      ),
    trigger: z.string().describe('Its trigger’s kind.'),
    sentence: z.string().describe('The rule in words, as the Rules list reads it.'),
    lastRun: z.string().nullable().describe('When it last ran, as an ISO time, or null for never.'),
    runsThisWeek: z.number().describe('How many times it ran in the last 7 days (No Match aside).'),
    nextRun: z
      .string()
      .nullable()
      .optional()
      .describe('A time trigger’s next moment, as an ISO time (null while off).'),
    hook: z
      .object({
        url: z.string().describe('The address a service calls.'),
        secret: z
          .boolean()
          .describe(
            'Whether its secret is made: a person makes it in the editor, and reads it there once.',
          ),
      })
      .optional()
      .describe('An Incoming Webhook rule’s address.'),
  });

  const listedRun = z.object({
    id: z.string().describe('The run’s id.'),
    rule: z.string().describe('The rule’s name when it ran.'),
    tab: z
      .string()
      .nullable()
      .describe(`The tab it ran about, by name, or null for the whole ${word}.`),
    at: z.string().describe('When, as an ISO time.'),
    result: z
      .enum(['done', 'no_match', 'skipped', 'failed', 'waiting'])
      .describe('done (its steps ran), no_match, skipped, failed or waiting (held by a Wait).'),
    reason: z.string().optional().describe('Why it was skipped or failed.'),
    tookMs: z.number().describe('How long it took, in milliseconds.'),
    steps: z
      .array(z.string())
      .describe(
        'Its lines as the Audit Trail shows them: the trigger, then ✓ or ✗ per condition and step.',
      ),
  });

  const listRules = mcpTool('list_rules', {
    behaviour: 'read',
    title: `List a ${word}’s Automations rules`,
    description:
      `Read a ${word}’s Automations rules, in order: each one’s id, name, on or off, paused (and why), what it needs ` +
      '(needsAttention), its trigger, its sentence ("When Comment Added then Send Email to the owner"), last run, ' +
      'runs this week and a time trigger’s next run, with the tabs and people a rule names and the day’s runs. rule ' +
      '(an id or the exact name) also answers that rule whole, in the body format change_rules writes; runs: true ' +
      `the recent Audit Trail with each run’s tab, result and step lines. Rules are an Editor’s of the whole ${word}; ` +
      'a read-only token may list them.',
    inputSchema: listInput,
    outputSchema: {
      rules: z.array(listedRule).describe(`Every rule, in the ${word}’s order.`),
      tabs: z
        .array(
          z.object({
            id: z.string().describe('The tab’s id.'),
            name: z.string().describe('Its name.'),
          }),
        )
        .describe(`The ${word}’s tabs, as a rule names them (by id or name).`),
      people: z.array(z.string()).describe(`The ${word}’s people, by name, as a rule names them.`),
      rule: z
        .object({
          id: z.string().describe('Its id.'),
          name: z.string().describe('Its name.'),
          enabled: z.boolean().describe('On (true) or off.'),
          trigger: z.record(z.string(), z.unknown()).describe('Its trigger, by id.'),
          conditions: z.array(z.record(z.string(), z.unknown())).describe('Its conditions, by id.'),
          steps: z.array(z.record(z.string(), z.unknown())).describe('Its steps, by id.'),
          chain: z.boolean().describe('Whether its changes may start other rules.'),
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
      runsToday: z
        .number()
        .describe('Runs today (UTC) that count toward this item’s daily safety cap.'),
      runsPerDay: z
        .number()
        .describe('This item’s daily safety cap (the owner’s monthly runs are counted apart).'),
      count: z.number().describe('How many rules are listed.'),
      url,
    },
  });

  const changeRules = mcpTool('change_rules', {
    behaviour: 'destructive',
    title: `Change a ${word}’s Automations rules`,
    description:
      `Work a ${word}’s Automations rules, in order: add {rule} (a whole body), set {rule, name?, trigger?, ` +
      'conditions?, steps?, chain?, timeZone?} (each part given replaces the saved one), on {rule}, off {rule}, ' +
      'duplicate {rule}, delete {rule}, test {rule, tab?} (Test Rule: a saved rule or a body, nothing changed or ' +
      'logged) and run {rule, tab?} (Run Rule, for a Run by Hand rule that is on). Name a rule by its id or exact ' +
      'name, and tabs and people by id or name. The rule format is in the changes argument; an API token never ' +
      'saves a Revert to Snapshot step and never makes an Incoming Webhook’s secret. Every rule it saves is marked ' +
      'as made by an agent.',
    inputSchema: changeInput,
    outputSchema: {
      applied: z
        .array(z.string())
        .describe(
          'One line per change: + added or copied, ~ changed or turned on or off, - deleted, ? tested, > ran.',
        ),
      runs: z.array(listedRun).optional().describe('What each test and run did, in order.'),
      url,
    },
  });

  return { listRules, changeRules };
}
