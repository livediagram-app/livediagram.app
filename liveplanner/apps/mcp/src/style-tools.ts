// style_project (docs/specs/015-api/mcp-server.md §4.4b, docs/specs/024-agents/agent-changesets.md "Style"): one
// tab's theme, finish or font changed, or every tab's, whatever its kind. Each tab is one style changeset, so the api
// recolours it as the editor's pick does, records it and shows it live. registerTools calls this after
// registerTabTools, so the tools list in the catalogue's order.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ChangesetStyleBody, ProjectResponse } from '@liveplanner/api-schema';
import { PLANNER_FONTS } from '@liveplanner/project';
import { unknownThemeText } from '@liveplanner/agent-verbs';
import { mcpStyleProject } from '@liveplanner/agent-verbs/mcp';
import { tabIdNamed } from '@liveworkspace/mcp-kit/tab-named';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson } from './api';
import { changesetErrorText, isChangesetRefusal, submitChangeset } from './changeset-client';
import { registerTool } from './tool-annotations';
import { errorResult, requireToken, textResult } from './tool-helpers';

const FONT_IDS = PLANNER_FONTS.map((f) => f.id);

type Styled = { tabId: string; name: string; rev: number | null };

/** The style asked for, or why it is refused: at least one part, each an id the catalogues hold. */
export function styleOf(args: {
  theme?: string;
  finish?: ChangesetStyleBody['finish'];
  font?: string;
}): ChangesetStyleBody | string {
  if (args.theme === undefined && args.finish === undefined && args.font === undefined)
    return 'Give a "theme", a "finish" or a "font".';
  const unknownTheme = args.theme === undefined ? null : unknownThemeText(args.theme);
  if (unknownTheme) return unknownTheme;
  if (args.font !== undefined && !FONT_IDS.includes(args.font))
    return `Unknown font "${args.font}". Fonts: ${FONT_IDS.join(', ')}.`;
  return {
    ...(args.theme !== undefined ? { theme: args.theme } : {}),
    ...(args.finish !== undefined ? { finish: args.finish } : {}),
    ...(args.font !== undefined ? { font: args.font } : {}),
  };
}

// `Restyled tab "Board": theme forest, finish sketch.`, or that it already had that style.
function lineFor(name: string, style: ChangesetStyleBody, changed: boolean): string {
  if (!changed) return `Tab "${name}" already had that style.`;
  const parts = (['theme', 'finish', 'font'] as const)
    .filter((key) => style[key] !== undefined)
    .map((key) => `${key} ${style[key]}`);
  return `Restyled tab "${name}": ${parts.join(', ')}.`;
}

export function registerStyleTool(server: McpServer, env: Env): void {
  registerTool(server, env, mcpStyleProject, async (args, extra) => {
    const token = requireToken(extra);
    const style = styleOf(args);
    if (typeof style === 'string') return errorResult(style);
    const { project } = await apiJson<ProjectResponse>(
      env,
      token,
      `/projects/${encodeURIComponent(args.projectId)}`,
    );
    // A tab by its id, or by its name when one tab alone has it; every tab when none is named.
    let tabs = project.tabs;
    if (args.tabId !== undefined) {
      const id = tabIdNamed(project.tabs, args.tabId) ?? args.tabId;
      tabs = project.tabs.filter((t) => t.id === id);
      if (tabs.length === 0)
        return errorResult(
          `No tab "${args.tabId}" in this plan. Tabs: ${project.tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
        );
    }
    // One tab after another: a refusal stops the run, saying which tabs were restyled before it.
    const done: Styled[] = [];
    const lines: string[] = [];
    for (const tab of tabs) {
      try {
        const answer = await submitChangeset(env, token, args.projectId, tab.id, { style });
        done.push({ tabId: tab.id, name: tab.name, rev: answer.changeset?.rev ?? null });
        lines.push(lineFor(tab.name, style, answer.changeset !== null));
      } catch (err) {
        if (!isChangesetRefusal(err)) throw err;
        const before = done.length ? ` ${lines.join(' ')}` : '';
        return errorResult(`Tab "${tab.name}": ${changesetErrorText(err)}.${before}`);
      }
    }
    return textResult({ projectId: args.projectId, tabs: done, lines });
  });
}
