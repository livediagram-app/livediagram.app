// How the tool-pick eval reads a model's calls (liveworkspace/docs/specs/021-mcp/mcp.md "The tool-pick eval"): each
// call becomes the app tools it would run (for the one MCP, through the very core verbs and catalogue the Worker
// serves), and a request is picked right when its expected app tool runs before any wrong change. Pure: CI runs it
// with no model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, appById, type AppId, type AppSpec } from '../src/apps';
import { buildAppCatalogue, type AppCatalogue, type ListedTool } from '../src/catalogue';
import { CORE_NAMES, CORE_TOOLS, runCore, textResult, type CoreContext } from '../src/core';
import { INSTRUCTIONS } from '../src/server';
import type { ArgMatch, EvalRequest, Expected } from './requests';

export type Setup = 'apps' | 'one' | 'one-all';
export const SETUPS: readonly Setup[] = ['apps', 'one', 'one-all'];

export type AppCall = { app: AppId; tool: string; args: Record<string, unknown> };

type Recorded = { tools: ListedTool[]; instructions: string };

export function recorded(app: AppId, dir = join(import.meta.dirname, 'tools')): Recorded {
  const tools = JSON.parse(readFileSync(join(dir, `${app}.json`), 'utf8')) as ListedTool[];
  const instructions = readFileSync(join(dir, `${app}.instructions.txt`), 'utf8').trim();
  return { tools, instructions };
}

export type World = {
  recorded: ReadonlyMap<AppId, Recorded>;
  catalogues: ReadonlyMap<AppId, AppCatalogue>;
};

export function loadWorld(dir?: string): World {
  const rec = new Map(APPS.map((spec) => [spec.app, recorded(spec.app, dir)] as const));
  const catalogues = new Map(
    APPS.map((spec) => [spec.app, buildAppCatalogue(spec, rec.get(spec.app)!.tools)] as const),
  );
  return { recorded: rec, catalogues };
}

// A model-facing tool: what the Messages API takes.
export type ModelTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// The Messages API takes JSON Schema 2020-12 only; zod's draft-07 tuples (`items: [...]`, `additionalItems`) become
// `prefixItems` and `items`, for every setup alike.
export function toDraft2020(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDraft2020);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  const tuple = entries.some(([k, v]) => k === 'items' && Array.isArray(v));
  for (const [key, v] of entries) {
    if (tuple && key === 'items') out.prefixItems = toDraft2020(v);
    else if (tuple && key === 'additionalItems') out.items = toDraft2020(v);
    else out[key] = toDraft2020(v);
  }
  return out;
}

function modelTool(name: string, tool: ListedTool): ModelTool {
  const { $schema: _schema, ...schema } = tool.inputSchema;
  const input_schema = toDraft2020({ type: 'object', ...schema }) as Record<string, unknown>;
  return { name, description: tool.description ?? '', input_schema };
}

const isDeprecated = (tool: ListedTool) => /\(deprecated\)/i.test(tool.title ?? '');

/** The tools and system prompt one setup shows the model. The five servers are namespaced as clients do. */
export function setupOf(world: World, setup: Setup): { tools: ModelTool[]; system: string } {
  if (setup === 'apps') {
    const tools = APPS.flatMap((spec) =>
      world.recorded
        .get(spec.app)!
        .tools.filter((t) => !isDeprecated(t))
        .map((t) => modelTool(`${spec.app}__${t.name}`, t)),
    );
    const system = APPS.map(
      (spec) =>
        `## MCP server "${spec.app}" (its tools are named ${spec.app}__*)\n${world.recorded.get(spec.app)!.instructions}`,
    ).join('\n\n');
    return { tools, system };
  }
  const core = CORE_TOOLS.map((t) => modelTool(t.name, t));
  const extra =
    setup === 'one-all'
      ? APPS.flatMap((spec) =>
          world.catalogues.get(spec.app)!.tools.map((t) => modelTool(t.name, t)),
        )
      : [];
  return { tools: [...core, ...extra], system: `## MCP server "liveworkspace"\n${INSTRUCTIONS}` };
}

/** A model's one call as the app tools it runs, and what the eval answers it with. */
export async function readCall(
  world: World,
  setup: Setup,
  name: string,
  input: Record<string, unknown>,
): Promise<{ calls: AppCall[]; answer: string; discovery: boolean }> {
  const stub = '(eval) Done. No further detail is available; carry on with the request.';
  if (setup === 'apps') {
    const at = name.indexOf('__');
    const spec = at > 0 ? appById(name.slice(0, at)) : null;
    if (!spec) return { calls: [], answer: `Unknown tool ${name}`, discovery: false };
    return {
      calls: [{ app: spec.app, tool: name.slice(at + 2), args: input }],
      answer: stub,
      discovery: false,
    };
  }
  const calls: AppCall[] = [];
  const ctx: CoreContext = {
    allowed: APPS,
    catalogue: async (spec: AppSpec) => world.catalogues.get(spec.app)!,
    call: async (spec, appTool, args) => {
      calls.push({ app: spec.app, tool: appTool, args });
      return textResult(stub);
    },
  };
  if (CORE_NAMES.has(name)) {
    const result = (await runCore(ctx, name, input))!;
    const answer = result.content.map((c) => c.text ?? '').join('\n');
    return { calls, answer, discovery: name === 'list_app_tools' };
  }
  for (const spec of APPS) {
    const appTool = world.catalogues.get(spec.app)!.toApp.get(name);
    if (appTool)
      return {
        calls: [{ app: spec.app, tool: appTool, args: input }],
        answer: stub,
        discovery: false,
      };
  }
  return { calls: [], answer: `Unknown tool ${name}`, discovery: false };
}

// A call that only reads: costs a step, never a wrong pick.
const READS = /^(find|read|list|search|get|view_tab|view_live)(_|$)/;
export function isRead(call: AppCall): boolean {
  return READS.test(call.tool);
}

function argMatches(value: unknown, match: ArgMatch): boolean {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return typeof match === 'string'
    ? text.toLowerCase().includes(match.toLowerCase())
    : match.test(text);
}

export function toolMatches(expected: Expected, call: AppCall): boolean {
  return expected.app === call.app && expected.tool === call.tool;
}

export function argsMatch(expected: Expected, call: AppCall): boolean {
  return Object.entries(expected.args ?? {}).every(([key, match]) =>
    argMatches(call.args[key], match),
  );
}

export type Verdict = {
  // The expected app tool ran before any wrong change.
  rightTool: boolean;
  // ...with the arguments that matter.
  rightArgs: boolean;
  // Model calls until then (or in all, when it never came).
  calls: number;
  // The first wrong change, when one ended it.
  wrong?: AppCall;
};

/** Judges a request's calls, in order, each as the app tools it ran. */
export function judge(request: EvalRequest, steps: readonly AppCall[][]): Verdict {
  let calls = 0;
  for (const step of steps) {
    calls += 1;
    const hit = step.find((call) => request.expect.some((x) => toolMatches(x, call)));
    if (hit) {
      const rightArgs = request.expect.some((x) => toolMatches(x, hit) && argsMatch(x, hit));
      return { rightTool: true, rightArgs, calls };
    }
    const wrong = step.find((call) => !isRead(call));
    if (wrong) return { rightTool: false, rightArgs: false, calls, wrong };
  }
  return { rightTool: false, rightArgs: false, calls };
}

/** Every expectation names a tool its app really lists (CI's check that no rename or removal broke the eval). */
export function missingExpectations(world: World, requests: readonly EvalRequest[]): string[] {
  const missing: string[] = [];
  for (const r of requests)
    for (const x of r.expect)
      if (!world.recorded.get(x.app)!.tools.some((t) => t.name === x.tool))
        missing.push(`${r.id}: ${x.app} has no ${x.tool}`);
  return missing;
}
