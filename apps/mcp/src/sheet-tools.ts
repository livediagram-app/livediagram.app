// The sheet tools (docs/specs/029-sheets/sheet-store.md "Agents", docs/specs/015-api/mcp-server.md §4.9c): list_sheets,
// read_sheet, change_sheet and add_sheet, over the sheet engine the CLI shares (@livediagram/agent-verbs). Sheets are
// named by title, cells by A1; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  addSheet,
  changeSheet,
  listSheets,
  readSheet,
  type SheetChange,
} from '@livediagram/agent-verbs';
import {
  mcpAddSheet,
  mcpChangeSheet,
  mcpListSheets,
  mcpReadSheet,
} from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult, type Extra } from './tool-helpers';

// A refusal after some changes went through says which did.
const stopped = (message: string, applied: readonly string[]) =>
  errorResult(applied.length ? `${message} Applied before it: ${applied.join('; ')}.` : message);

export function registerSheetTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListSheets, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const { sheets } = await listSheets(api, args.documentId, args.tabId);
    return textResult({ sheets, url: deepLink(args.documentId) });
  });

  registerTool(server, env, mcpReadSheet, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const read = await readSheet(api, args.documentId, {
      sheet: args.sheet,
      ...(args.range ? { range: args.range } : {}),
    });
    if (!read.ok) return errorResult(read.message);
    const { ok: _ok, ...result } = read;
    return textResult({ ...result, url: deepLink(args.documentId) });
  });

  registerTool(server, env, mcpChangeSheet, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const result = await changeSheet(
      api,
      args.documentId,
      { sheet: args.sheet, changes: args.changes as SheetChange[] },
      'mcp',
    );
    if (result.refusal) return stopped(result.refusal.message, result.applied);
    return textResult({
      sheetId: result.sheetId,
      title: result.title,
      applied: result.applied,
      rev: result.rev,
      url: deepLink(args.documentId),
    });
  });

  registerTool(server, env, mcpAddSheet, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const { documentId, ...input } = args;
    if (input.rows && input.csv !== undefined)
      return errorResult('Give the first cells as rows or as csv, not both.');
    const result = await addSheet(api, documentId, input, 'mcp');
    if (!result.ok) return errorResult(result.message);
    const { ok: _ok, ...sheet } = result;
    return textResult({ ...sheet, url: deepLink(documentId) });
  });
}
