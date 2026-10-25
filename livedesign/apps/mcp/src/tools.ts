// The MCP tools (docs/specs/015-api/mcp-server.md §4). Each is a thin wrapper over the api worker
// plus the shared design helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ChangesetRequest,
  DesignListResponse,
  DesignResponse,
  ShareLinkResponse,
  TabResponse,
} from '@livedesign/api-schema';
import {
  buildTab,
  contentOrigin,
  isValidTab,
  normaliseElements,
  type Tab,
} from '@livedesign/design';
import {
  buildTemplateTabs,
  templateTabName,
  resolveTemplate,
  templateCatalogue,
  validTemplateKinds,
  closestTemplatesHint,
} from '@livedesign/templates';
import {
  DEFAULT_MCP_SHARE_LEVEL,
  TRASH_RETENTION_DAYS,
  creationIntentOf,
  type LiveDoc,
  type TrashedDesign,
} from '@livedesign/api-schema';
import { createdFolderLabel } from './created-folder';
import { ApiError, apiFetch, apiJson, clientFor, reportApiFailure } from './api';
import { readDesign } from './read-design';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { fetchTeamLibraries, matchDesigns } from '@livedesign/agent-verbs';
import {
  deepLink,
  errorResult,
  loadTab,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';
import { lintLineOf, lintReportsOf, lintTextOf } from './lint-summary';
import { idsOf, resolveArrowEnds } from './arrow-ends';
import { elementsIssue } from './element-values';
import { packFreehandPoints } from './freehand-points';
import { searchIcons } from '@liveworkspace/icons/search';
import { imageResult } from './image-result';
import { imageIdIssue, registerImageTools } from './image-tools';
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
import { registerPagesTools } from './pages-tools';
import {
  createDesignTab,
  mcpAddTab,
  mcpCreateDesign,
  mcpDeleteDesign,
  mcpFindDesigns,
  mcpListTemplates,
  mcpListTrash,
  mcpReadDesign,
  mcpRenameDesign,
  mcpRestoreDesign,
  mcpSearchIcons,
  mcpShareDesign,
  mcpUpdateDesign,
} from '@livedesign/agent-verbs/mcp';

export function registerTools(server: McpServer, env: Env): void {
  registerPagesTools(server, env);
  // The user's image gallery, for image elements (docs/specs/015-api/mcp-server.md §4.5b).
  registerImageTools(server, env);
  registerTool(server, env, mcpFindDesigns, async (args, extra) => {
    const token = requireToken(extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-designs.md): a design filed into a
    // team leaves the personal list, so both must be swept.
    const [{ designs: liveDocs }, teamLibraries] = await Promise.all([
      apiJson<DesignListResponse>(env, token, '/designs'),
      fetchTeamLibraries(clientFor(env, token)),
    ]);
    const matched = matchDesigns(liveDocs, teamLibraries, args.query, args.limit ?? 20).map(
      (d) => ({ ...d, url: deepLink(env, d.id) }),
    );
    return textResult({ count: matched.length, designs: matched });
  });

  registerTool(server, env, mcpReadDesign, async (args, extra) =>
    readDesign(env, requireToken(extra as Extra), args),
  );

  registerTool(server, env, mcpListTemplates, async (_args, extra) => {
    requireToken(extra);
    return textResult(templateCatalogue());
  });

  // The icon catalogue is bundled, so a search needs no api call (docs/specs/015-api/mcp-server.md §4.5a).
  registerTool(server, env, mcpSearchIcons, async (args, extra) => {
    requireToken(extra);
    return textResult(searchIcons(args.query, args.limit ?? 20));
  });

  registerTool(server, env, mcpCreateDesign, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    // Accept either `tabs` (preferred) or a single `tab` alias, checked here against the tab shape.
    const single = args.tabs || args.tab === undefined ? null : createDesignTab.safeParse(args.tab);
    if (single && !single.success)
      return errorResult(
        `"tab": ${single.error.issues.map((i) => `${i.path.join('.') || 'tab'}: ${i.message}`).join('; ')}. ` +
          'Pass "tabs": [{ name, elements | template }].',
      );
    const inputTabs = args.tabs ?? (single ? [single.data] : undefined);
    if (!inputTabs || inputTabs.length === 0) {
      return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
    }
    const tabs: Tab[] = [];
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
        tabs.push(
          ...buildTemplateTabs(
            { id: tabId, name: t.name },
            kind,
            () => crypto.randomUUID(),
            t.theme ?? args.theme,
          ),
        );
        continue;
      }
      const drawn = packFreehandPoints(t.elements ?? []);
      if ('error' in drawn) return errorResult(`Tab "${t.name}": ${drawn.error}`);
      const valueIssue = elementsIssue(drawn.elements);
      if (valueIssue) return errorResult(`Tab "${t.name}": ${valueIssue}`);
      const ended = resolveArrowEnds(drawn.elements, idsOf(drawn.elements));
      if ('error' in ended) return errorResult(`Tab "${t.name}": ${ended.error}`);
      const candidate: unknown = {
        id: tabId,
        name: t.name,
        elements: normaliseElements(ended.elements),
      };
      if (!t.elements || !isValidTab(candidate)) {
        return errorResult(
          `Invalid elements in tab "${t.name}". Provide "elements" (or a "template" kind ` +
            'from list_templates). Check the livedesign://schema/elements resource: every ' +
            'element needs id/type/x/y/width/height (arrows need from/to), and arrays must ' +
            'be well-formed.',
        );
      }
      tabs.push(buildTab(tabId, t.name, candidate.elements, args.layout, t.theme ?? args.theme));
    }
    // The finish asked for (docs/specs/008-canvas/finish.md) is every new tab's.
    if (args.finish) for (const t of tabs) t.finish = args.finish;
    const id = crypto.randomUUID();
    // Tag the design as made by AI (docs/specs/013-workspace/folders.md): the Explorer's Made by AI
    // filter and badge read source != null, wherever the design is filed.
    // The creation intent (docs/specs/013-workspace/default-folders.md): with no folder named, the
    // server files the design in the user's default folder for it, when they have one.
    const intent = creationIntentOf(tabs[0]);
    const { design: created } = await apiJson<{ design?: LiveDoc }>(env, token, '/designs', {
      method: 'POST',
      // markUsed only when the model gave one: absent, the making counts (the api's default).
      body: JSON.stringify({
        id,
        name: args.name,
        tabs,
        source: 'mcp',
        intent,
        ...(args.markUsed !== undefined ? { markUsed: args.markUsed } : {}),
      }),
    });
    const tabIds = tabs.map((t) => t.id);
    const reports = await lintReportsOf(env, token, id, tabIds);
    const lint = reports.map(lintLineOf);
    return imageResult(
      {
        id,
        designId: id,
        name: args.name,
        tabCount: tabs.length,
        tabIds,
        folder: await createdFolderLabel(env, token, created),
        url: deepLink(env, id),
        lint,
      },
      tabs[0]!,
      { env, token },
      reports.map(lintTextOf),
    );
  });

  registerTool(server, env, mcpAddTab, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    const tabId = crypto.randomUUID();
    // Template tab (docs/specs/015-api/mcp-server.md §4.5): resolved up front so an unknown kind
    // fails before any network round trip.
    if (args.template && !resolveTemplate(args.template)) {
      return errorResult(
        `Unknown template "${args.template}". ${closestTemplatesHint(args.template)}Valid kinds: ${validTemplateKinds()}.`,
      );
    }
    if (!args.template && !args.elements) {
      return errorResult(
        'Invalid input. Provide "elements", or a "template" kind from list_templates. Check the ' +
          'livedesign://schema/elements resource.',
      );
    }
    const drawn = args.elements ? packFreehandPoints(args.elements) : null;
    if (drawn && 'error' in drawn) return errorResult(drawn.error);
    const given = drawn?.elements;
    const valueIssue = given ? elementsIssue(given) : null;
    if (valueIssue) return errorResult(valueIssue);
    const ended = given ? resolveArrowEnds(given, idsOf(given)) : null;
    if (ended && 'error' in ended) return errorResult(ended.error);
    // Default the new tab's theme to the design's existing one so it matches the other tabs
    // rather than landing as a clashing brand-white tab; the model can still pass a theme.
    let themeId = args.theme;
    if (!themeId) {
      try {
        themeId = (await loadTab(env, token, args.designId))?.tab.theme;
      } catch {
        /* the api keeps its default */
      }
    }
    // One changeset that creates the tab, so anyone with the design open sees it arrive
    // (docs/specs/015-api/mcp-server.md §4.3a).
    let answer;
    try {
      answer = await submitChangeset(env, token, args.designId, tabId, {
        replace: replaceBodyFrom({
          ...(args.template ? { template: args.template } : {}),
          ...(ended ? { elements: ended.elements } : {}),
          ...(args.layout ? { layout: args.layout } : {}),
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
      `/designs/${encodeURIComponent(args.designId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    return imageResult(
      {
        designId: args.designId,
        tabId,
        name: tab.name,
        url: deepLink(env, args.designId),
        changesetId: answer.changeset?.id ?? null,
        rev: tab.rev,
        text: mcpResultText(answer.text),
        lint: lintLineOf(answer.lint),
      },
      tab,
      { env, token },
      [lintTextOf(answer.lint)],
    );
  });

  registerTool(server, env, mcpUpdateDesign, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    const loaded = await loadTab(env, token, args.designId, args.tabId);
    if (!loaded) return errorResult('That design has no tabs.');
    const { tab } = loaded;
    const tabId = tab.id;
    // Both modes are one changeset (docs/specs/015-api/mcp-server.md §4.4): applied, laid out and
    // relayed by the api, kept through anyone's next save. ops mode is based on what the model
    // read, so nothing a person saved in between is overwritten.
    let body: ChangesetRequest;
    if (args.mode === 'replace') {
      if (!args.elements) {
        return errorResult('replace mode requires "elements".');
      } else {
        const drawn = args.elements ? packFreehandPoints(args.elements) : null;
        if (drawn && 'error' in drawn) return errorResult(drawn.error);
        const given = drawn?.elements;
        const valueIssue = given ? elementsIssue(given) : null;
        if (valueIssue) return errorResult(valueIssue);
        // The new elements are the whole tab, so an arrow end may name only them.
        const ended = given ? resolveArrowEnds(given, idsOf(given)) : null;
        if (ended && 'error' in ended) return errorResult(ended.error);
        body = {
          replace: replaceBodyFrom({
            ...(ended ? { elements: ended.elements } : {}),
            ...(args.layout ? { layout: args.layout } : {}),
          }),
        };
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
      answer = await submitChangeset(env, token, args.designId, tabId, body);
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    const { tab: next } = await apiJson<TabResponse>(
      env,
      token,
      `/designs/${encodeURIComponent(args.designId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    // An edit that changed nothing records no changeset and so carries no lint: the tab's own lint is read instead, so
    // the answer still says what is wrong with it rather than "lint unavailable".
    const lint =
      answer.lint ??
      (answer.changeset ? null : (await lintReportsOf(env, token, args.designId, [tabId]))[0]!);
    return imageResult(
      {
        id: args.designId,
        designId: args.designId,
        tabId,
        url: deepLink(env, args.designId),
        changesetId: answer.changeset?.id ?? null,
        rev: next.rev,
        text: mcpResultText(answer.text, contentOrigin(tab.elements)),
        lint: lintLineOf(lint),
      },
      next,
      { env, token },
      [lintTextOf(lint)],
    );
  });

  registerTool(server, env, mcpShareDesign, async (args, extra) => {
    const token = requireToken(extra);
    // Default to Participant (docs/specs/013-workspace/share-roles.md): people take part without reshaping the
    // design, and an automated share never silently grants edit. The api's own default is edit, so the role is
    // always sent.
    const role = args.role ?? DEFAULT_MCP_SHARE_LEVEL;
    const { link } = await apiJson<ShareLinkResponse>(
      env,
      token,
      `/designs/${encodeURIComponent(args.designId)}/share`,
      { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
    );
    return textResult({
      url: shareUrl(env, link.code),
      role: link.role,
      expiresAt: link.expiresAt,
      designUrl: deepLink(env, args.designId),
    });
  });

  registerTool(server, env, mcpRenameDesign, async (args, extra) => {
    const token = requireToken(extra);
    if (args.tabId) {
      // The tab name route: the name only, relayed to anyone with the design open
      // (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames").
      const { tab } = await apiJson<{ tab: { name: string } }>(
        env,
        token,
        `/designs/${encodeURIComponent(args.designId)}/tabs/${encodeURIComponent(args.tabId)}/name`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({ renamed: 'tab', tabId: args.tabId, name: tab.name });
    }
    const { design: liveDoc } = await apiJson<DesignResponse>(
      env,
      token,
      `/designs/${encodeURIComponent(args.designId)}`,
      { method: 'PUT', body: JSON.stringify({ name: args.name }) },
    );
    return textResult({
      renamed: 'design',
      id: liveDoc.id,
      name: liveDoc.name,
      url: deepLink(env, liveDoc.id),
    });
  });

  registerTool(server, env, mcpDeleteDesign, async (args, extra) => {
    const token = requireToken(extra);
    // A whole design only ever goes to the Trash (docs/specs/013-workspace/trash.md):
    // a permanent delete is the REST API's, never an AI tool's. A tab has no Trash.
    const path = args.tabId
      ? `/designs/${encodeURIComponent(args.designId)}/tabs/${encodeURIComponent(args.tabId)}`
      : `/designs/${encodeURIComponent(args.designId)}`;
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
        ? { deleted: 'tab', designId: args.designId, tabId: args.tabId }
        : {
            deleted: 'design',
            designId: args.designId,
            trashed: true,
            restorableForDays: TRASH_RETENTION_DAYS,
          },
    );
  });

  // The Trash (docs/specs/013-workspace/trash.md, docs/specs/015-api/mcp-server.md §4.9):
  // what delete_design put there, and the way back. Same authorisation as
  // GET /api/trash and POST /api/trash/<id>/restore: the user's personal Trash
  // and every team Trash they have joined.
  registerTool(server, env, mcpListTrash, async (_args, extra) => {
    const token = requireToken(extra);
    const { trash } = await apiJson<{ trash?: TrashedDesign[] }>(env, token, '/trash');
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

  registerTool(server, env, mcpRestoreDesign, async (args, extra) => {
    const token = requireToken(extra);
    try {
      const { design: liveDoc } = await apiJson<{
        design?: { id: string; name: string } | null;
      }>(env, token, `/trash/${encodeURIComponent(args.designId)}/restore`, { method: 'POST' });
      return textResult({
        restored: 'design',
        id: liveDoc?.id ?? args.designId,
        name: liveDoc?.name ?? null,
        url: deepLink(env, liveDoc?.id ?? args.designId),
      });
    } catch (err) {
      // Not in the Trash, or not the user's to restore: model-correctable.
      if (err instanceof ApiError && err.status === 404) {
        return errorResult(
          'That design is not in the Trash, or is not yours to restore. Check the id with list_trash.',
        );
      }
      throw err;
    }
  });
}

// Why a delete was refused, by what was deleted and the status.
export function deleteRefusal(status: number, tab: boolean): string {
  if (status === 410) return 'It is already in the Trash (see list_trash).';
  if (status === 403) return 'You may view this design but not change it.';
  if (status === 404)
    return tab
      ? 'No such tab in this design: read_design lists its tabs.'
      : 'No such design, or it is not yours: find_designs lists them.';
  if (tab && status === 409)
    return 'A design must keep at least one tab: you cannot delete the last one.';
  return tab
    ? `The api refused it (${status}): check the design and tab ids.`
    : 'Check the design id and that you own it.';
}
