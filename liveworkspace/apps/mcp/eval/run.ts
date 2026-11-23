// The tool-pick eval, run by hand (liveworkspace/docs/specs/021-mcp/mcp.md "The tool-pick eval"): every request
// against the five app servers side by side, the one MCP's nine core verbs, and the one MCP with every tool listed,
// on Claude Opus 5.5 and Claude Haiku 5.5. Nothing runs: each call is answered by the eval (list_app_tools as the
// Worker would, anything else with a stub), up to four calls a request. Needs ANTHROPIC_API_KEY (or another
// credential the SDK finds) in the environment, never in the repo.
//
//   corepack pnpm --filter @liveworkspace/mcp-service eval [--count] [--models opus,haiku] [--only id,id] [--setups apps,one]
//
// Writes eval/results/<date>.json (every call) and prints the summary; eval/RESULTS.md keeps the last summary.
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS, REQUESTS, itemsForApps, itemsForOne, type EvalRequest } from './requests';
import {
  SETUPS,
  judge,
  loadWorld,
  readCall,
  setupOf,
  type AppCall,
  type Setup,
  type Verdict,
} from './score';

const MODELS: Record<string, string> = { opus: 'claude-opus-5-5', haiku: 'claude-haiku-5-5' };
const MAX_CALLS = 4;
const CONCURRENCY = 4;

function flag(name: string): string[] | null {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1]!.split(',') : null;
}

const models = (flag('models') ?? ['opus', 'haiku']).map((m) => MODELS[m] ?? m);
const setups = (flag('setups') ?? SETUPS) as Setup[];
const only = flag('only');
const requests = only ? REQUESTS.filter((r) => only.includes(r.id)) : REQUESTS;

const client = new Anthropic();
// Run from the package folder (the script bundles this file elsewhere first).
const EVAL_DIR = join(process.cwd(), 'eval');
const world = loadWorld(join(EVAL_DIR, 'tools'));

const PREAMBLE =
  'You are an assistant connected to the person’s liveworkspace apps through MCP tools. Do what they ask by ' +
  'calling the tools; do not ask them questions first. Their items, as an earlier search found them:';

type Outcome = Verdict & {
  id: string;
  setup: Setup;
  model: string;
  trail: { name: string; input: unknown; calls: AppCall[] }[];
  stop?: string;
  inputTokens: number;
  cacheRead: number;
  outputTokens: number;
};

async function runOne(model: string, setup: Setup, request: EvalRequest): Promise<Outcome> {
  const { tools, system } = setupOf(world, setup);
  const items = setup === 'apps' ? itemsForApps() : itemsForOne();
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `${PREAMBLE}\n${items}\n\n${request.ask}` },
  ];
  const steps: AppCall[][] = [];
  const trail: Outcome['trail'] = [];
  let usage = { inputTokens: 0, cacheRead: 0, outputTokens: 0 };
  let stop: string | undefined;
  for (let turn = 0; turn < MAX_CALLS && steps.length < MAX_CALLS; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      // Tools and system render first, so this one breakpoint caches both for every request of the setup.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: tools as Anthropic.Tool[],
      tool_choice: { type: 'auto' },
      output_config: { effort: 'medium' },
      messages,
    });
    usage = {
      inputTokens: usage.inputTokens + response.usage.input_tokens,
      cacheRead: usage.cacheRead + (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: usage.outputTokens + response.usage.output_tokens,
    };
    const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || uses.length === 0) {
      stop = response.stop_reason ?? 'none';
      break;
    }
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    let ended = false;
    for (const use of uses) {
      const read = await readCall(world, setup, use.name, use.input as Record<string, unknown>);
      trail.push({ name: use.name, input: use.input, calls: read.calls });
      if (!read.discovery) steps.push(read.calls);
      const verdict = judge(request, steps);
      if (verdict.rightTool || verdict.wrong) ended = true;
      results.push({ type: 'tool_result', tool_use_id: use.id, content: read.answer });
    }
    if (ended) break;
    messages.push({ role: 'user', content: results });
  }
  return { ...judge(request, steps), id: request.id, setup, model, trail, stop, ...usage };
}

async function pool<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const at = next++;
        out[at] = await fn(items[at]!);
      }
    }),
  );
  return out;
}

async function toolListTokens(model: string, setup: Setup): Promise<number> {
  const { tools, system } = setupOf(world, setup);
  const counted = await client.messages.countTokens({
    model,
    system,
    tools: tools as Anthropic.Tool[],
    messages: [{ role: 'user', content: 'hi' }],
  });
  const bare = await client.messages.countTokens({
    model,
    messages: [{ role: 'user', content: 'hi' }],
  });
  return counted.input_tokens - bare.input_tokens;
}

// --count: only the tool lists' token counts (count_tokens costs nothing), to price a run before making it.
if (process.argv.includes('--count')) {
  for (const model of models)
    for (const setup of setups)
      console.log(
        JSON.stringify({ model, setup, toolListTokens: await toolListTokens(model, setup) }),
      );
  process.exit(0);
}

const summary: Record<string, unknown>[] = [];
const all: Outcome[] = [];
for (const model of models) {
  for (const setup of setups) {
    const tokens = await toolListTokens(model, setup);
    // The first request alone writes the cache; the rest read it.
    const first = await runOne(model, setup, requests[0]!);
    const rest = await pool(requests.slice(1), CONCURRENCY, (r) =>
      runOne(model, setup, r).catch((err: unknown) => {
        console.error(`[eval] ${model} ${setup} ${r.id} failed`, err);
        return null;
      }),
    );
    const outcomes = [first, ...rest].filter((o): o is Outcome => o !== null);
    all.push(...outcomes);
    const n = outcomes.length;
    const row = {
      model,
      setup,
      requests: n,
      rightTool: +(outcomes.filter((o) => o.rightTool).length / n).toFixed(3),
      rightArgs: +(outcomes.filter((o) => o.rightArgs).length / n).toFixed(3),
      callsPerTask: +(outcomes.reduce((s, o) => s + o.calls, 0) / n).toFixed(2),
      toolListTokens: tokens,
      misses: outcomes.filter((o) => !o.rightTool).map((o) => o.id),
    };
    summary.push(row);
    console.log(JSON.stringify(row));
  }
}

const dir = join(EVAL_DIR, 'results');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(
  join(dir, `${stamp}.json`),
  JSON.stringify({ items: ITEMS, summary, outcomes: all }, null, 2),
);
console.log(`[eval] wrote eval/results/${stamp}.json`);
