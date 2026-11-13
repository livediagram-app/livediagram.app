// add_tab and update_project (docs/specs/015-api/mcp-server.md §4): a tab added to a plan, from a template or the
// calling model's elements, and a tab's elements changed or a Dashboard tab rebuilt. registerTools (tools.ts) calls
// registerTabTools in their place, so the tools list in the same order.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ChangesetRequest, TabResponse } from '@liveplanner/api-schema';
import { contentOrigin } from '@liveplanner/project';
import {
  resolveTemplate,
  templateTabs,
  validTemplateKinds,
  closestTemplatesHint,
} from '@liveplanner/templates';
import { apiJson, clientFor } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { bringBoardCardTypes, imageIdIssue } from '@liveplanner/agent-verbs';
import { dashboardLeftOffNote, dashboardRowsLeftOff, projectDashboard } from './dashboard-tabs';
import { deepLink, errorResult, loadTab, requireToken } from './tool-helpers';
import { elementsIssue } from './element-values';
import { imageResult } from './image-result';
import {
  baseFor,
  changesetErrorText,
  editsBase,
  isChangesetRefusal,
  mcpOpsToEditOperations,
  mcpResultText,
  replaceBodyFrom,
  submitChangeset,
} from './changeset-client';
import { registerTool } from './tool-annotations';
import { DASHBOARD_ALONE, addOperationsFor, addToTemplateTab, getTab } from './template-elements';
import { mcpAddTab, mcpUpdateProject } from '@liveplanner/agent-verbs/mcp';

// add_tab takes a template's first tab only (docs/specs/015-api/mcp-server.md §4.5): said in the answer when the
// template has more, so the caller knows where the rest are.
export function templateNote(template: string | undefined): { note?: string } {
  const kind = template ? resolveTemplate(template) : null;
  const tabs = kind ? templateTabs(kind) : [];
  if (tabs.length < 2) return {};
  return {
    note:
      `The ${template} template has ${tabs.length} tabs; add_tab added its first. ` +
      'create_project with this template makes all of them.',
  };
}

export function registerTabTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpAddTab, async (args, extra) => {
    const token = requireToken(extra);
    // No uploaded pictures: an image element takes no imageId (docs/specs/015-api/mcp-server.md §4.5b).
    const imageIssue = imageIdIssue(args);
    if (imageIssue) return errorResult(imageIssue);
    const tabId = crypto.randomUUID();
    // Template tab (docs/specs/015-api/mcp-server.md §4.5): resolved up front so an unknown kind
    // fails before any network round trip.
    if (args.template && !resolveTemplate(args.template)) {
      return errorResult(
        `Unknown template "${args.template}". ${closestTemplatesHint(args.template)}Valid kinds: ${validTemplateKinds()}.`,
      );
    }
    if (args.dashboard && (args.template || args.elements?.length))
      return errorResult(DASHBOARD_ALONE);
    // A Dashboard (docs/specs/026-plan/plan-agents.md "Making a dashboard"): the project's tabs and card types by name.
    let dashboard: Record<string, unknown> | undefined;
    let leftOff = 0;
    if (args.dashboard) {
      const resolved = await projectDashboard(env, token, args.projectId, args.dashboard);
      if (!resolved.ok) return errorResult(resolved.message);
      dashboard = resolved.spec;
      leftOff = dashboardRowsLeftOff(resolved.spec);
    }
    if (!args.template && !args.elements && !dashboard) {
      return errorResult(
        'Invalid input. Provide "elements", a "dashboard", or a "template" kind ' +
          'from list_templates. Check the liveplanner://schema/elements resource.',
      );
    }
    const valueIssue = args.elements ? elementsIssue(args.elements) : null;
    if (valueIssue) return errorResult(valueIssue);
    // Default the new tab's theme to the project's existing one so it matches the other tabs
    // rather than landing as a clashing brand-white tab; the model can still pass a theme.
    let themeId = args.theme;
    if (!themeId) {
      try {
        themeId = (await loadTab(env, token, args.projectId))?.tab.theme;
      } catch {
        /* the api keeps its default */
      }
    }
    // One changeset that creates the tab, so anyone with the project open sees it arrive
    // (docs/specs/015-api/mcp-server.md §4.3a).
    let answer;
    try {
      answer = await submitChangeset(env, token, args.projectId, tabId, {
        replace: replaceBodyFrom({
          ...(args.template ? { template: args.template } : {}),
          ...(dashboard ? { dashboard } : {}),
          ...(args.elements ? { elements: args.elements } : {}),
          ...(themeId ? { theme: themeId } : {}),
          ...(args.finish ? { finish: args.finish } : {}),
          name: args.name,
        }),
      });
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    // Elements given beside a template are added to the tab it built, as update_project's add ops would.
    if (args.template && args.elements?.length) {
      const built = await getTab(env, token, args.projectId, tabId);
      const added = addOperationsFor(args.elements, built);
      if ('error' in added)
        return errorResult(`The tab was made, but its elements: ${added.error}`);
      try {
        answer = await addToTemplateTab(env, token, args.projectId, tabId, built, added.operations);
      } catch (err) {
        if (isChangesetRefusal(err))
          return errorResult(
            `The tab was made, but its elements were refused: ${changesetErrorText(err)}`,
          );
        throw err;
      }
    }
    // The result PNG: the tab as stored, read once more (CS36).
    const { tab } = await apiJson<TabResponse>(
      env,
      token,
      `/projects/${encodeURIComponent(args.projectId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    // A Plan template's boards bring their card types (docs/specs/026-plan/plan-agents.md "Adding a board").
    if (args.template)
      await bringBoardCardTypes(clientFor(env, token), args.projectId, tab.elements);
    return imageResult(
      {
        projectId: args.projectId,
        tabId,
        name: tab.name,
        url: deepLink(env, args.projectId),
        changesetId: answer.changeset?.id ?? null,
        rev: tab.rev,
        text: mcpResultText(answer.text),
        ...templateNote(args.template),
        ...dashboardLeftOffNote([{ name: tab.name, dropped: leftOff }]),
      },
      tab,
      { env, token },
    );
  });

  registerTool(server, env, mcpUpdateProject, async (args, extra) => {
    const token = requireToken(extra);
    // No uploaded pictures: an image element takes no imageId (docs/specs/015-api/mcp-server.md §4.5b).
    const imageIssue = imageIdIssue(args);
    if (imageIssue) return errorResult(imageIssue);
    const loaded = await loadTab(env, token, args.projectId, args.tabId);
    if (!loaded) return errorResult('That plan has no tabs.');
    const { tab } = loaded;
    const tabId = tab.id;
    // Both modes are one changeset (docs/specs/015-api/mcp-server.md §4.4): applied, laid out and
    // relayed by the api, kept through anyone's next save. ops mode is based on what the model
    // read, so nothing a person saved in between is overwritten.
    let body: ChangesetRequest;
    let leftOff = 0;
    if (args.mode === 'replace') {
      // A Dashboard tab rebuilt whole (docs/specs/026-plan/plan-agents.md "Making a dashboard").
      if (args.dashboard) {
        const resolved = await projectDashboard(env, token, args.projectId, args.dashboard);
        if (!resolved.ok) return errorResult(resolved.message);
        leftOff = dashboardRowsLeftOff(resolved.spec);
        body = {
          replace: replaceBodyFrom({ dashboard: resolved.spec }),
        };
      } else if (!args.elements) {
        return errorResult('replace mode requires "elements" or "dashboard".');
      } else {
        const valueIssue = elementsIssue(args.elements);
        if (valueIssue) return errorResult(valueIssue);
        body = { replace: replaceBodyFrom({ elements: args.elements }) };
      }
    } else if (args.edits !== undefined) {
      if (args.ops) return errorResult('ops mode takes "ops" or "edits", not both.');
      // Edit operations as text, parsed and applied by the api (docs/specs/015-api/mcp-server.md §4.4 "Edits").
      body = { operations: args.edits, base: editsBase(tab, args.rev) };
    } else {
      if (!args.ops) return errorResult('ops mode requires "ops" or "edits".');
      const operations = mcpOpsToEditOperations(args.ops, tab);
      if (typeof operations === 'string') return errorResult(operations);
      body = { operations, base: baseFor(args.ops, tab, args.rev) };
    }
    let answer;
    try {
      answer = await submitChangeset(env, token, args.projectId, tabId, body);
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    const { tab: next } = await apiJson<TabResponse>(
      env,
      token,
      `/projects/${encodeURIComponent(args.projectId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    return imageResult(
      {
        id: args.projectId,
        projectId: args.projectId,
        tabId,
        url: deepLink(env, args.projectId),
        changesetId: answer.changeset?.id ?? null,
        rev: next.rev,
        text: mcpResultText(answer.text, contentOrigin(tab.elements)),
        ...dashboardLeftOffNote([{ name: next.name, dropped: leftOff }]),
      },
      next,
      { env, token },
    );
  });
}
