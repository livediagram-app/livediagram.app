// style_design (docs/specs/015-api/mcp-server.md §4.9g): a tab's theme, finish or font changed after it was made, one
// tab or every tab of the design. Each tab is one tab_style change on the pages route, so the api applies the theme as
// the editor's pick does and everyone with the design open sees it at once.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DesignResponse, PageChange } from '@livedesign/api-schema';
import { sendPageChanges } from '@livedesign/agent-verbs';
import { mcpStyleDesign } from '@livedesign/agent-verbs/mcp';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

type Styled = { tabId: string; name: string; rev: number };

export function registerStyleTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpStyleDesign, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const change: PageChange = {
      op: 'tab_style',
      ...(args.theme ? { theme: args.theme } : {}),
      ...(args.finish ? { finish: args.finish } : {}),
      ...(args.font ? { font: args.font } : {}),
    };
    const said = [
      ...(args.theme ? [`theme ${args.theme}`] : []),
      ...(args.finish ? [`finish ${args.finish}`] : []),
      ...(args.font ? [`font ${args.font}`] : []),
    ];
    if (said.length === 0) return errorResult('Give at least one of theme, finish or font.');
    const { design } = await api.json<DesignResponse>(
      `/designs/${encodeURIComponent(args.designId)}`,
    );
    const tabs = design.tabs
      .filter((t) => !t.outOfScope)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const targets = args.tabId ? tabs.filter((t) => t.id === args.tabId) : tabs;
    if (targets.length === 0)
      return errorResult(
        args.tabId
          ? `No tab "${args.tabId}" in this design. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`
          : 'This design has no tab you can reach.',
      );
    // One tab after another: a refusal stops the call, and the tabs before it stay restyled and are named.
    const styled: Styled[] = [];
    for (const tab of targets) {
      const done = await sendPageChanges(api, args.designId, tab.id, { pages: [change] }, 'mcp');
      if (!done.ok) {
        const before = styled.length
          ? ` Restyled before it: ${styled.map((s) => `"${s.name}"`).join(', ')}.`
          : '';
        return errorResult(`Tab "${tab.name}": ${done.message}${before}`);
      }
      styled.push({ tabId: tab.id, name: tab.name, rev: done.tab.rev });
    }
    return textResult({
      designId: args.designId,
      tabs: styled,
      lines: styled.map((s) => `Restyled tab "${s.name}": ${said.join(', ')}.`),
      url: deepLink(env, args.designId),
    });
  });
}
