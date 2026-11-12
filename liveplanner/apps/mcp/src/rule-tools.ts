// The Automations rule tools (docs/specs/026-plan/automations.md "Agents and the CLI", docs/specs/015-api/mcp-server.md
// §4.9b): list_rules and change_rules, over the rules engine the CLI shares (@liveplanner/agent-verbs). A refusal is a
// tool error with the api's code and the part of the rule at fault.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applyRuleChanges, readRuleListing, readRulesState } from '@liveplanner/agent-verbs';
import { mcpChangeRules, mcpListRules } from '@liveplanner/agent-verbs/mcp';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, stopped, textResult } from './tool-helpers';

export function registerRuleTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListRules, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const { projectId, ...input } = args;
    const read = await readRuleListing(api, projectId, input);
    if (!read.ok) return errorResult(read.message);
    return textResult({ ...read.listing, url: deepLink(env, projectId) });
  });

  registerTool(server, env, mcpChangeRules, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const state = await readRulesState(api, args.projectId);
    const result = await applyRuleChanges(api, args.projectId, args.changes, state);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({
      applied: result.applied,
      ...(result.runs.length ? { runs: result.runs } : {}),
      url: deepLink(env, args.projectId),
    });
  });
}
