// style_document (docs/specs/015-api/mcp-server.md §4.9f): an existing tab's theme, finish and font, as the Tab Style
// dialog sets them. Each tab is one `style` changeset (docs/specs/024-agents/agent-changesets.md), so the api applies
// the theme exactly as the editor does, records it, and relays it to anyone with the tab open.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ChangesetStyleBody,
  DocumentResponse,
  TabResponse,
  TabSummary,
} from '@livediagram/api-schema';
import { tabStyleIssue } from '@livediagram/document';
import { mcpStyleDocument } from '@livediagram/agent-verbs/mcp';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { tabIdNamed } from '@liveworkspace/mcp-kit/tab-named';
import { apiJson } from './api';
import { changesetErrorText, isChangesetRefusal, submitChangeset } from './changeset-client';
import { registerTool } from './tool-annotations';
import { errorResult, requireToken, textResult } from './tool-helpers';

type Restyled = { tabId: string; name: string; rev: number };

const PLURAL = { theme: 'themes', finish: 'finishes', font: 'fonts' } as const;

export function registerStyleTool(server: McpServer, env: Env): void {
  registerTool(server, env, mcpStyleDocument, async (args, extra) => {
    const token = requireToken(extra);
    const style: ChangesetStyleBody = {
      ...(args.theme !== undefined ? { theme: args.theme } : {}),
      ...(args.finish !== undefined ? { finish: args.finish } : {}),
      ...(args.font !== undefined ? { font: args.font } : {}),
    };
    if (Object.keys(style).length === 0)
      return errorResult('Give at least one of "theme", "finish" or "font".');
    // Checked before the first write, so a bad id never leaves the document half restyled.
    const issue = tabStyleIssue(style);
    if (issue) {
      return errorResult(
        `Unknown ${issue.field} "${String(style[issue.field])}". Valid ${PLURAL[issue.field]}: ${issue.valid.join(', ')}.`,
      );
    }
    const { document } = await apiJson<DocumentResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}`,
    );
    const targets = targetTabs(document.tabs, args.tabId);
    if (typeof targets === 'string') return errorResult(targets);
    const tabs: Restyled[] = [];
    const lines: string[] = [];
    for (const tab of targets) {
      let rev: number;
      try {
        const answer = await submitChangeset(env, token, args.documentId, tab.id, { style });
        // A restyle that changed nothing writes no changeset, so the revision is read instead.
        rev = answer.changeset?.rev ?? (await tabRev(env, token, args.documentId, tab.id));
      } catch (err) {
        if (!isChangesetRefusal(err)) throw err;
        const done = lines.length ? ` ${lines.join(' ')}` : '';
        return errorResult(`Tab "${tab.name}": ${changesetErrorText(err)}${done}`);
      }
      tabs.push({ tabId: tab.id, name: tab.name, rev });
      lines.push(restyledLine(tab.name, style));
    }
    return textResult({ documentId: args.documentId, tabs, lines });
  });
}

// The tab `tabId` names (an id, or a name one tab alone has), or every tab that is the document's own: a connected
// tab stands for another item, and a tab outside a scoped grant cannot be written. A string is the refusal.
export function targetTabs(
  tabs: readonly TabSummary[],
  tabId: string | undefined,
): readonly TabSummary[] | string {
  if (tabId === undefined) {
    const own = tabs.filter((t) => !t.connection && !t.outOfScope);
    return own.length ? own : 'That document has no tabs to restyle.';
  }
  const id = tabIdNamed(tabs, tabId);
  const tab = id === undefined ? undefined : tabs.find((t) => t.id === id);
  if (tab) return [tab];
  return `No tab "${tabId}" in this document. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`;
}

/** `Restyled tab "Flow": theme forest, finish sketch.` */
export function restyledLine(name: string, style: ChangesetStyleBody): string {
  const parts = (['theme', 'finish', 'font'] as const)
    .filter((key) => style[key] !== undefined)
    .map((key) => `${key} ${style[key]}`);
  return `Restyled tab "${name}": ${parts.join(', ')}.`;
}

async function tabRev(env: Env, token: string, documentId: string, tabId: string): Promise<number> {
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}`,
  );
  return tab.rev;
}
