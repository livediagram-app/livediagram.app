// The Plan tools (docs/specs/026-plan/plan-agents.md, docs/specs/015-api/mcp-server.md §4.9b): list_items,
// change_items, add_board, change_board and change_card_types, over the Plan engine the CLI shares (@livediagram/agent-verbs).
// Everything is named as people name it; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  addBoard,
  applyItemChanges,
  changeBoard,
  changeCardTypes,
  planListing,
  readPlanState,
  resolveListingFilter,
} from '@livediagram/agent-verbs';
import {
  mcpAddBoard,
  mcpChangeBoard,
  mcpChangeCardTypes,
  mcpChangeItems,
  mcpListItems,
} from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult, type Extra } from './tool-helpers';

// A refusal after some changes went through says which did.
const stopped = (message: string, applied: readonly string[]) =>
  errorResult(applied.length ? `${message} Applied before it: ${applied.join('; ')}.` : message);

export function registerPlanTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListItems, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const state = await readPlanState(api, args.documentId);
    // A column or card type named as change_items names them; an unknown one is refused with the names there are.
    const filter = resolveListingFilter(state, args);
    if (!filter.ok) return errorResult(filter.message);
    return textResult({ ...planListing(state, filter), url: deepLink(env, args.documentId) });
  });

  registerTool(server, env, mcpChangeItems, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const state = await readPlanState(api, args.documentId);
    const result = await applyItemChanges(api, args.documentId, args.changes, state);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({ applied: result.applied, url: deepLink(env, args.documentId) });
  });

  registerTool(server, env, mcpAddBoard, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const { documentId, ...input } = args;
    const result = await addBoard(api, documentId, input, 'mcp');
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...board } = result;
    return textResult({ ...board, url: deepLink(env, documentId) });
  });

  registerTool(server, env, mcpChangeBoard, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const { documentId, ...input } = args;
    const result = await changeBoard(api, documentId, input, 'mcp');
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...board } = result;
    return textResult({ ...board, url: deepLink(env, documentId) });
  });

  registerTool(server, env, mcpChangeCardTypes, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const result = await changeCardTypes(api, args.documentId, args.changes);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({
      applied: result.applied,
      trashed: result.trashed,
      types: result.types,
      url: deepLink(env, args.documentId),
    });
  });
}
