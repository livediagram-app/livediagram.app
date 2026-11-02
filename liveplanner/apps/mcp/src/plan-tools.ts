// The Plan tools (docs/specs/026-plan/plan-agents.md, docs/specs/015-api/mcp-server.md §4.9b): list_items,
// change_items, list_threads, change_threads, add_board, import_board, change_board and change_card_types, over the Plan engine
// the CLI shares (@liveplanner/agent-verbs).
// Everything is named as people name it; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  addBoard,
  applyItemChanges,
  applyThreadChanges,
  readThreadsState,
  threadListing,
  changeBoard,
  changeCardTypes,
  importTrackerBoard,
  planListing,
  readPlanState,
  resolveListingFilter,
  trackerImportAnswer,
} from '@liveplanner/agent-verbs';
import {
  mcpAddBoard,
  mcpChangeBoard,
  mcpChangeCardTypes,
  mcpChangeItems,
  mcpChangeThreads,
  mcpImportBoard,
  mcpListItems,
  mcpListThreads,
} from '@liveplanner/agent-verbs/mcp';
import { clientFor } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, stopped, textResult } from './tool-helpers';

export function registerPlanTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListItems, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const state = await readPlanState(api, args.projectId);
    // A column or card type named as change_items names them; an unknown one is refused with the names there are.
    const filter = resolveListingFilter(state, args);
    if (!filter.ok) return errorResult(filter.message);
    return textResult({ ...planListing(state, filter), url: deepLink(env, args.projectId) });
  });

  registerTool(server, env, mcpChangeItems, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const state = await readPlanState(api, args.projectId);
    const result = await applyItemChanges(api, args.projectId, args.changes, state);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({ applied: result.applied, url: deepLink(env, args.projectId) });
  });

  // A card's comment threads (docs/specs/026-plan/plan-agents.md "Comment threads"): read with the cards, so a
  // card is named as list_items names it.
  registerTool(server, env, mcpListThreads, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const state = await readThreadsState(api, args.projectId);
    const listing = threadListing(state, args.projectId, args.status ?? 'open', args.item);
    if (!listing.ok) return errorResult(listing.message);
    return textResult({
      threads: listing.threads,
      count: listing.threads.length,
      url: deepLink(env, args.projectId),
    });
  });

  registerTool(server, env, mcpChangeThreads, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const state = await readThreadsState(api, args.projectId);
    const result = await applyThreadChanges(api, args.projectId, args.changes, state);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({ applied: result.applied, url: deepLink(env, args.projectId) });
  });

  registerTool(server, env, mcpAddBoard, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const { projectId, ...input } = args;
    const result = await addBoard(api, projectId, input, 'mcp');
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...board } = result;
    return textResult({ ...board, url: deepLink(env, projectId) });
  });

  // Another tool's export as a Board tab or a new plan (docs/specs/026-plan/tracker-import.md "Agents").
  registerTool(server, env, mcpImportBoard, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const result = await importTrackerBoard(api, args, 'mcp');
    if (!result.ok) return errorResult(result.message);
    return textResult(
      trackerImportAnswer(result, result.projectId ? deepLink(env, result.projectId) : null),
    );
  });

  registerTool(server, env, mcpChangeBoard, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const { projectId, ...input } = args;
    const result = await changeBoard(api, projectId, input, 'mcp');
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...board } = result;
    return textResult({ ...board, url: deepLink(env, projectId) });
  });

  registerTool(server, env, mcpChangeCardTypes, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const result = await changeCardTypes(api, args.projectId, args.changes);
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({
      applied: result.applied,
      trashed: result.trashed,
      types: result.types,
      url: deepLink(env, args.projectId),
    });
  });
}
