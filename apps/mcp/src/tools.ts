// The MCP tools (docs/specs/015-api/mcp-server.md §4). Each is a thin wrapper over the api worker
// plus the shared document helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import { layoutGraph, resolveGraphInput } from './graph-input';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  DocumentListResponse,
  DocumentResponse,
  ShareLinkResponse,
  TabResponse,
} from '@livediagram/api-schema';
import { coerceShapeKind, isValidTab, type Element, type Tab } from '@livediagram/document';
import {
  lanesToFront,
  mergeElementUpdate,
  normaliseElement,
  normaliseElements,
} from './element-normalise';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateFamilyOf,
  templateCategory,
  type TemplateKind,
} from '@livediagram/templates';
import {
  TRASH_RETENTION_DAYS,
  creationIntentOf,
  type LiveDoc,
  type TrashedDocument,
} from '@livediagram/api-schema';
import { createdFolderLabel } from './created-folder';
import { ApiError, apiFetch, apiJson, reportApiFailure } from './api';
import type { Env } from './env';
import { fetchTeamLibraries, matchDocuments } from './find-documents';
import {
  deepLink,
  errorResult,
  loadTab,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';
import { imageResult } from './image-result';
import {
  applyLayout,
  buildTab,
  buildGraphTab,
  buildTemplateTab,
  landMcpArrivals,
  resolveTemplate,
  validTemplateKinds,
} from './tab-builders';
import { registerTool } from './tool-annotations';
import {
  addTabOutput,
  createDocumentOutput,
  deleteDocumentOutput,
  findDocumentsOutput,
  listTemplatesOutput,
  listTrashOutput,
  readDocumentOutput,
  renameDocumentOutput,
  restoreDocumentOutput,
  shareDocumentOutput,
  updateDocumentOutput,
} from './output-schema';
import {
  addTabShape,
  createDocumentShape,
  findDocumentsShape,
  deleteDocumentShape,
  listTrashShape,
  restoreDocumentShape,
  readDocumentShape,
  renameDocumentShape,
  shareDocumentShape,
  updateDocumentShape,
} from './schema';

export function registerTools(server: McpServer, env: Env): void {
  registerTool(
    server,
    env,
    'find_documents',
    {
      behaviour: 'read',
      title: 'Find documents',
      description:
        'Search the user’s documents by name — their personal library AND the shared ' +
        'libraries of every team they belong to. Returns a compact list (id, name, ' +
        'updated time, which library it lives in, and a link to open it). Lightweight ' +
        'and image-free so you can scan many results, then read_document the one you want.',
      inputSchema: findDocumentsShape,
      outputSchema: findDocumentsOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      // Personal + team shared libraries (docs/specs/013-workspace/team-shared-documents.md): a document filed into a
      // team leaves the personal list, so both must be swept.
      const [{ documents: liveDocs }, teamLibraries] = await Promise.all([
        apiJson<DocumentListResponse>(env, token, '/documents'),
        fetchTeamLibraries(env, token),
      ]);
      const matched = matchDocuments(liveDocs, teamLibraries, args.query, args.limit ?? 20).map(
        (d) => ({ ...d, url: deepLink(d.id) }),
      );
      return textResult({ count: matched.length, documents: matched });
    },
  );

  registerTool(
    server,
    env,
    'read_document',
    {
      behaviour: 'read',
      title: 'Read + visualise a document',
      description:
        'Fetch one tab’s elements as structured JSON AND an inline PNG of the ' +
        'tab, plus a link to open it. Use after find_documents to view or before editing.',
      inputSchema: readDocumentShape,
      outputSchema: readDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const loaded = await loadTab(env, token, args.documentId, args.tabId);
      if (!loaded) return errorResult('That document has no tabs.');
      const { document: liveDoc, tab } = loaded;
      return imageResult(
        {
          id: liveDoc.id,
          name: liveDoc.name,
          tab: { id: tab.id, name: tab.name, elements: tab.elements },
          url: deepLink(liveDoc.id),
        },
        tab,
        { env, token },
      );
    },
  );

  registerTool(
    server,
    env,
    'list_templates',
    {
      behaviour: 'read',
      title: 'List templates',
      description:
        'Browse the template library — the same hand-tuned scaffolds the editor\u2019s Quick ' +
        'Start offers (kanban, flowchart, SWOT, gantt, wireframes, ...). Returns categories ' +
        'plus { kind, title, description, category } per template. Pass a kind as "template" ' +
        'on create_document / add_tab to start from it, then personalise the labels with ' +
        'update_document.',
      inputSchema: {},
      outputSchema: listTemplatesOutput,
    },
    async (_args, extra) => {
      requireToken(extra as Extra);
      return textResult({
        categories: TEMPLATE_CATEGORIES,
        // A hidden template is an editor-onboarding artefact, not a scaffold
        // an AI caller should list or build from. None ships today; docs/specs/007-editor/guided-tour-sample.md's
        // guided-tour sample was the last, retired by docs/specs/007-editor/editor-tour.md.
        templates: TEMPLATES.filter((t) => !t.hidden).map((t) => ({
          kind: t.kind,
          title: t.title,
          description: t.description,
          category: templateCategory(t.kind),
        })),
      });
    },
  );

  registerTool(
    server,
    env,
    'create_document',
    {
      behaviour: 'write',
      title: 'Create a document',
      description:
        'Create a new document from diagram elements you produce. The full element format is ' +
        'documented inline on the "tabs" argument below. ' +
        'Pass one tab, or several to build a multi-tab document in one call (an ' +
        'overview plus detail tabs). A tab may pass "template" (a kind from list_templates) ' +
        'instead of elements to start from a hand-tuned scaffold. The server validates, lays ' +
        'out each tab per the layout arg, tags it as AI-generated so it shows in your ' +
        '"Generated" folder (or files it in the user\'s default folder for what that document is made as, ' +
        'when they have set one), and returns the link, the folder, and an inline PNG of the first tab.',
      inputSchema: createDocumentShape,
      outputSchema: createDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      // Accept either `tabs` (preferred) or a single `tab` alias.
      const inputTabs = args.tabs ?? (args.tab ? [args.tab] : undefined);
      if (!inputTabs || inputTabs.length === 0) {
        return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
      }
      const tabs: Tab[] = [];
      // The template the first tab is made from, for the creation intent.
      let firstTemplate: TemplateKind | null = null;
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
          tabs.push(buildTemplateTab(tabId, t.name, kind, args.theme));
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
      // Tag the document as MCP-generated (docs/specs/013-workspace/folders.md). The Explorer surfaces a
      // synthetic "Generated" folder over source != null, so there's no
      // real folder to create / place it in.
      // The creation intent (docs/specs/013-workspace/default-folders.md): with no folder named, the
      // server files the document in the user's default folder for it, when they have one.
      const intent = creationIntentOf(tabs[0], templateFamilyOf(firstTemplate));
      const { document: created } = await apiJson<{ document?: LiveDoc }>(
        env,
        token,
        '/documents',
        {
          method: 'POST',
          body: JSON.stringify({ id, name: args.name, tabs, source: 'mcp', intent }),
        },
      );
      return imageResult(
        {
          id,
          name: args.name,
          tabCount: tabs.length,
          tabIds: tabs.map((t) => t.id),
          folder: await createdFolderLabel(env, token, created),
          url: deepLink(id),
        },
        tabs[0]!,
        { env, token },
      );
    },
  );

  registerTool(
    server,
    env,
    'add_tab',
    {
      behaviour: 'write',
      title: 'Add a tab to a document',
      description:
        'Add a NEW tab (its own canvas) to an existing document — e.g. a detail view zooming ' +
        'into one part of an architecture. Produce the elements like create_document (or pass ' +
        '"template" instead of elements to start from a hand-tuned scaffold); the ' +
        'server validates, lays out per the layout arg, appends the tab, and returns an ' +
        'inline PNG. Run read_document first to see the document and its existing tabs.',
      inputSchema: addTabShape,
      outputSchema: addTabOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const tabId = crypto.randomUUID();
      // Template tab (docs/specs/015-api/mcp-server.md §4.5): resolved up front so an unknown kind
      // fails before any network round trip.
      const templateKind = args.template ? resolveTemplate(args.template) : null;
      if (args.template && !templateKind) {
        return errorResult(
          `Unknown template "${args.template}". Valid kinds: ${validTemplateKinds()}.`,
        );
      }
      const input = resolveGraphInput(args);
      if (input.error) return errorResult(input.error);
      const candidate: unknown = {
        id: tabId,
        name: args.name,
        elements: normaliseElements(args.elements ?? []),
      };
      if (!templateKind && !input.graph && (!args.elements || !isValidTab(candidate))) {
        return errorResult(
          'Invalid input. Provide a "graph" (nodes + edges), "mermaid", "elements", or a "template" kind ' +
            'from list_templates. Check the livediagram://schema/elements resource: every element ' +
            'needs id/type/x/y/width/height (arrows need from/to), and arrays must be well-formed.',
        );
      }
      // Default the new tab's theme to the document's existing one so it matches
      // the other tabs rather than landing as a clashing brand-white tab. The
      // model can still override via args.theme. Best-effort: fall back to the
      // buildTab default if the lookup fails.
      let themeId = args.theme;
      if (!themeId) {
        try {
          const loaded = await loadTab(env, token, args.documentId);
          if (loaded) themeId = loaded.tab.theme;
        } catch {
          /* keep buildTab's default */
        }
      }
      const tab = templateKind
        ? buildTemplateTab(tabId, args.name, templateKind, themeId)
        : input.graph
          ? buildGraphTab(tabId, args.name, input.graph, themeId)
          : buildTab(tabId, args.name, (candidate as Tab).elements, args.layout, themeId);
      await apiJson(env, token, `/documents/${args.documentId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(tab),
      });
      return imageResult(
        { documentId: args.documentId, tabId, name: args.name, url: deepLink(args.documentId) },
        tab,
        { env, token },
      );
    },
  );

  registerTool(
    server,
    env,
    'update_document',
    {
      behaviour: 'destructive',
      title: 'Update a document',
      description:
        'Edit an existing tab. mode "replace" swaps the whole tab’s elements (validated + ' +
        'auto-laid-out); mode "ops" applies an ordered list of add/update/remove against ' +
        'existing element ids and PRESERVES positions (no auto-layout). On an event-storming tab, ' +
        'event-storming notes you add or move land on the board’s horizontal lanes (240px apart, ' +
        'lane 0 centred at y=100). Returns an inline PNG.',
      inputSchema: updateDocumentShape,
      outputSchema: updateDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const loaded = await loadTab(env, token, args.documentId, args.tabId);
      if (!loaded) return errorResult('That document has no tabs.');
      const { tab } = loaded;
      const tabId = tab.id;

      let nextElements: unknown[];
      // Graph-first replace (docs/specs/015-api/mcp-server.md §4.7): a node/edge graph (or Mermaid) the
      // server builds + lays out, in place of hand-placed elements. Already laid
      // out here, so the layout below keeps it.
      const input = args.mode === 'replace' ? resolveGraphInput(args) : {};
      if (input.error) return errorResult(input.error);
      const graphReplace = !!input.graph;
      if (args.mode === 'replace') {
        if (input.graph) {
          nextElements = layoutGraph(input.graph);
        } else if (args.elements) {
          nextElements = normaliseElements(args.elements);
        } else {
          return errorResult('replace mode requires "graph", "mermaid" or "elements".');
        }
      } else {
        if (!args.ops) return errorResult('ops mode requires "ops".');
        const byId = new Map<string, unknown>(tab.elements.map((e) => [e.id, e as unknown]));
        // Only the elements an edit touches are made safe (§4.7a); the rest of
        // the document is left exactly as it is.
        const touched = new Set<string>();
        for (const op of args.ops) {
          const el = op.element as { id?: string } | undefined;
          if (op.op === 'remove' && op.elementId) byId.delete(op.elementId);
          else if (op.op === 'add' && el?.id) {
            byId.set(el.id, el);
            touched.add(el.id);
          } else if (op.op === 'update' && op.elementId) {
            byId.set(op.elementId, mergeElementUpdate(byId.get(op.elementId), el));
            touched.add(op.elementId);
          }
        }
        nextElements = lanesToFront(
          [...byId].map(([id, el]) => (touched.has(id) ? normaliseElement(el) : el)),
        );
      }

      const candidate: unknown = { id: tabId, name: tab.name, elements: nextElements };
      if (!isValidTab(candidate)) {
        return errorResult(
          'The resulting elements are invalid. See the livediagram://schema/elements resource.',
        );
      }
      // Coerce off-vocabulary shape kinds (e.g. "rectangle" -> "square") so an
      // edit can't introduce a node that renders as a bare label, same as create.
      const fixed = candidate.elements.map((el) =>
        el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
      );
      // Layout applies only on a full replace (the model decides via `layout`);
      // ops edits always keep the existing positions (docs/specs/015-api/mcp-server.md §4.4).
      const laidOut: Element[] =
        args.mode === 'replace'
          ? applyLayout(graphReplace ? 'preserve' : args.layout, fixed)
          : fixed;
      // On an event-storming tab the workshop notes this call added or moved
      // land on lanes (docs/specs/021-event-storming/event-storming.md "Always on a lane").
      const elements = landMcpArrivals(
        tab as Tab,
        laidOut,
        args.mode === 'replace' ? 'replace' : 'ops',
      );
      const nextTab: Tab = { ...(tab as Tab), id: tabId, elements };
      await apiJson(env, token, `/documents/${args.documentId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(nextTab),
      });
      return imageResult({ id: args.documentId, tabId, url: deepLink(args.documentId) }, nextTab, {
        env,
        token,
      });
    },
  );

  registerTool(
    server,
    env,
    'share_document',
    {
      behaviour: 'write',
      title: 'Share a document',
      description:
        'Create a shareable link to a document so anyone with the URL can open it — no ' +
        'sign-in required. Choose "view" (read-only, the default) or "edit". Returns the ' +
        'link URL. Use after creating or finding a document to hand it to teammates.',
      inputSchema: shareDocumentShape,
      outputSchema: shareDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      // Default to view (least privilege for an automated share): showing your
      // work shouldn't silently grant edit. The api's own default is edit, so
      // we send the role explicitly.
      const role = args.role === 'edit' ? 'edit' : 'view';
      const { link } = await apiJson<ShareLinkResponse>(
        env,
        token,
        `/documents/${args.documentId}/share`,
        { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
      );
      return textResult({
        url: shareUrl(link.code),
        role: link.role,
        expiresAt: link.expiresAt,
        documentUrl: deepLink(args.documentId),
      });
    },
  );

  registerTool(
    server,
    env,
    'rename_document',
    {
      behaviour: 'write',
      title: 'Rename a document or tab',
      description:
        'Rename a document, or (with tabId) one of its tabs. Non-destructive; returns the ' +
        'updated name.',
      inputSchema: renameDocumentShape,
      outputSchema: renameDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      if (args.tabId) {
        // No tab-name-only endpoint: read the tab, then write it back with the
        // new name (the api ignores UI-only fields on write).
        const { tab } = await apiJson<TabResponse>(
          env,
          token,
          `/documents/${args.documentId}/tabs/${args.tabId}`,
        );
        await apiJson(env, token, `/documents/${args.documentId}/tabs/${args.tabId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...tab, name: args.name }),
        });
        return textResult({ renamed: 'tab', tabId: args.tabId, name: args.name });
      }
      const { document: liveDoc } = await apiJson<DocumentResponse>(
        env,
        token,
        `/documents/${args.documentId}`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({
        renamed: 'document',
        id: liveDoc.id,
        name: liveDoc.name,
        url: deepLink(liveDoc.id),
      });
    },
  );

  registerTool(
    server,
    env,
    'delete_document',
    {
      behaviour: 'destructive',
      title: 'Delete a document or tab',
      description:
        'Delete a document by moving it to the Trash, where it can be restored for ' +
        `${TRASH_RETENTION_DAYS} days (with restore_document, or from Settings › Trash) before ` +
        'it is purged. With tabId, delete just one of its tabs, outright: tabs have no ' +
        'Trash. Confirm with the user first. A document must keep at least one tab.',
      inputSchema: deleteDocumentShape,
      outputSchema: deleteDocumentOutput,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      // A whole document only ever goes to the Trash (docs/specs/013-workspace/trash.md):
      // a permanent delete is the REST API's, never an AI tool's. A tab has no Trash.
      const path = args.tabId
        ? `/documents/${args.documentId}/tabs/${args.tabId}`
        : `/documents/${args.documentId}`;
      // DELETE returns 204 with no body, so use apiFetch (apiJson would choke
      // parsing an empty response) and surface a clear message on failure.
      const res = await apiFetch(env, token, path, { method: 'DELETE' });
      if (!res.ok) {
        // A 5xx is a real failure worth surfacing on the Exceptions dashboard;
        // a 4xx (bad id, last tab) is model-correctable and not reported.
        if (res.status >= 500) reportApiFailure(env, `Http${res.status}`);
        return errorResult(
          `Could not delete (${res.status}). ` +
            (args.tabId
              ? 'A document must keep at least one tab — you cannot delete the last one.'
              : res.status === 410
                ? 'It is already in the Trash (see list_trash).'
                : 'Check the document id and that you own it.'),
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
    },
  );

  // The Trash (docs/specs/013-workspace/trash.md, docs/specs/015-api/mcp-server.md §4.9):
  // what delete_document put there, and the way back. Same authorisation as
  // GET /api/trash and POST /api/trash/<id>/restore: the user's personal Trash
  // and every team Trash they have joined.
  registerTool(
    server,
    env,
    'list_trash',
    {
      behaviour: 'read',
      title: 'List the Trash',
      description:
        'List the documents in the user’s Trash (their own and every team they belong to), ' +
        `each restorable with restore_document until it is purged ${TRASH_RETENTION_DAYS} days ` +
        'after deletion. Returns id, name, library, when it was deleted, and when it goes.',
      inputSchema: listTrashShape,
      outputSchema: listTrashOutput,
    },
    async (_args, extra) => {
      const token = requireToken(extra as Extra);
      const { trash } = await apiJson<{ trash?: TrashedDocument[] }>(env, token, '/trash');
      return textResult({
        trash: (trash ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          library: t.teamName ?? (t.teamId ? 'team' : 'personal'),
          deletedAt: new Date(t.trashedAt).toISOString(),
          purgeAt: new Date(t.purgeAt).toISOString(),
        })),
      });
    },
  );

  registerTool(
    server,
    env,
    'restore_document',
    {
      behaviour: 'write',
      title: 'Restore a document from the Trash',
      description:
        'Bring a deleted document back from the Trash, to the folder it was in (or Unsorted ' +
        'if that folder is gone), with its tabs and share links. Find it with list_trash.',
      inputSchema: restoreDocumentShape,
      outputSchema: restoreDocumentOutput,
    },
    async (args, extra) => {
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
    },
  );
}
