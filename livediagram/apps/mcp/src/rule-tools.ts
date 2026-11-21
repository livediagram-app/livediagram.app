// The Automations rule tools (docs/specs/013-workspace/automations.md "Agents"; docs/specs/015-api/mcp-server.md
// "Automations rules"): list_rules reads a document's rules and recent runs and change_rules works them, over the api's
// rules routes, as its person (the shared run, @liveworkspace/agent-verbs/rules, bound in @livediagram/agent-verbs). A
// refusal answers in words, naming what was applied before it.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  mcpChangeRules,
  mcpListRules,
  ruleRun,
  threadStopText,
} from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

export function registerRuleTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListRules, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const { documentId, ...input } = args;
    const read = await ruleRun.readRuleListing(api, documentId, input);
    if (!read.ok) return errorResult(read.message);
    return textResult({ ...read.listing, url: deepLink(env, documentId) });
  });

  registerTool(server, env, mcpChangeRules, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const result = await ruleRun.applyRuleChanges(api, args.documentId, args.changes);
    if (result.refusal) return errorResult(threadStopText(result.applied, result.refusal));
    return textResult({
      applied: result.applied,
      ...(result.runs.length ? { runs: result.runs } : {}),
      url: deepLink(env, args.documentId),
    });
  });
}
