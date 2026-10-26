// The MCP tools (docs/specs/015-api/mcp-server.md §4). Each is a thin wrapper over the api worker
// plus the shared document helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ChangesetRequest,
  DocumentListResponse,
  DocumentResponse,
  ShareLinkResponse,
  TabResponse,
} from '@livediagram/api-schema';
import {
  buildGraphTab,
  buildTab,
  contentOrigin,
  isValidTab,
  normaliseElements,
  resolveGraphInput,
  type Tab,
} from '@livediagram/document';
import {
  buildTemplateTab,
  resolveTemplate,
  templateCatalogue,
  templateFamilyOf,
  templateTabName,
  validTemplateKinds,
  closestTemplatesHint,
  type TemplateKind,
} from '@livediagram/templates';
import {
  DEFAULT_MCP_SHARE_LEVEL,
  TRASH_RETENTION_DAYS,
  creationIntentOf,
  type LiveDoc,
  type TrashedDocument,
} from '@livediagram/api-schema';
import { createdFolderLabel } from './created-folder';
import { ApiError, apiFetch, apiJson, clientFor, reportApiFailure } from './api';
import { readDocument } from './read-document';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { fetchTeamLibraries, matchDocuments } from '@livediagram/agent-verbs';
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
import { withoutFindings } from '@livediagram/diagram-lint';
import { idsOf, resolveArrowEnds } from './arrow-ends';
import { elementsIssue, graphIconIssue, tabElementsIssue } from './element-values';
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
import {
  createDocumentTab,
  mcpAddTab,
  mcpCreateDocument,
  mcpDeleteDocument,
  mcpFindDocuments,
  mcpListTemplates,
  mcpListTrash,
  mcpReadDocument,
  mcpRenameDocument,
  mcpRestoreDocument,
  mcpSearchIcons,
  mcpShareDocument,
  mcpUpdateDocument,
} from '@livediagram/agent-verbs/mcp';

export function registerTools(server: McpServer, env: Env): void {
  // The user's image gallery, for image elements (docs/specs/015-api/mcp-server.md §4.5b).
  registerImageTools(server, env);
  registerTool(server, env, mcpFindDocuments, async (args, extra) => {
    const token = requireToken(extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-documents.md): a document filed into a
    // team leaves the personal list, so both must be swept.
    const [{ documents: liveDocs }, teamLibraries] = await Promise.all([
      apiJson<DocumentListResponse>(env, token, '/documents'),
      fetchTeamLibraries(clientFor(env, token)),
    ]);
    const matched = matchDocuments(liveDocs, teamLibraries, args.query, args.limit ?? 20).map(
      (d) => ({ ...d, url: deepLink(env, d.id) }),
    );
    return textResult({ count: matched.length, documents: matched });
  });

  registerTool(server, env, mcpReadDocument, async (args, extra) =>
    readDocument(env, requireToken(extra as Extra), args),
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

  registerTool(server, env, mcpCreateDocument, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    // Accept either `tabs` (preferred) or a single `tab` alias, checked here against the tab shape.
    const single =
      args.tabs || args.tab === undefined ? null : createDocumentTab.safeParse(args.tab);
    if (single && !single.success)
      return errorResult(
        `"tab": ${single.error.issues.map((i) => `${i.path.join('.') || 'tab'}: ${i.message}`).join('; ')}. ` +
          'Pass "tabs": [{ name, graph | mermaid | elements | template }].',
      );
    const inputTabs = args.tabs ?? (single ? [single.data] : undefined);
    if (!inputTabs || inputTabs.length === 0) {
      return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
    }
    const tabs: Tab[] = [];
    // What a graph tab could not keep of what it asked (a Mermaid subgraph nested in another), said back.
    const graphNotes: string[] = [];
    // The template the first tab is made from, for the creation intent.
    let firstTemplate: TemplateKind | null = null;
    // The tabs a template made, whose colours are its own.
    const templateTabIds = new Set<string>();
    for (const [index, given] of inputTabs.entries()) {
      const tabId = crypto.randomUUID();
      // An unnamed tab is named after its template, as the editor names one (templateTabName), else "Tab n".
      const templateKind = given.template ? resolveTemplate(given.template) : null;
      const t = {
        ...given,
        name: given.name ?? (templateKind && templateTabName(templateKind)) ?? `Tab ${index + 1}`,
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
        tabs.push(buildTemplateTab(tabId, t.name, kind, t.theme ?? args.theme));
        templateTabIds.add(tabId);
        continue;
      }
      // Graph-first (docs/specs/015-api/mcp-server.md §4.7): the server builds + lays out the boxes
      // and arrows from a node/edge graph, or the same graph as Mermaid.
      const input = resolveGraphInput(t);
      if (input.error) return errorResult(`Tab "${t.name}": ${input.error}`);
      for (const note of input.notes ?? []) graphNotes.push(`Tab "${t.name}": ${note}`);
      const iconIssue = input.graph ? graphIconIssue(input.graph.nodes) : null;
      if (iconIssue) return errorResult(`Tab "${t.name}": ${iconIssue}`);
      if (input.graph) {
        tabs.push(buildGraphTab(tabId, t.name, input.graph, t.theme ?? args.theme));
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
            'from list_templates). Check the livediagram://schema/elements resource: every ' +
            'element needs id/type/x/y/width/height (arrows need from/to), and arrays must ' +
            'be well-formed.',
        );
      }
      tabs.push(buildTab(tabId, t.name, candidate.elements, args.layout, t.theme ?? args.theme));
    }
    // The finish asked for (docs/specs/008-canvas/finish.md) is every new tab's.
    if (args.finish) for (const t of tabs) t.finish = args.finish;
    const id = crypto.randomUUID();
    // Tag the document as made by AI (docs/specs/013-workspace/folders.md): the Explorer's Made by AI
    // filter and badge read source != null, wherever the document is filed.
    // The creation intent (docs/specs/013-workspace/default-folders.md): with no folder named, the
    // server files the document in the user's default folder for it, when they have one.
    const intent = creationIntentOf(tabs[0], templateFamilyOf(firstTemplate));
    const { document: created } = await apiJson<{ document?: LiveDoc }>(env, token, '/documents', {
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
    // A template's colours are its design, not the agent's doing (diagram-lint.md "Where it runs"): its tabs' lint
    // names none.
    const reports = (await lintReportsOf(env, token, id, tabIds)).map((r, i) =>
      r && templateTabIds.has(tabIds[i]!) ? withoutFindings(r, 'colour-on-themed') : r,
    );
    const lint = reports.map(lintLineOf);
    return imageResult(
      {
        id,
        documentId: id,
        name: args.name,
        tabCount: tabs.length,
        tabIds,
        folder: await createdFolderLabel(env, token, created),
        url: deepLink(env, id),
        lint,
        ...(graphNotes.length ? { notes: graphNotes } : {}),
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
    const input = resolveGraphInput(args);
    if (input.error) return errorResult(input.error);
    if (!args.template && !input.graph && !args.elements) {
      return errorResult(
        'Invalid input. Provide a "graph" (nodes + edges), "mermaid", "elements", or a "template" kind ' +
          'from list_templates. Check the livediagram://schema/elements resource.',
      );
    }
    const drawn = args.elements ? packFreehandPoints(args.elements) : null;
    if (drawn && 'error' in drawn) return errorResult(drawn.error);
    const given = drawn?.elements;
    const valueIssue = given ? elementsIssue(given) : null;
    if (valueIssue) return errorResult(valueIssue);
    const ended = given ? resolveArrowEnds(given, idsOf(given)) : null;
    if (ended && 'error' in ended) return errorResult(ended.error);
    // Default the new tab's theme to the document's existing one so it matches the other tabs
    // rather than landing as a clashing brand-white tab; the model can still pass a theme.
    let themeId = args.theme;
    if (!themeId) {
      try {
        themeId = (await loadTab(env, token, args.documentId))?.tab.theme;
      } catch {
        /* the api keeps its default */
      }
    }
    // One changeset that creates the tab, so anyone with the document open sees it arrive
    // (docs/specs/015-api/mcp-server.md §4.3a).
    let answer;
    try {
      answer = await submitChangeset(env, token, args.documentId, tabId, {
        replace: replaceBodyFrom({
          ...(input.graph ? { graph: input.graph } : {}),
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
      `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    return imageResult(
      {
        documentId: args.documentId,
        tabId,
        name: tab.name,
        url: deepLink(env, args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: tab.rev,
        text: mcpResultText(answer.text),
        lint: lintLineOf(answer.lint),
        ...(input.notes ? { notes: input.notes } : {}),
      },
      tab,
      { env, token },
      [lintTextOf(answer.lint)],
    );
  });

  registerTool(server, env, mcpUpdateDocument, async (args, extra) => {
    const token = requireToken(extra);
    // An imageId names a picture in the caller's gallery (docs/specs/009-elements/images.md "Agents").
    const imageIssue = await imageIdIssue(env, token, args);
    if (imageIssue) return errorResult(imageIssue);
    const loaded = await loadTab(env, token, args.documentId, args.tabId);
    if (!loaded) return errorResult('That document has no tabs.');
    const { tab } = loaded;
    const tabId = tab.id;
    // Both modes are one changeset (docs/specs/015-api/mcp-server.md §4.4): applied, laid out and
    // relayed by the api, kept through anyone's next save. ops mode is based on what the model
    // read, so nothing a person saved in between is overwritten.
    let body: ChangesetRequest;
    let graphNotes: string[] | undefined;
    if (args.mode === 'replace') {
      const input = resolveGraphInput(args);
      if (input.error) return errorResult(input.error);
      graphNotes = input.notes;
      if (!input.graph && !args.elements) {
        return errorResult('replace mode requires "graph", "mermaid" or "elements".');
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
            ...(input.graph ? { graph: input.graph } : {}),
            ...(!input.graph && ended ? { elements: ended.elements } : {}),
            ...(!input.graph && args.layout ? { layout: args.layout } : {}),
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
      answer = await submitChangeset(env, token, args.documentId, tabId, body);
    } catch (err) {
      if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
      throw err;
    }
    const { tab: next } = await apiJson<TabResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(tabId)}`,
    );
    // An edit that changed nothing records no changeset and so carries no lint: the tab's own lint is read instead, so
    // the answer still says what is wrong with it rather than "lint unavailable".
    const lint =
      answer.lint ??
      (answer.changeset ? null : (await lintReportsOf(env, token, args.documentId, [tabId]))[0]!);
    return imageResult(
      {
        id: args.documentId,
        documentId: args.documentId,
        tabId,
        url: deepLink(env, args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: next.rev,
        text: mcpResultText(answer.text, contentOrigin(tab.elements)),
        lint: lintLineOf(lint),
        ...(graphNotes ? { notes: graphNotes } : {}),
      },
      next,
      { env, token },
      [lintTextOf(lint)],
    );
  });

  registerTool(server, env, mcpShareDocument, async (args, extra) => {
    const token = requireToken(extra);
    // Default to Participant (docs/specs/013-workspace/share-roles.md): people take part without reshaping the
    // board, and an automated share never silently grants edit. The api's own default is edit, so the role is
    // always sent.
    const role = args.role ?? DEFAULT_MCP_SHARE_LEVEL;
    const { link } = await apiJson<ShareLinkResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}/share`,
      { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
    );
    return textResult({
      url: shareUrl(env, link.code),
      role: link.role,
      expiresAt: link.expiresAt,
      documentUrl: deepLink(env, args.documentId),
    });
  });

  registerTool(server, env, mcpRenameDocument, async (args, extra) => {
    const token = requireToken(extra);
    if (args.tabId) {
      // The tab name route: the name only, relayed to anyone with the document open
      // (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames").
      const { tab } = await apiJson<{ tab: { name: string } }>(
        env,
        token,
        `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(args.tabId)}/name`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({ renamed: 'tab', tabId: args.tabId, name: tab.name });
    }
    const { document: liveDoc } = await apiJson<DocumentResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}`,
      { method: 'PUT', body: JSON.stringify({ name: args.name }) },
    );
    return textResult({
      renamed: 'document',
      id: liveDoc.id,
      name: liveDoc.name,
      url: deepLink(env, liveDoc.id),
    });
  });

  registerTool(server, env, mcpDeleteDocument, async (args, extra) => {
    const token = requireToken(extra);
    // A whole document only ever goes to the Trash (docs/specs/013-workspace/trash.md):
    // a permanent delete is the REST API's, never an AI tool's. A tab has no Trash.
    const path = args.tabId
      ? `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(args.tabId)}`
      : `/documents/${encodeURIComponent(args.documentId)}`;
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
        ? { deleted: 'tab', documentId: args.documentId, tabId: args.tabId }
        : {
            deleted: 'document',
            documentId: args.documentId,
            trashed: true,
            restorableForDays: TRASH_RETENTION_DAYS,
          },
    );
  });

  // The Trash (docs/specs/013-workspace/trash.md, docs/specs/015-api/mcp-server.md §4.9):
  // what delete_document put there, and the way back. Same authorisation as
  // GET /api/trash and POST /api/trash/<id>/restore: the user's personal Trash
  // and every team Trash they have joined.
  registerTool(server, env, mcpListTrash, async (_args, extra) => {
    const token = requireToken(extra);
    const { trash } = await apiJson<{ trash?: TrashedDocument[] }>(env, token, '/trash');
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

  registerTool(server, env, mcpRestoreDocument, async (args, extra) => {
    const token = requireToken(extra);
    try {
      const { document: liveDoc } = await apiJson<{
        document?: { id: string; name: string } | null;
      }>(env, token, `/trash/${encodeURIComponent(args.documentId)}/restore`, { method: 'POST' });
      return textResult({
        restored: 'document',
        id: liveDoc?.id ?? args.documentId,
        name: liveDoc?.name ?? null,
        url: deepLink(env, liveDoc?.id ?? args.documentId),
      });
    } catch (err) {
      // Not in the Trash, or not the user's to restore: model-correctable.
      if (err instanceof ApiError && err.status === 404) {
        return errorResult(
          'That document is not in the Trash, or is not yours to restore. Check the id with list_trash.',
        );
      }
      throw err;
    }
  });
}

// Why a delete was refused, by what was deleted and the status.
export function deleteRefusal(status: number, tab: boolean): string {
  if (status === 410) return 'It is already in the Trash (see list_trash).';
  if (status === 403) return 'You may view this document but not change it.';
  if (status === 404)
    return tab
      ? 'No such tab in this document: read_document lists its tabs.'
      : 'No such document, or it is not yours: find_documents lists them.';
  if (tab && status === 409)
    return 'A document must keep at least one tab: you cannot delete the last one.';
  return tab
    ? `The api refused it (${status}): check the document and tab ids.`
    : 'Check the document id and that you own it.';
}
