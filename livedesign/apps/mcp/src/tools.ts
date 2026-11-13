// The MCP tools (docs/specs/015-api/mcp-server.md §4). Each is a thin wrapper over the api worker
// plus the shared design helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DesignResponse, ShareLinkResponse } from '@livedesign/api-schema';
import { buildTab, isValidTab, normaliseElements, type Tab } from '@livedesign/design';
import {
  templateTabName,
  resolveTemplate,
  buildTemplateTabs,
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
import { deleteRefusal, searchDesigns } from '@livedesign/agent-verbs';
import {
  deepLink,
  errorResult,
  requireToken,
  shareUrl,
  textResult,
  ToolInputError,
  type Extra,
} from './tool-helpers';
import { lintLineOf, lintReportsOf, lintTextOf } from './lint-summary';
import { idsOf, resolveArrowEnds } from './arrow-ends';
import { elementsIssue, tabElementsIssue } from './element-values';
import { packFreehandPoints } from './freehand-points';
import { searchIcons } from '@liveworkspace/icons/search';
import { imageResult } from './image-result';
import { imageIdIssue, registerImageTools } from './image-tools';
import { registerTool } from './tool-annotations';
import { registerArchiveTools } from './archive-tools';
import { registerPagesTools } from './pages-tools';
import { registerComponentsTools } from './components-tools';
import {
  createDesignTab,
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
} from '@livedesign/agent-verbs/mcp';
import { registerTabTools } from './tab-tools';
import { changesetErrorText, isChangesetRefusal } from './changeset-client';
import { addOperationsFor, addToTemplateTab, getTab } from './template-elements';

export function registerTools(server: McpServer, env: Env): void {
  registerPagesTools(server, env);
  // The design's component library (docs/specs/015-api/mcp-server.md §4.9e).
  registerComponentsTools(server, env);
  // The user's image gallery, for image elements (docs/specs/015-api/mcp-server.md §4.5b).
  registerImageTools(server, env);
  registerTool(server, env, mcpFindDesigns, async (args, extra) => {
    const token = requireToken(extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-designs.md): a design filed into a
    // team leaves the personal list, so both are searched, at the index in one
    // request (@liveworkspace/agent-verbs/find `searchFiles`).
    const found = await searchDesigns(clientFor(env, token), args.query, args.limit ?? 20, {
      archived: args.archived,
    });
    const matched = found.map((d) => ({ ...d, url: deepLink(env, d.id) }));
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
    // Elements given beside a template, added to its first tab once the design exists.
    const withTemplate: { tab: Tab; operations: unknown[] }[] = [];
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
        const built = buildTemplateTabs(
          { id: tabId, name: t.name },
          kind,
          () => crypto.randomUUID(),
          t.theme ?? args.theme,
        );
        if (t.elements?.length && built[0]) {
          const added = addOperationsFor(t.elements, built[0]);
          if ('error' in added) return errorResult(`Tab "${t.name}": ${added.error}`);
          withTemplate.push({ tab: built[0], operations: added.operations });
        }
        tabs.push(...built);
        continue;
      }
      const drawn = packFreehandPoints(t.elements ?? []);
      if ('error' in drawn) return errorResult(`Tab "${t.name}": ${drawn.error}`);
      const valueIssue = elementsIssue(drawn.elements);
      if (valueIssue) return errorResult(`Tab "${t.name}": ${valueIssue}`);
      const ended = resolveArrowEnds(drawn.elements, idsOf(drawn.elements));
      if ('error' in ended) return errorResult(`Tab "${t.name}": ${ended.error}`);
      const finished = normaliseElements(ended.elements);
      const candidate: unknown = { id: tabId, name: t.name, elements: finished };
      // What is wrong, named, before the general shape of an element.
      const shapeIssue = t.elements ? tabElementsIssue(finished) : null;
      if (shapeIssue) return errorResult(`Tab "${t.name}": ${shapeIssue}`);
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
    // The elements given beside a template go onto its first tab as update_design's add ops would
    // (docs/specs/015-api/mcp-server.md §4.3), so a page template holds them rather than dropping them.
    let shown: Tab = tabs[0]!;
    for (const { tab, operations } of withTemplate) {
      const stored = await getTab(env, token, id, tab.id);
      try {
        await addToTemplateTab(env, token, id, tab.id, stored, operations);
      } catch (err) {
        if (isChangesetRefusal(err))
          return errorResult(
            `The design was made (${id}), but its elements for tab "${tab.name}" were refused: ${changesetErrorText(err)}`,
          );
        throw err;
      }
      if (tab.id === shown.id) shown = await getTab(env, token, id, tab.id);
    }
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
      shown,
      { env, token },
      reports.map(lintTextOf),
    );
  });

  registerTabTools(server, env);

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
      let renamed: { tab: { name: string } };
      try {
        renamed = await apiJson<{ tab: { name: string } }>(
          env,
          token,
          `/designs/${encodeURIComponent(args.designId)}/tabs/${encodeURIComponent(args.tabId)}/name`,
          { method: 'PUT', body: JSON.stringify({ name: args.name }) },
        );
      } catch (err) {
        // The route answers a bare 404 for a tab the design does not hold, which read as "no such design".
        if (err instanceof ApiError && err.status === 404)
          await refuseUnknownTab(env, token, args.designId, args.tabId);
        throw err;
      }
      return textResult({ renamed: 'tab', tabId: args.tabId, name: renamed.tab.name });
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

  // Archived (docs/specs/015-api/mcp-server.md "Archived"): archive_design and unarchive_design.
  registerArchiveTools(server, env);

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
// Throws the ToolInputError naming the design's tabs when it holds no tab `tabId`; returns when the design cannot be
// read (then the design is what is missing) or does hold it.
async function refuseUnknownTab(
  env: Env,
  token: string,
  designId: string,
  tabId: string,
): Promise<void> {
  let tabs: { id: string; name: string }[];
  try {
    ({
      design: { tabs },
    } = await apiJson<DesignResponse>(env, token, `/designs/${encodeURIComponent(designId)}`));
  } catch {
    return;
  }
  if (tabs.some((t) => t.id === tabId)) return;
  throw new ToolInputError(
    `No tab "${tabId}" in this design. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
  );
}
