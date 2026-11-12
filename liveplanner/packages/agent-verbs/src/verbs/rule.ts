// The Automations rule verbs (docs/specs/026-plan/automations.md "Agents and the CLI", docs/specs/015-api/cli.md
// "Commands"): list a plan's rules, read one whole, add or change one from a JSON file (or stdin), turn one on or
// off, delete or copy it, test or run it on a card, and read the Audit Trail, through the rules engine the MCP's
// list_rules and change_rules share. A rule is named by its id or exact name, a card by its number (#12).
import { z } from 'zod';
import { readRulesState, RULE_RUNS_DEFAULT, RULE_RUNS_MAX } from '../rules/rule-state';
import { readRuleListing, type RuleListing } from '../rules/rule-read';
import { applyRuleChanges, type RuleChange } from '../rules/rule-changes';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { columns, projectOf } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');
const ruleArg = z.string().describe('The rule, by its id or exact name');
const cardArg = z.string().describe('The card, by its number (#12)');
const fileArg = z.string().describe('A JSON file, or - for stdin');

const LS_HINT = 'list the rules with: liveplanner rule ls <project>';
const FORMAT_HINT =
  'the rule format is change_rules’ (liveplanner rule get <project> <rule> prints one): {"name":"Done stamp","trigger":{"kind":"card_moved","to":["Done"]},"steps":[{"kind":"add_label","label":"shipped"}]}';

const ruleOut = z.object({
  id: z.string(),
  name: z.string(),
  on: z.boolean(),
  paused: z.string().optional(),
  needsAttention: z.array(z.string()).optional(),
  trigger: z.string(),
  sentence: z.string(),
  lastRun: z.string().nullable(),
  runsThisWeek: z.number(),
  nextRun: z.string().nullable().optional(),
});
const runOut = z.object({
  id: z.string(),
  rule: z.string(),
  card: z.string().nullable(),
  at: z.string(),
  result: z.string(),
  reason: z.string().optional(),
  tookMs: z.number(),
  steps: z.array(z.string()),
});
const appliedOut = z.object({ applied: z.array(z.string()), runs: z.array(runOut) });

// One rule's line: id, on, off or paused, attention, last run, week, sentence.
const ruleRow = (r: z.infer<typeof ruleOut>): string[] => [
  r.id,
  r.paused ? 'paused' : r.on ? 'on' : 'off',
  r.needsAttention ? 'needs attention' : '',
  r.lastRun ? `last ${r.lastRun.slice(0, 16).replace('T', ' ')}` : 'never run',
  `${r.runsThisWeek} this week`,
  `${JSON.stringify(r.name)}: ${r.sentence}`,
];

const runLines = (runs: readonly z.infer<typeof runOut>[]): string[] =>
  runs.flatMap((r) => [
    ...columns([
      [
        r.at.slice(0, 19).replace('T', ' '),
        r.result,
        JSON.stringify(r.rule),
        r.card ?? 'no card',
        `${r.tookMs} ms${r.reason ? `  ${r.reason}` : ''}`,
      ],
    ]),
    ...r.steps.map((s) => `  ${s}`),
  ]);

async function listingOf(
  ctx: VerbContext,
  projectRef: string,
  input: Parameters<typeof readRuleListing>[2],
): Promise<RuleListing> {
  const project = await projectOf(ctx, projectRef);
  const read = await readRuleListing(ctx.api, project.id, input);
  if (!read.ok)
    throw new VerbRefusal({ status: 404, code: read.code, message: read.message, hint: LS_HINT });
  return read.listing;
}

// One change through the engine, a refusal as the verb's.
async function changeOne(
  ctx: VerbContext,
  projectRef: string,
  change: RuleChange,
): Promise<z.infer<typeof appliedOut>> {
  const project = await projectOf(ctx, projectRef);
  const state = await readRulesState(ctx.api, project.id);
  const result = await applyRuleChanges(ctx.api, project.id, [change], state);
  if (result.refusal) {
    const code = result.refusal.code;
    throw new VerbRefusal({
      status: /editor|read_only/.test(code) ? 403 : /unknown|not_found/.test(code) ? 404 : 400,
      code,
      message: result.refusal.message,
      hint:
        code.startsWith('automation_') && code !== 'automation_not_found' ? FORMAT_HINT : LS_HINT,
    });
  }
  return { applied: result.applied, runs: result.runs };
}

// A JSON object from a file or stdin, or a usage refusal saying what it should be.
async function objectFrom(ctx: VerbContext, path: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await ctx.readInput(path));
  } catch {
    parsed = undefined;
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
    return parsed as Record<string, unknown>;
  throw new VerbRefusal({
    status: 400,
    code: 'usage',
    message: 'the file is not a JSON object of a rule',
    hint: FORMAT_HINT,
  });
}

const appliedText = ({ applied, runs }: z.infer<typeof appliedOut>) => [
  ...applied,
  ...runs.flatMap((r) => r.steps.map((s) => `  ${s}`)),
];
const appliedQuiet = ({ applied }: z.infer<typeof appliedOut>) => applied;

export const ruleLs = defineVerb({
  id: 'rule.ls',
  summary: 'The Automations rules of a plan',
  description:
    'Lists a plan’s Automations rules in order, a line each: id, on, off or paused, whether it needs attention, ' +
    'last run, runs this week, then its name and sentence ("When Card Moved to Done then Add Label shipped").',
  behaviour: 'read',
  input: z.object({ project: projectArg }),
  output: z.object({
    rules: z.array(ruleOut),
    people: z.array(z.string()),
    runsToday: z.number(),
    runsPerDay: z.number(),
  }),
  listKey: 'rules',
  run: async (ctx, input) => {
    const { rules, people, runsToday, runsPerDay } = await listingOf(ctx, input.project, {});
    return { rules, people, runsToday, runsPerDay };
  },
  text: ({ rules, runsToday, runsPerDay }) =>
    rules.length === 0
      ? ['No rules.']
      : [...columns(rules.map(ruleRow)), `runs today: ${runsToday} of ${runsPerDay}`],
  quiet: ({ rules }) => rules.map((r) => r.id),
  cli: {
    positionals: ['project'],
    examples: ['liveplanner rule ls "Sprint 14"', 'liveplanner rule ls 3f9c --json'],
    prints: 'a line a rule (id, state, attention, last run, this week, name and sentence)',
  },
});

export const ruleGet = defineVerb({
  id: 'rule.get',
  summary: 'One Automations rule, whole',
  description:
    'Prints one rule’s line, then its whole body as JSON (trigger, conditions, steps, chain, time zone, who made ' +
    'and last changed it), the format rule add and rule set take.',
  behaviour: 'read',
  input: z.object({ project: projectArg, rule: ruleArg }),
  output: z.object({ line: ruleOut, rule: z.record(z.string(), z.unknown()) }),
  run: async (ctx, input) => {
    const listing = await listingOf(ctx, input.project, { rule: input.rule });
    const body = listing.rule!;
    return { line: listing.rules.find((r) => r.id === body.id)!, rule: body };
  },
  text: ({ line, rule }) => [...columns([ruleRow(line)]), JSON.stringify(rule, null, 2)],
  quiet: ({ line }) => [line.id],
  cli: {
    positionals: ['project', 'rule'],
    examples: [
      'liveplanner rule get "Sprint 14" "Done stamp"',
      'liveplanner rule get 3f9c 6f1e2d3c --json',
    ],
    prints: 'the rule’s line, then its body as JSON',
  },
});

export const ruleAdd = defineVerb({
  id: 'rule.add',
  summary: 'Add an Automations rule from JSON',
  description:
    'Adds a rule from a JSON body in a file (or stdin, with -): name, trigger, and optionally conditions, steps, ' +
    'chain and timeZone (UTC by default). Columns, card types, fields and people may be named as the board shows ' +
    'them. It starts off until it has an action.',
  behaviour: 'write',
  input: z.object({ project: projectArg, file: fileArg }),
  output: appliedOut,
  run: async (ctx, input) =>
    changeOne(ctx, input.project, {
      op: 'add',
      rule: (await objectFrom(ctx, input.file)) as never,
    }),
  text: appliedText,
  quiet: appliedQuiet,
  cli: {
    positionals: ['project', 'file'],
    examples: ['liveplanner rule add "Sprint 14" done-stamp.json', 'liveplanner rule add 3f9c -'],
    prints: '+ rule <id> "<name>" (on|off)',
  },
});

export const ruleSet = defineVerb({
  id: 'rule.set',
  summary: 'Change an Automations rule from JSON',
  description:
    'Changes a rule from a JSON object in a file (or stdin): each of name, trigger, conditions, steps, chain and ' +
    'timeZone it holds replaces the saved one whole, the rest kept. A rule left with no action turns off.',
  behaviour: 'write',
  input: z.object({ project: projectArg, rule: ruleArg, file: fileArg }),
  output: appliedOut,
  run: async (ctx, input) =>
    changeOne(ctx, input.project, {
      ...(await objectFrom(ctx, input.file)),
      op: 'set',
      rule: input.rule,
    }),
  text: appliedText,
  quiet: appliedQuiet,
  cli: {
    positionals: ['project', 'rule', 'file'],
    examples: [
      'liveplanner rule set "Sprint 14" "Done stamp" steps.json',
      'liveplanner rule set 3f9c 6f1e2d3c -',
    ],
    prints: '~ rule "<name>" changed (on|off)',
  },
});

// on, off, rm and duplicate: a rule and nothing else.
function oneRule(
  op: 'on' | 'off' | 'delete' | 'duplicate',
  id: string,
  summary: string,
  description: string,
  prints: string,
) {
  const word = id.split('.')[1]!;
  return defineVerb({
    id,
    summary,
    description,
    behaviour: op === 'delete' ? 'destructive' : 'write',
    input: z.object({ project: projectArg, rule: ruleArg }),
    output: appliedOut,
    run: (ctx, input) => changeOne(ctx, input.project, { op, rule: input.rule }),
    text: appliedText,
    quiet: appliedQuiet,
    cli: {
      positionals: ['project', 'rule'],
      examples: [
        `liveplanner rule ${word} "Sprint 14" "Done stamp"`,
        `liveplanner rule ${word} 3f9c 6f1e2d3c`,
      ],
      prints,
    },
  });
}

export const ruleOn = oneRule(
  'on',
  'rule.on',
  'Turn an Automations rule on',
  'Turns a rule on; a rule that paused itself resumes, its failures cleared.',
  '~ rule "<name>" on',
);
export const ruleOff = oneRule(
  'off',
  'rule.off',
  'Turn an Automations rule off',
  'Turns a rule off: it never runs until turned on again.',
  '~ rule "<name>" off',
);
export const ruleRm = oneRule(
  'delete',
  'rule.rm',
  'Delete an Automations rule',
  'Deletes a rule. Its runs stay in the Audit Trail until they age out.',
  '- rule "<name>"',
);
export const ruleDuplicate = oneRule(
  'duplicate',
  'rule.duplicate',
  'Copy an Automations rule',
  'Copies a rule as "<name> copy", off.',
  '+ rule <id> "<name> copy" (off, a copy of "<name>")',
);

// A rule to test: a saved one's id or name, or a body from a .json file or stdin (-).
const isBodyFile = (ref: string) => ref === '-' || ref.toLowerCase().endsWith('.json');

export const ruleTest = defineVerb({
  id: 'rule.test',
  summary: 'Test an Automations rule on a card',
  description:
    'Runs a rule on a card as Test on a Card does, changing nothing and logging nothing, and prints the run: what ' +
    'each condition found and what each action would do. The rule is a saved one (by id or name) or a body in a ' +
    '.json file (or - for stdin), to try before adding it.',
  // A POST, as the api sees it: a read-only token is refused it.
  behaviour: 'write',
  input: z.object({ project: projectArg, rule: ruleArg, card: cardArg }),
  output: appliedOut,
  run: async (ctx, input) =>
    changeOne(ctx, input.project, {
      op: 'test',
      rule: isBodyFile(input.rule) ? ((await objectFrom(ctx, input.rule)) as never) : input.rule,
      card: input.card,
    }),
  text: appliedText,
  quiet: appliedQuiet,
  cli: {
    positionals: ['project', 'rule', 'card'],
    examples: [
      'liveplanner rule test "Sprint 14" "Done stamp" "#12"',
      'liveplanner rule test 3f9c draft.json 12',
    ],
    prints: '? tested "<name>" on #<number>: <result>, then its step lines',
  },
});

export const ruleRun = defineVerb({
  id: 'rule.run',
  summary: 'Run an Automations rule on a card, now',
  description:
    'Runs a Run from a Card rule that is on, on a card, now, as Run Rule does, and prints the run. It counts toward ' +
    'the plan’s 1,000 runs a day.',
  behaviour: 'write',
  input: z.object({ project: projectArg, rule: ruleArg, card: cardArg }),
  output: appliedOut,
  run: (ctx, input) =>
    changeOne(ctx, input.project, { op: 'run', rule: input.rule, card: input.card }),
  text: appliedText,
  quiet: appliedQuiet,
  cli: {
    positionals: ['project', 'rule', 'card'],
    examples: [
      'liveplanner rule run "Sprint 14" "Escalate" "#12"',
      'liveplanner rule run 3f9c 6f1e2d3c 12',
    ],
    prints: '> ran "<name>" on #<number>: <result>, then its step lines',
  },
});

export const ruleLog = defineVerb({
  id: 'rule.log',
  summary: 'The Automations Audit Trail',
  description:
    'Prints the plan’s recent rule runs, newest first, or one rule’s (--rule): when, the result, the rule, the ' +
    'card and how long it took, then its step lines (✓ or ✗ per condition and action).',
  behaviour: 'read',
  input: z.object({
    project: projectArg,
    rule: ruleArg.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(RULE_RUNS_MAX)
      .default(RULE_RUNS_DEFAULT)
      .describe(`At most this many (up to ${RULE_RUNS_MAX})`),
  }),
  output: z.object({ runs: z.array(runOut) }),
  listKey: 'runs',
  run: async (ctx, input) => {
    const listing = await listingOf(ctx, input.project, {
      ...(input.rule !== undefined ? { rule: input.rule } : {}),
      runs: true,
      limit: input.limit,
    });
    return { runs: listing.runs! };
  },
  text: ({ runs }) => (runs.length ? runLines(runs) : ['No runs.']),
  quiet: ({ runs }) => runs.map((r) => r.id),
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner rule log "Sprint 14"',
      'liveplanner rule log 3f9c --rule "Done stamp" --limit 5',
    ],
    prints: 'a line a run (when, result, rule, card, time), then its steps indented',
  },
});

export const ruleVerbs = [
  ruleLs,
  ruleGet,
  ruleAdd,
  ruleSet,
  ruleOn,
  ruleOff,
  ruleRm,
  ruleDuplicate,
  ruleTest,
  ruleRun,
  ruleLog,
];
