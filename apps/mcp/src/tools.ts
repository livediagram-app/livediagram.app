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
  isValidTab,
  normaliseElements,
  resolveGraphInput,
  type Tab,
} from '@livediagram/document';
import {
  buildTemplateTabs,
  resolveTemplate,
  templateCatalogue,
  templateFamilyOf,
  templateTabs,
  validTemplateKinds,
  type TemplateKind,
} from '@livediagram/templates';
import {
  TRASH_RETENTION_DAYS,
  creationIntentOf,
  type LiveDoc,
  type TrashedDocument,
} from '@livediagram/api-schema';
import { createdFolderLabel } from './created-folder';
import { ApiError, apiFetch, apiJson, clientFor, reportApiFailure } from './api';
import { readDocument } from './read-document';
import type { Env } from './env';
import { bringBoardCardTypes, fetchTeamLibraries, matchDocuments } from '@livediagram/agent-verbs';
import { catalogueWithBoardTypes } from '@livediagram/items';
import {
  deepLink,
  errorResult,
  loadTab,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';
import { lintLineOf, lintLinesOf } from './lint-summary';
import { imageResult } from './image-result';
import {
  baseFor,
  changesetErrorText,
  isChangesetRefusal,
  mcpOpsToEditOperations,
  replaceBodyFrom,
  submitChangeset,
} from './changeset-client';
import { registerTool } from './tool-annotations';
import { registerPlanTools } from './plan-tools';
import { registerSheetTools } from './sheet-tools';
import {
  mcpAddTab,
  mcpCreateDocument,
  mcpDeleteDocument,
  mcpFindDocuments,
  mcpListTemplates,
  mcpListTrash,
  mcpReadDocument,
  mcpRenameDocument,
  mcpRestoreDocument,
  mcpShareDocument,
  mcpUpdateDocument,
} from '@livediagram/agent-verbs/mcp';

export function registerTools(server: McpServer, env: Env): void {
  // The items Plan boards show (docs/specs/026-plan/plan-mode.md "Agents").
  registerPlanTools(server, env);
  // Sheets, by title and A1 (docs/specs/029-sheets/sheet-store.md "Agents").
  registerSheetTools(server, env);
  registerTool(server, env, mcpFindDocuments, async (args, extra) => {
    const token = requireToken(extra as Extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-documents.md): a document filed into a
    // team leaves the personal list, so both must be swept.
    const [{ documents: liveDocs }, teamLibraries] = await Promise.all([
      apiJson<DocumentListResponse>(env, token, '/documents'),
      fetchTeamLibraries(clientFor(env, token)),
    ]);
    const matched = matchDocuments(liveDocs, teamLibraries, args.query, args.limit ?? 20).map(
      (d) => ({ ...d, url: deepLink(d.id) }),
    );
    return textResult({ count: matched.length, documents: matched });
  });

  registerTool(server, env, mcpReadDocument, async (args, extra) =>
    readDocument(env, requireToken(extra as Extra), args),
  );

  registerTool(server, env, mcpListTemplates, async (_args, extra) => {
    requireToken(extra as Extra);
    return textResult(templateCatalogue());
  });

  registerTool(server, env, mcpCreateDocument, async (args, extra) => {
    const token = requireToken(extra as Extra);
    // Accept either `tabs` (preferred) or a single `tab` alias.
    const inputTabs = args.tabs ?? (args.tab ? [args.tab] : undefined);
    if (!inputTabs || inputTabs.length === 0) {
      return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
    }
    const tabs: Tab[] = [];
    // The template the first tab is made from, for the creation intent.
    let firstTemplate: TemplateKind | null = null;
    // Every template tab's elements: their Plan boards bring their card types
    // (docs/specs/026-plan/plan-templates.md "Card types a template uses").
    const templateElements: Tab['elements'] = [];
    for (const t of inputTabs) {
      const tabId = crypto.randomUUID();
      // Template tab (docs/specs/015-api/mcp-server.md §4.5): materialise the curated scaffold
      // instead of expecting elements.
      if (t.template) {
        const kind = resolveTemplate(t.template);
        if (!kind) {
          return errorResult(
            `Unknown template "${t.template}" in tab "${t.name}". Valid kinds: ` +
              `${validTemplateKinds()}.`,
          );
        }
        if (tabs.length === 0) firstTemplate = kind;
        // A template of several tabs adds them all, the first named as given
        // (docs/specs/026-plan/plan-templates.md "How a template with tabs is made").
        const made = buildTemplateTabs(
          { id: tabId, name: t.name },
          kind,
          () => crypto.randomUUID(),
          args.theme,
        );
        tabs.push(...made);
        for (const m of made) templateElements.push(...m.elements);
        continue;
      }
      // Graph-first (docs/specs/015-api/mcp-server.md §4.7): the server builds + lays out the boxes
      // and arrows from a node/edge graph, or the same graph as Mermaid.
      const input = resolveGraphInput(t);
      if (input.error) return errorResult(`Tab "${t.name}": ${input.error}`);
      if (input.graph) {
        tabs.push(buildGraphTab(tabId, t.name, input.graph, args.theme));
        continue;
      }
      const candidate: unknown = {
        id: tabId,
        name: t.name,
        elements: normaliseElements(t.elements ?? []),
      };
      if (!t.elements || !isValidTab(candidate)) {
        return errorResult(
          `Invalid elements in tab "${t.name}". Provide "elements" (or a "template" kind ` +
            'from list_templates). Check the livediagram://schema/elements resource: every ' +
            'element needs id/type/x/y/width/height (arrows need from/to), and arrays must ' +
            'be well-formed.',
        );
      }
      tabs.push(buildTab(tabId, t.name, (candidate as Tab).elements, args.layout, args.theme));
    }
    const id = crypto.randomUUID();
    // Tag the document as made by AI (docs/specs/013-workspace/folders.md): the Explorer's Made by AI
    // filter and badge read source != null, wherever the document is filed.
    // The creation intent (docs/specs/013-workspace/default-folders.md): with no folder named, the
    // server files the document in the user's default folder for it, when they have one.
    const intent = creationIntentOf(tabs[0], templateFamilyOf(firstTemplate));
    const itemTypes = catalogueWithBoardTypes(null, templateElements);
    const { document: created } = await apiJson<{ document?: LiveDoc }>(env, token, '/documents', {
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
    const lint = await lintLinesOf(env, token, id, tabIds);
    return imageResult(
      {
        id,
        documentId: id,
        name: args.name,
        tabCount: tabs.length,
        tabIds,
        folder: await createdFolderLabel(env, token, created),
        url: deepLink(id),
        lint,
      },
      tabs[0]!,
      { env, token },
      lint,
    );
  });

  registerTool(server, env, mcpAddTab, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const tabId = crypto.randomUUID();
    // Template tab (docs/specs/015-api/mcp-server.md §4.5): resolved up front so an unknown kind
    // fails before any network round trip.
    if (args.template && !resolveTemplate(args.template)) {
      return errorResult(
        `Unknown template "${args.template}". Valid kinds: ${validTemplateKinds()}.`,
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
          ...(args.elements ? { elements: args.elements } : {}),
          ...(args.layout ? { layout: args.layout } : {}),
          ...(themeId ? { theme: themeId } : {}),
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
    // A Plan template's boards bring their card types (docs/specs/026-plan/plan-agents.md "Adding a board").
    if (args.template)
      await bringBoardCardTypes(clientFor(env, token), args.documentId, tab.elements);
    return imageResult(
      {
        documentId: args.documentId,
        tabId,
        name: tab.name,
        url: deepLink(args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: tab.rev,
        text: answer.text,
        lint: lintLineOf(answer.lint),
        ...templateNote(args.template),
      },
      tab,
      { env, token },
      [lintLineOf(answer.lint)],
    );
  });

  registerTool(server, env, mcpUpdateDocument, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const loaded = await loadTab(env, token, args.documentId, args.tabId);
    if (!loaded) return errorResult('That document has no tabs.');
    const { tab } = loaded;
    const tabId = tab.id;
    // Both modes are one changeset (docs/specs/015-api/mcp-server.md §4.4): applied, laid out and
    // relayed by the api, kept through anyone's next save. ops mode is based on what the model
    // read, so nothing a person saved in between is overwritten.
    let body: ChangesetRequest;
    if (args.mode === 'replace') {
      const input = resolveGraphInput(args);
      if (input.error) return errorResult(input.error);
      if (!input.graph && !args.elements) {
        return errorResult('replace mode requires "graph", "mermaid" or "elements".');
      }
      body = {
        replace: replaceBodyFrom({
          ...(input.graph ? { graph: input.graph } : {}),
          ...(!input.graph && args.elements ? { elements: args.elements } : {}),
          ...(!input.graph && args.layout ? { layout: args.layout } : {}),
        }),
      };
    } else {
      if (!args.ops) return errorResult('ops mode requires "ops".');
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
    return imageResult(
      {
        id: args.documentId,
        documentId: args.documentId,
        tabId,
        url: deepLink(args.documentId),
        changesetId: answer.changeset?.id ?? null,
        rev: next.rev,
        text: answer.text,
        lint: lintLineOf(answer.lint),
      },
      next,
      { env, token },
      [lintLineOf(answer.lint)],
    );
  });

  registerTool(server, env, mcpShareDocument, async (args, extra) => {
    const token = requireToken(extra as Extra);
    // Default to view (least privilege for an automated share): showing your
    // work shouldn't silently grant edit. The api's own default is edit, so
    // we send the role explicitly.
    const role = args.role === 'edit' ? 'edit' : 'view';
    const { link } = await apiJson<ShareLinkResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}/share`,
      { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
    );
    return textResult({
      url: shareUrl(link.code),
      role: link.role,
      expiresAt: link.expiresAt,
      documentUrl: deepLink(args.documentId),
    });
  });

  registerTool(server, env, mcpRenameDocument, async (args, extra) => {
    const token = requireToken(extra as Extra);
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
      url: deepLink(liveDoc.id),
    });
  });

  registerTool(server, env, mcpDeleteDocument, async (args, extra) => {
    const token = requireToken(extra as Extra);
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
    const token = requireToken(extra as Extra);
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
    const token = requireToken(extra as Extra);
    try {
      const { document: liveDoc } = await apiJson<{
        document?: { id: string; name: string } | null;
      }>(env, token, `/trash/${encodeURIComponent(args.documentId)}/restore`, { method: 'POST' });
      return textResult({
        restored: 'document',
        id: liveDoc?.id ?? args.documentId,
        name: liveDoc?.name ?? null,
        url: deepLink(liveDoc?.id ?? args.documentId),
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
  return tab
    ? 'A document must keep at least one tab: you cannot delete the last one.'
    : 'Check the document id and that you own it.';
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
      'create_document with this template makes all of them.',
  };
}
