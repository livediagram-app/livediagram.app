// The CLI's Automations rule verbs for a product whose items run the item engine
// (liveworkspace/docs/specs/018-automations/automations.md "Agents"; each product's docs/specs/015-api/cli.md
// "Commands"): list an item's rules, read one whole, add or change one from a JSON file (or stdin), turn one on or
// off, delete or copy it, test or run it, and read the Audit Trail, through the run the MCP's list_rules and
// change_rules share (../rules). A rule is named by its id or exact name, a tab by its id or name.
import { z } from 'zod';
import type { ApiClient } from '@liveworkspace/api-client';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { columns } from '../listing';
import {
  RULE_RUNS_DEFAULT,
  RULE_RUNS_MAX,
  type RuleChange,
  type RuleListing,
  type RuleListingInput,
  type RuleProduct,
  type RuleRun,
} from '../rules';

export type RuleVerbsBinding = {
  rules: RuleProduct;
  run: RuleRun;
  // The input key the item's positional takes (`doc`), as the product's other verbs name it.
  arg: string;
  // The product's addressing: a name, id prefix or link of a live item.
  resolveFile: (
    api: ApiClient,
    input: string,
    host: string,
    log: (line: string) => void,
  ) => Promise<{ id: string; name: string }>;
};

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
  hook: z.object({ url: z.string(), secret: z.boolean() }).optional(),
});
const runOut = z.object({
  id: z.string(),
  rule: z.string(),
  tab: z.string().nullable(),
  at: z.string(),
  result: z.string(),
  reason: z.string().optional(),
  tookMs: z.number(),
  steps: z.array(z.string()),
});
const appliedOut = z.object({ applied: z.array(z.string()), runs: z.array(runOut) });
type Applied = z.infer<typeof appliedOut>;

// One rule's line: id, on, off or paused, attention, last run, week, name and sentence.
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
        r.tab ?? 'no tab',
        `${r.tookMs} ms${r.reason ? `  ${r.reason}` : ''}`,
      ],
    ]),
    ...r.steps.map((s) => `  ${s}`),
  ]);

const appliedText = ({ applied, runs }: Applied) => [
  ...applied,
  ...runs.flatMap((r) => r.steps.map((s) => `  ${s}`)),
];
const appliedQuiet = ({ applied }: Applied) => applied;

// A rule to test: a saved one's id or name, or a body from a .json file or stdin (-).
const isBodyFile = (ref: string) => ref === '-' || ref.toLowerCase().endsWith('.json');

export function createRuleVerbs({ rules, run, arg, resolveFile }: RuleVerbsBinding) {
  const { cli } = rules.product;
  const word = rules.product.word ?? rules.product.noun;
  const fileArg = z.string().describe(`A name, id prefix or ${cli} URL`);
  const ruleArg = z.string().describe('The rule, by its id or exact name');
  const jsonArg = z.string().describe('A JSON file, or - for stdin');
  const tabFlag = z.string().optional().describe('The tab the run is about, by its id or name');

  const LS_HINT = `list the rules with: ${cli} rule ls <${arg}>`;
  const FORMAT_HINT = `the rule format is change_rules’ (${cli} rule get <${arg}> <rule> prints one): {"name":"Comments by email","trigger":{"kind":"comment_added"},"steps":[{"kind":"email","to":{"owner":true},"subject":"New comment","body":"{{comment}}"}]}`;

  const itemOf = (ctx: VerbContext, input: Record<string, unknown>) =>
    resolveFile(ctx.api, input[arg] as string, ctx.host, ctx.log);

  async function listingOf(
    ctx: VerbContext,
    input: Record<string, unknown>,
    asked: RuleListingInput,
  ): Promise<RuleListing> {
    const item = await itemOf(ctx, input);
    const read = await run.readRuleListing(ctx.api, item.id, asked);
    if (!read.ok)
      throw new VerbRefusal({ status: 404, code: read.code, message: read.message, hint: LS_HINT });
    return read.listing;
  }

  // One change through the run, a refusal as the verb's.
  async function changeOne(
    ctx: VerbContext,
    input: Record<string, unknown>,
    change: RuleChange,
  ): Promise<Applied> {
    const item = await itemOf(ctx, input);
    const result = await run.applyRuleChanges(ctx.api, item.id, [change]);
    if (result.refusal) {
      const code = result.refusal.code;
      throw new VerbRefusal({
        status: /editor|read_only|a_person/.test(code)
          ? 403
          : /unknown|not_found/.test(code)
            ? 404
            : 400,
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

  const withTab = (tab: unknown) => (typeof tab === 'string' ? { tab } : {});

  const ruleLs = defineVerb({
    id: 'rule.ls',
    summary: `The Automations rules of a ${word}`,
    description:
      `Lists a ${word}’s Automations rules in order, a line each: id, on, off or paused, whether it needs ` +
      'attention, last run, runs this week, then its name and sentence ("When Comment Added then Send Email to the owner").',
    behaviour: 'read',
    input: z.object({ [arg]: fileArg }),
    output: z.object({
      rules: z.array(ruleOut),
      tabs: z.array(z.object({ id: z.string(), name: z.string() })),
      people: z.array(z.string()),
      runsToday: z.number(),
      runsPerDay: z.number(),
    }),
    listKey: 'rules',
    run: async (ctx, input) => {
      const listing = await listingOf(ctx, input, {});
      const { rules: listed, tabs, people, runsToday, runsPerDay } = listing;
      return { rules: listed, tabs, people, runsToday, runsPerDay };
    },
    text: ({ rules: listed, runsToday, runsPerDay }) =>
      listed.length === 0
        ? ['No rules.']
        : [...columns(listed.map(ruleRow)), `runs today: ${runsToday} of ${runsPerDay}`],
    quiet: ({ rules: listed }) => listed.map((r) => r.id),
    cli: {
      positionals: [arg],
      examples: [`${cli} rule ls "Launch"`, `${cli} rule ls 3f9c --json`],
      prints: 'a line a rule (id, state, attention, last run, this week, name and sentence)',
    },
  });

  const ruleGet = defineVerb({
    id: 'rule.get',
    summary: 'One Automations rule, whole',
    description:
      'Prints one rule’s line, then its whole body as JSON (trigger, conditions, steps, chain, time zone, who made ' +
      'and last changed it), the format rule add and rule set take.',
    behaviour: 'read',
    input: z.object({ [arg]: fileArg, rule: ruleArg }),
    output: z.object({ line: ruleOut, rule: z.record(z.string(), z.unknown()) }),
    run: async (ctx, input) => {
      const listing = await listingOf(ctx, input, { rule: input['rule'] });
      const body = listing.rule!;
      return { line: listing.rules.find((r) => r.id === body.id)!, rule: body };
    },
    text: ({ line, rule }) => [...columns([ruleRow(line)]), JSON.stringify(rule, null, 2)],
    quiet: ({ line }) => [line.id],
    cli: {
      positionals: [arg, 'rule'],
      examples: [
        `${cli} rule get "Launch" "Comments by email"`,
        `${cli} rule get 3f9c 6f1e2d3c --json`,
      ],
      prints: 'the rule’s line, then its body as JSON',
    },
  });

  const ruleAdd = defineVerb({
    id: 'rule.add',
    summary: 'Add an Automations rule from JSON',
    description:
      'Adds a rule from a JSON body in a file (or stdin, with -): name, trigger, and optionally conditions, steps, ' +
      'chain and timeZone (UTC by default). Tabs and people may be named by id or name. It is on once it has a step.',
    behaviour: 'write',
    input: z.object({ [arg]: fileArg, file: jsonArg }),
    output: appliedOut,
    run: async (ctx, input) =>
      changeOne(ctx, input, {
        op: 'add',
        rule: (await objectFrom(ctx, input['file'] as string)) as never,
      }),
    text: appliedText,
    quiet: appliedQuiet,
    cli: {
      positionals: [arg, 'file'],
      examples: [`${cli} rule add "Launch" comments.json`, `${cli} rule add 3f9c -`],
      prints: '+ rule <id> "<name>" (on|off)',
    },
  });

  const ruleSet = defineVerb({
    id: 'rule.set',
    summary: 'Change an Automations rule from JSON',
    description:
      'Changes a rule from a JSON object in a file (or stdin): each of name, trigger, conditions, steps, chain and ' +
      'timeZone it holds replaces the saved one whole, the rest kept. A rule left with no step turns off.',
    behaviour: 'write',
    input: z.object({ [arg]: fileArg, rule: ruleArg, file: jsonArg }),
    output: appliedOut,
    run: async (ctx, input) =>
      changeOne(ctx, input, {
        ...(await objectFrom(ctx, input['file'] as string)),
        op: 'set',
        rule: input['rule'] as string,
      }),
    text: appliedText,
    quiet: appliedQuiet,
    cli: {
      positionals: [arg, 'rule', 'file'],
      examples: [
        `${cli} rule set "Launch" "Comments by email" steps.json`,
        `${cli} rule set 3f9c 6f1e2d3c -`,
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
    const verb = id.split('.')[1]!;
    return defineVerb({
      id,
      summary,
      description,
      behaviour: op === 'delete' ? 'destructive' : 'write',
      input: z.object({ [arg]: fileArg, rule: ruleArg }),
      output: appliedOut,
      run: (ctx, input) => changeOne(ctx, input, { op, rule: input['rule'] as string }),
      text: appliedText,
      quiet: appliedQuiet,
      cli: {
        positionals: [arg, 'rule'],
        examples: [
          `${cli} rule ${verb} "Launch" "Comments by email"`,
          `${cli} rule ${verb} 3f9c 6f1e2d3c`,
        ],
        prints,
      },
    });
  }

  const ruleOn = oneRule(
    'on',
    'rule.on',
    'Turn an Automations rule on',
    'Turns a rule on; a rule that paused itself resumes, its failures cleared.',
    '~ rule "<name>" on',
  );
  const ruleOff = oneRule(
    'off',
    'rule.off',
    'Turn an Automations rule off',
    'Turns a rule off: it never runs until turned on again.',
    '~ rule "<name>" off',
  );
  const ruleRm = oneRule(
    'delete',
    'rule.rm',
    'Delete an Automations rule',
    'Deletes a rule. Its runs stay in the Audit Trail until they age out.',
    '- rule "<name>"',
  );
  const ruleDuplicate = oneRule(
    'duplicate',
    'rule.duplicate',
    'Copy an Automations rule',
    'Copies a rule as "<name> copy", off.',
    '+ rule <id> "<name> copy" (off, a copy of "<name>")',
  );

  const ruleTest = defineVerb({
    id: 'rule.test',
    summary: 'Test an Automations rule',
    description:
      'Runs a rule as Test Rule does, changing nothing and logging nothing, and prints the run: what each condition ' +
      'found and what each step would do. The rule is a saved one (by id or name) or a body in a .json file (or - ' +
      'for stdin), to try before adding it; --tab names the tab where its trigger is about one.',
    // A POST, as the api sees it: a read-only token is refused it.
    behaviour: 'write',
    input: z.object({ [arg]: fileArg, rule: ruleArg, tab: tabFlag }),
    output: appliedOut,
    run: async (ctx, input) => {
      const rule = input['rule'] as string;
      return changeOne(ctx, input, {
        op: 'test',
        rule: isBodyFile(rule) ? ((await objectFrom(ctx, rule)) as never) : rule,
        ...withTab(input['tab']),
      });
    },
    text: appliedText,
    quiet: appliedQuiet,
    cli: {
      positionals: [arg, 'rule'],
      examples: [
        `${cli} rule test "Launch" "Comments by email"`,
        `${cli} rule test 3f9c draft.json --tab "Tab 1"`,
      ],
      prints: '? tested "<name>": <result>, then its step lines',
    },
  });

  const ruleRun = defineVerb({
    id: 'rule.run',
    summary: 'Run an Automations rule, now',
    description:
      'Runs a Run by Hand rule that is on, now, as Run Rule does, and prints the run; --tab names the tab it is ' +
      `about. It counts toward the ${word}’s 1,000 runs a day.`,
    behaviour: 'write',
    input: z.object({ [arg]: fileArg, rule: ruleArg, tab: tabFlag }),
    output: appliedOut,
    run: (ctx, input) =>
      changeOne(ctx, input, {
        op: 'run',
        rule: input['rule'] as string,
        ...withTab(input['tab']),
      }),
    text: appliedText,
    quiet: appliedQuiet,
    cli: {
      positionals: [arg, 'rule'],
      examples: [
        `${cli} rule run "Launch" "Snapshot now"`,
        `${cli} rule run 3f9c 6f1e2d3c --tab "Tab 1"`,
      ],
      prints: '> ran "<name>": <result>, then its step lines',
    },
  });

  const ruleLog = defineVerb({
    id: 'rule.log',
    summary: 'The Automations Audit Trail',
    description:
      `Prints the ${word}’s recent rule runs, newest first, or one rule’s (--rule): when, the result, the rule, the ` +
      'tab and how long it took, then its step lines (✓ or ✗ per condition and step).',
    behaviour: 'read',
    input: z.object({
      [arg]: fileArg,
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
      const rule = input['rule'] as string | undefined;
      const listing = await listingOf(ctx, input, {
        ...(rule !== undefined ? { rule } : {}),
        runs: true,
        limit: input['limit'] as number,
      });
      return { runs: listing.runs! };
    },
    text: ({ runs }) => (runs.length ? runLines(runs) : ['No runs.']),
    quiet: ({ runs }) => runs.map((r) => r.id),
    cli: {
      positionals: [arg],
      examples: [
        `${cli} rule log "Launch"`,
        `${cli} rule log 3f9c --rule "Comments by email" --limit 5`,
      ],
      prints: 'a line a run (when, result, rule, tab, time), then its steps indented',
    },
  });

  return [
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
}

/** The `guide rules` topic in a product's words: the verbs, the format, and what only a person does. */
export function ruleGuide(product: RuleProduct['product']): { summary: string; text: string } {
  const { cli } = product;
  const word = product.word ?? product.noun;
  return {
    summary: 'list, add, test and run Automations rules',
    text: `Automations rules

Rules run on a ${word} by themselves: when something happens, if conditions hold, then steps.
List them, read one whole, and see what they did:

  ${cli} rule ls "Launch"
  ${cli} rule get "Launch" "Comments by email"     its body as JSON, the format add and set take
  ${cli} rule log "Launch" --limit 5               the Audit Trail, newest first

Add or change one from JSON, and test it before it runs for real:

  ${cli} rule add "Launch" rule.json               {"name":"…","trigger":{"kind":"comment_added"},"steps":[…]}
  ${cli} rule test "Launch" "Comments by email"    what each step would do, nothing changed
  ${cli} rule off "Launch" "Comments by email"

Tabs and people may be named by id or name. Rules are an Editor's of the whole ${word}. A token
never saves Revert to Snapshot and never makes an Incoming Webhook's secret: a person does both
in the editor.`,
  };
}
