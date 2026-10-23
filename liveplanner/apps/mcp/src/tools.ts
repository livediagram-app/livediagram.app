// The MCP tools (docs/specs/015-api/mcp-server.md §4). Each is a thin wrapper over the api worker
// plus the shared project helpers (validate / build / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ChangesetRequest,
  ProjectListResponse,
  ProjectResponse,
  ShareLinkResponse,
  TabResponse,
} from '@liveplanner/api-schema';
import {
  buildTab,
  contentOrigin,
  isValidTab,
  normaliseElements,
  type Tab,
} from '@liveplanner/project';
import {
  buildDashboardTab,
  buildTemplateTabs,
  templateTabName,
  resolveTemplate,
  templateCatalogue,
  templateFamilyOf,
  templateTabs,
  validTemplateKinds,
  closestTemplatesHint,
  type TemplateKind,
} from '@liveplanner/templates';
import {
  DEFAULT_MCP_SHARE_LEVEL,
  TRASH_RETENTION_DAYS,
  creationIntentOf,
  type Project,
  type TrashedProject,
} from '@liveplanner/api-schema';
import { createdFolderLabel } from './created-folder';
import { ApiError, apiFetch, apiJson, clientFor, reportApiFailure } from './api';
import { readProject } from './read-project';
import type { Env } from './env';
import {
  bringBoardCardTypes,
  fetchTeamLibraries,
  imageIdIssue,
  matchProjects,
  resolveDashboardInput,
  type DashboardInput,
} from '@liveplanner/agent-verbs';
import { catalogueWithBoardTypes, typesOf } from '@liveplanner/items';
import { dashboardTabKind, projectDashboard } from './dashboard-tabs';
import {
  deepLink,
  errorResult,
  loadTab,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';
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
import { registerPlanTools } from './plan-tools';
import { registerSheetTools } from './sheet-tools';
import { registerFormTools } from './form-tools';
import {
  createProjectTab,
  mcpAddTab,
  mcpCreateProject,
  mcpDeleteProject,
  mcpFindProjects,
  mcpListTemplates,
  mcpListTrash,
  mcpReadProject,
  mcpRenameProject,
  mcpRestoreProject,
  mcpShareProject,
  mcpUpdateProject,
} from '@liveplanner/agent-verbs/mcp';

export function registerTools(server: McpServer, env: Env): void {
  // The items Plan boards show (docs/specs/026-plan/plan-mode.md "Agents").
  registerPlanTools(server, env);
  // Sheets, by title and A1 (docs/specs/029-sheets/sheet-store.md "Agents").
  registerSheetTools(server, env);
  registerFormTools(server, env);
  registerTool(server, env, mcpFindProjects, async (args, extra) => {
    const token = requireToken(extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-projects.md): a project filed into a
    // team leaves the personal list, so both must be swept.
    const [{ projects: liveDocs }, teamLibraries] = await Promise.all([
      apiJson<ProjectListResponse>(env, token, '/projects'),
      fetchTeamLibraries(clientFor(env, token)),
    ]);
    const matched = matchProjects(liveDocs, teamLibraries, args.query, args.limit ?? 20).map(
      (d) => ({ ...d, url: deepLink(env, d.id) }),
    );
    return textResult({ count: matched.length, projects: matched });
  });

  registerTool(server, env, mcpReadProject, async (args, extra) =>
    readProject(env, requireToken(extra as Extra), args),
  );

  registerTool(server, env, mcpListTemplates, async (_args, extra) => {
    requireToken(extra);
    return textResult(templateCatalogue());
  });

  registerTool(server, env, mcpCreateProject, async (args, extra) => {
    const token = requireToken(extra);
    // No uploaded pictures: an image element takes no imageId (docs/specs/015-api/mcp-server.md §4.5b).
    const imageIssue = imageIdIssue(args);
    if (imageIssue) return errorResult(imageIssue);
    // Accept either `tabs` (preferred) or a single `tab` alias, checked here against the tab shape.
    const single =
      args.tabs || args.tab === undefined ? null : createProjectTab.safeParse(args.tab);
    if (single && !single.success)
      return errorResult(
        `"tab": ${single.error.issues.map((i) => `${i.path.join('.') || 'tab'}: ${i.message}`).join('; ')}. ` +
          'Pass "tabs": [{ name, template | dashboard | elements }].',
      );
    const inputTabs = args.tabs ?? (single ? [single.data] : undefined);
    if (!inputTabs || inputTabs.length === 0) {
      return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
    }
    const tabs: Tab[] = [];
    const dashboards: {
      at: number;
      tabId: string;
      name: string;
      input: DashboardInput;
      theme: string | undefined;
    }[] = [];
    // The template the first tab is made from, for the creation intent.
    let firstTemplate: TemplateKind | null = null;
    // Every template tab's elements: their Plan boards bring their card types
    // (docs/specs/026-plan/plan-templates.md "Card types a template uses").
    const templateElements: Tab['elements'] = [];
    for (const [index, given] of inputTabs.entries()) {
      const tabId = crypto.randomUUID();
      // A template tab's name follows the templates' rule; any other unnamed tab is "Tab n".
      const kindOf = given.template ? resolveTemplate(given.template) : null;
      const t = {
        ...given,
        name: kindOf ? templateTabName(given.name, kindOf) : (given.name ?? `Tab ${index + 1}`),
      };
      // Template tab (docs/specs/015-api/mcp-server.md §4.5): materialise the curated scaffold
      // instead of expecting elements.
      if (t.template) {
        const kind = resolveTemplate(t.template);
        if (!kind) {
          return errorResult(
            `Unknown template "${t.template}" in tab "${t.name}". ${closestTemplatesHint(t.template)}` +
              `Valid kinds: ${validTemplateKinds()}.`,
          );
        }
        if (tabs.length === 0) firstTemplate = kind;
        // A template of several tabs adds them all, the first named as given
        // (docs/specs/026-plan/plan-templates.md "How a template with tabs is made").
        const made = buildTemplateTabs(
          { id: tabId, name: t.name },
          kind,
          () => crypto.randomUUID(),
          t.theme ?? args.theme,
        );
        tabs.push(...made);
        for (const m of made) templateElements.push(...m.elements);
        continue;
      }
      // A Dashboard (docs/specs/026-plan/plan-agents.md "Making a dashboard"): made once every other tab is, so it
      // can show them by name.
      if (t.dashboard) {
        dashboards.push({
          at: tabs.length,
          tabId,
          name: t.name,
          input: t.dashboard,
          theme: t.theme ?? args.theme,
        });
        continue;
      }
      const valueIssue = elementsIssue(t.elements ?? []);
      if (valueIssue) return errorResult(`Tab "${t.name}": ${valueIssue}`);
      const candidate: unknown = {
        id: tabId,
        name: t.name,
        elements: normaliseElements(t.elements ?? []),
      };
      if (!t.elements || !isValidTab(candidate)) {
        return errorResult(
          `Invalid elements in tab "${t.name}". Provide "elements" (or a "template" kind ` +
            'from list_templates). Check the liveplanner://schema/elements resource: every ' +
            'element needs id/type/shape/x/y/width/height, and arrays must be well-formed.',
        );
      }
      tabs.push(buildTab(tabId, t.name, candidate.elements, 'preserve', t.theme ?? args.theme));
    }
    // Each Dashboard, showing the call's other tabs by name, in its place among them.
    if (dashboards.length) {
      const refs = tabs.map((t) => ({ id: t.id, name: t.name, of: dashboardTabKind(t) }));
      const types = typesOf(catalogueWithBoardTypes(null, templateElements));
      for (const [n, d] of dashboards.entries()) {
        const resolved = resolveDashboardInput(d.input, refs, types);
        if (!resolved.ok) return errorResult(`Tab "${d.name}": ${resolved.message}`);
        tabs.splice(d.at + n, 0, buildDashboardTab(d.tabId, d.name, resolved.spec, d.theme).tab);
      }
    }
    // The finish asked for (docs/specs/008-canvas/finish.md) is every new tab's.
    if (args.finish) for (const t of tabs) t.finish = args.finish;
    const id = crypto.randomUUID();
    // Tag the project as made by AI (docs/specs/013-workspace/folders.md): the Explorer's Made by AI
    // filter and badge read source != null, wherever the project is filed.
    // The creation intent (docs/specs/013-workspace/default-folders.md): with no folder named, the
    // server files the project in the user's default folder for it, when they have one.
    const intent = creationIntentOf(tabs[0], templateFamilyOf(firstTemplate));
    const itemTypes = catalogueWithBoardTypes(null, templateElements);
    const { project: created } = await apiJson<{ project?: Project }>(env, token, '/projects', {
      method: 'POST',
      // markUsed only when the model gave one: absent, the making counts (the api's default).
      body: JSON.stringify({
        id,
        name: args.name,
        tabs,
        source: 'mcp',
        intent,
        ...(itemTypes ? { itemTypes } : {}),
        ...(args.markUsed !== undefined ? { markUsed: args.markUsed } : {}),
      }),
    });
    const tabIds = tabs.map((t) => t.id);
    return imageResult(
      {
        id,
        projectId: id,
        name: args.name,
        tabCount: tabs.length,
        tabIds,
        folder: await createdFolderLabel(env, token, created),
        url: deepLink(env, id),
      },
      tabs[0]!,
      { env, token },
    );
  });

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
    // A Dashboard (docs/specs/026-plan/plan-agents.md "Making a dashboard"): the project's tabs and card types by name.
    let dashboard: Record<string, unknown> | undefined;
    if (args.dashboard) {
      const resolved = await projectDashboard(env, token, args.projectId, args.dashboard);
      if (!resolved.ok) return errorResult(resolved.message);
      dashboard = resolved.spec;
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
    if (args.mode === 'replace') {
      // A Dashboard tab rebuilt whole (docs/specs/026-plan/plan-agents.md "Making a dashboard").
      if (args.dashboard) {
        const resolved = await projectDashboard(env, token, args.projectId, args.dashboard);
        if (!resolved.ok) return errorResult(resolved.message);
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
      },
      next,
      { env, token },
    );
  });

  registerTool(server, env, mcpShareProject, async (args, extra) => {
    const token = requireToken(extra);
    // Default to Participant (docs/specs/013-workspace/share-roles.md): people take part without reshaping the
    // board, and an automated share never silently grants edit. The api's own default is edit, so the role is
    // always sent.
    const role = args.role ?? DEFAULT_MCP_SHARE_LEVEL;
    const { link } = await apiJson<ShareLinkResponse>(
      env,
      token,
      `/projects/${encodeURIComponent(args.projectId)}/share`,
      { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
    );
    return textResult({
      url: shareUrl(env, link.code),
      role: link.role,
      expiresAt: link.expiresAt,
      projectUrl: deepLink(env, args.projectId),
    });
  });

  registerTool(server, env, mcpRenameProject, async (args, extra) => {
    const token = requireToken(extra);
    if (args.tabId) {
      // The tab name route: the name only, relayed to anyone with the project open
      // (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames").
      const { tab } = await apiJson<{ tab: { name: string } }>(
        env,
        token,
        `/projects/${encodeURIComponent(args.projectId)}/tabs/${encodeURIComponent(args.tabId)}/name`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({ renamed: 'tab', tabId: args.tabId, name: tab.name });
    }
    const { project: liveDoc } = await apiJson<ProjectResponse>(
      env,
      token,
      `/projects/${encodeURIComponent(args.projectId)}`,
      { method: 'PUT', body: JSON.stringify({ name: args.name }) },
    );
    return textResult({
      renamed: 'project',
      id: liveDoc.id,
      name: liveDoc.name,
      url: deepLink(env, liveDoc.id),
    });
  });

  registerTool(server, env, mcpDeleteProject, async (args, extra) => {
    const token = requireToken(extra);
    // A whole project only ever goes to the Trash (docs/specs/013-workspace/trash.md):
    // a permanent delete is the REST API's, never an AI tool's. A tab has no Trash.
    const path = args.tabId
      ? `/projects/${encodeURIComponent(args.projectId)}/tabs/${encodeURIComponent(args.tabId)}`
      : `/projects/${encodeURIComponent(args.projectId)}`;
    // DELETE returns 204 with no body, so use apiFetch (apiJson would choke
    // parsing an empty response) and surface a clear message on failure.
    const res = await apiFetch(env, token, path, { method: 'DELETE' });
    if (!res.ok) {
      // A 5xx is a real failure worth surfacing on the Exceptions dashboard;
      // a 4xx (bad id, last tab) is model-correctable and not reported.
      if (res.status >= 500) reportApiFailure(env, `Http${res.status}`);
      return errorResult(
        `Could not delete (${res.status}). ${deleteRefusal(res.status, Boolean(args.tabId))}`,
      );
    }
    return textResult(
      args.tabId
        ? { deleted: 'tab', projectId: args.projectId, tabId: args.tabId }
        : {
            deleted: 'project',
            projectId: args.projectId,
            trashed: true,
            restorableForDays: TRASH_RETENTION_DAYS,
          },
    );
  });

  // The Trash (docs/specs/013-workspace/trash.md, docs/specs/015-api/mcp-server.md §4.9):
  // what delete_project put there, and the way back. Same authorisation as
  // GET /api/trash and POST /api/trash/<id>/restore: the user's personal Trash
  // and every team Trash they have joined.
  registerTool(server, env, mcpListTrash, async (_args, extra) => {
    const token = requireToken(extra);
    const { trash } = await apiJson<{ trash?: TrashedProject[] }>(env, token, '/trash');
    return textResult({
      trash: (trash ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        library: t.teamName ?? (t.teamId ? 'team' : 'personal'),
        reason: t.reason,
        deletedAt: new Date(t.trashedAt).toISOString(),
        purgeAt: new Date(t.purgeAt).toISOString(),
      })),
    });
  });

  registerTool(server, env, mcpRestoreProject, async (args, extra) => {
    const token = requireToken(extra);
    try {
      const { project: liveDoc } = await apiJson<{
        project?: { id: string; name: string } | null;
      }>(env, token, `/trash/${encodeURIComponent(args.projectId)}/restore`, { method: 'POST' });
      return textResult({
        restored: 'project',
        id: liveDoc?.id ?? args.projectId,
        name: liveDoc?.name ?? null,
        url: deepLink(env, liveDoc?.id ?? args.projectId),
      });
    } catch (err) {
      // Not in the Trash, or not the user's to restore: model-correctable.
      if (err instanceof ApiError && err.status === 404) {
        return errorResult(
          'That plan is not in the Trash, or is not yours to restore. Check the id with list_trash.',
        );
      }
      throw err;
    }
  });
}

// Why a delete was refused, by what was deleted and the status.
export function deleteRefusal(status: number, tab: boolean): string {
  if (status === 410) return 'It is already in the Trash (see list_trash).';
  if (status === 403) return 'You may view this plan but not change it.';
  if (status === 404)
    return tab
      ? 'No such tab in this plan: read_project lists its tabs.'
      : 'No such plan, or it is not yours: find_projects lists them.';
  if (tab && status === 409)
    return 'A plan must keep at least one tab: you cannot delete the last one.';
  return tab
    ? `The api refused it (${status}): check the plan and tab ids.`
    : 'Check the plan id and that you own it.';
}

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
