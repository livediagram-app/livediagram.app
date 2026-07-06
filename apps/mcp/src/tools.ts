// The MCP tools (spec/62 §4). Each is a thin wrapper over the api worker
// plus the shared diagram helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render. The
// shared result / auth / tab-building plumbing lives in tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Diagram, DiagramSummary, ShareLink, TabRecord } from '@livediagram/api-schema';
import {
  coerceShapeKind,
  graphToElements,
  isValidTab,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { TEMPLATES, TEMPLATE_CATEGORIES, templateCategory } from '@livediagram/templates';
import { apiFetch, apiJson, postTelemetry } from './api';
import type { Env } from './env';
import { fetchTeamLibraries, matchDiagrams } from './find-diagrams';
import {
  deepLink,
  errorResult,
  imageResult,
  requireToken,
  shareUrl,
  textResult,
  type Extra,
} from './tool-helpers';
import {
  applyLayout,
  buildTab,
  buildGraphTab,
  buildTemplateTab,
  resolveTemplate,
  validTemplateKinds,
} from './tab-builders';
import {
  addTabShape,
  createDiagramShape,
  findDiagramsShape,
  deleteDiagramShape,
  readDiagramShape,
  renameDiagramShape,
  shareDiagramShape,
  updateDiagramShape,
} from './schema';

export function registerTools(server: McpServer, env: Env): void {
  server.registerTool(
    'find_diagrams',
    {
      title: 'Find diagrams',
      description:
        'Search the user’s diagrams by name — their personal library AND the shared ' +
        'libraries of every team they belong to. Returns a compact list (id, name, ' +
        'updated time, which library it lives in, and a link to open it). Lightweight ' +
        'and image-free so you can scan many results, then read_diagram the one you want.',
      inputSchema: findDiagramsShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'FindDiagrams');
      // Personal + team shared libraries (spec/35): a diagram filed into a
      // team leaves the personal list, so both must be swept.
      const [{ diagrams }, teamLibraries] = await Promise.all([
        apiJson<{ diagrams: DiagramSummary[] }>(env, token, '/diagrams'),
        fetchTeamLibraries(env, token),
      ]);
      const matched = matchDiagrams(diagrams, teamLibraries, args.query, args.limit ?? 20).map(
        (d) => ({ ...d, url: deepLink(d.id) }),
      );
      return textResult({ count: matched.length, diagrams: matched });
    },
  );

  server.registerTool(
    'read_diagram',
    {
      title: 'Read + visualise a diagram',
      description:
        'Fetch one diagram tab’s elements as structured JSON AND an inline PNG of the ' +
        'tab, plus a link to open it. Use after find_diagrams to view or before editing.',
      inputSchema: readDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'ReadDiagram');
      const { diagram } = await apiJson<{ diagram: Diagram }>(
        env,
        token,
        `/diagrams/${args.diagramId}`,
      );
      const tabId = args.tabId ?? diagram.tabs[0]?.id;
      if (!tabId) return errorResult('That diagram has no tabs.');
      const { tab } = await apiJson<{ tab: TabRecord }>(
        env,
        token,
        `/diagrams/${args.diagramId}/tabs/${tabId}`,
      );
      return imageResult(
        {
          id: diagram.id,
          name: diagram.name,
          tab: { id: tab.id, name: tab.name, elements: tab.elements },
          url: deepLink(diagram.id),
        },
        tab,
      );
    },
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List templates',
      description:
        'Browse the template library — the same hand-tuned scaffolds the editor\u2019s Quick ' +
        'Start offers (kanban, flowchart, SWOT, gantt, wireframes, ...). Returns categories ' +
        'plus { kind, title, description, category } per template. Pass a kind as "template" ' +
        'on create_diagram / add_tab to start from it, then personalise the labels with ' +
        'update_diagram.',
      inputSchema: {},
    },
    async (_args, extra) => {
      requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'ListTemplates');
      return textResult({
        categories: TEMPLATE_CATEGORIES,
        // Hidden templates (spec/69's guided tour) are editor-onboarding
        // artefacts, not scaffolds an AI caller should list or build from.
        templates: TEMPLATES.filter((t) => !t.hidden).map((t) => ({
          kind: t.kind,
          title: t.title,
          description: t.description,
          category: templateCategory(t.kind),
        })),
      });
    },
  );

  server.registerTool(
    'create_diagram',
    {
      title: 'Create a diagram',
      description:
        'Create a new diagram from elements you produce. The element format is described ' +
        'on the "tabs" argument below, so you have everything you need here (no need to ' +
        'look it up). Pass one tab, or several to build a multi-tab diagram in one call (an ' +
        'overview plus detail tabs). A tab may pass "template" (a kind from list_templates) ' +
        'instead of elements to start from a hand-tuned scaffold. The server validates, lays ' +
        'out each tab per the layout arg, tags it as AI-generated so it shows in your ' +
        '"Generated" folder, and returns the link + an inline PNG of the first tab.',
      inputSchema: createDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'CreateDiagram');
      // Accept either `tabs` (preferred) or a single `tab` alias.
      const inputTabs = args.tabs ?? (args.tab ? [args.tab] : undefined);
      if (!inputTabs || inputTabs.length === 0) {
        return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
      }
      const tabs: Tab[] = [];
      for (const t of inputTabs) {
        const tabId = crypto.randomUUID();
        // Template tab (spec/62 §4.5): materialise the curated scaffold
        // instead of expecting elements.
        if (t.template) {
          const kind = resolveTemplate(t.template);
          if (!kind) {
            return errorResult(
              `Unknown template "${t.template}" in tab "${t.name}". Valid kinds: ` +
                `${validTemplateKinds()}.`,
            );
          }
          tabs.push(buildTemplateTab(tabId, t.name, kind, args.theme));
          continue;
        }
        // Graph-first (spec/62 §4.7): the server builds + lays out the boxes
        // and arrows from a node/edge graph.
        if (t.graph) {
          tabs.push(buildGraphTab(tabId, t.name, t.graph, args.theme));
          continue;
        }
        const candidate: unknown = { id: tabId, name: t.name, elements: t.elements ?? [] };
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
      // Tag the diagram as MCP-generated (spec/15). The Explorer surfaces a
      // synthetic "Generated" folder over source != null, so there's no
      // real folder to create / place it in.
      await apiJson(env, token, '/diagrams', {
        method: 'POST',
        body: JSON.stringify({ id, name: args.name, tabs, source: 'mcp' }),
      });
      return imageResult(
        {
          id,
          name: args.name,
          tabCount: tabs.length,
          tabIds: tabs.map((t) => t.id),
          folder: 'Generated',
          url: deepLink(id),
        },
        tabs[0]!,
      );
    },
  );

  server.registerTool(
    'add_tab',
    {
      title: 'Add a tab to a diagram',
      description:
        'Add a NEW tab (its own canvas) to an existing diagram — e.g. a detail view zooming ' +
        'into one part of an architecture. Produce the elements like create_diagram (or pass ' +
        '"template" instead of elements to start from a hand-tuned scaffold); the ' +
        'server validates, lays out per the layout arg, appends the tab, and returns an ' +
        'inline PNG. Run read_diagram first to see the diagram and its existing tabs.',
      inputSchema: addTabShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'AddTab');
      const tabId = crypto.randomUUID();
      // Template tab (spec/62 §4.5): resolved up front so an unknown kind
      // fails before any network round trip.
      const templateKind = args.template ? resolveTemplate(args.template) : null;
      if (args.template && !templateKind) {
        return errorResult(
          `Unknown template "${args.template}". Valid kinds: ${validTemplateKinds()}.`,
        );
      }
      const candidate: unknown = { id: tabId, name: args.name, elements: args.elements ?? [] };
      if (!templateKind && !args.graph && (!args.elements || !isValidTab(candidate))) {
        return errorResult(
          'Invalid input. Provide a "graph" (nodes + edges), "elements", or a "template" kind ' +
            'from list_templates. Check the livediagram://schema/elements resource: every element ' +
            'needs id/type/x/y/width/height (arrows need from/to), and arrays must be well-formed.',
        );
      }
      // Default the new tab's theme to the diagram's existing one so it matches
      // the other tabs rather than landing as a clashing brand-white tab. The
      // model can still override via args.theme. Best-effort: fall back to the
      // buildTab default if the lookup fails.
      let themeId = args.theme;
      if (!themeId) {
        try {
          const { diagram } = await apiJson<{ diagram: Diagram }>(
            env,
            token,
            `/diagrams/${args.diagramId}`,
          );
          const firstTabId = diagram.tabs[0]?.id;
          if (firstTabId) {
            const { tab: existing } = await apiJson<{ tab: TabRecord }>(
              env,
              token,
              `/diagrams/${args.diagramId}/tabs/${firstTabId}`,
            );
            themeId = existing.theme;
          }
        } catch {
          /* keep buildTab's default */
        }
      }
      const tab = templateKind
        ? buildTemplateTab(tabId, args.name, templateKind, themeId)
        : args.graph
          ? buildGraphTab(tabId, args.name, args.graph, themeId)
          : buildTab(tabId, args.name, (candidate as Tab).elements, args.layout, themeId);
      await apiJson(env, token, `/diagrams/${args.diagramId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(tab),
      });
      return imageResult(
        { diagramId: args.diagramId, tabId, name: args.name, url: deepLink(args.diagramId) },
        tab,
      );
    },
  );

  server.registerTool(
    'update_diagram',
    {
      title: 'Update a diagram',
      description:
        'Edit an existing tab. mode "replace" swaps the whole tab’s elements (validated + ' +
        'auto-laid-out); mode "ops" applies an ordered list of add/update/remove against ' +
        'existing element ids and PRESERVES positions (no auto-layout). Returns an inline PNG.',
      inputSchema: updateDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'UpdateDiagram');
      const { diagram } = await apiJson<{ diagram: Diagram }>(
        env,
        token,
        `/diagrams/${args.diagramId}`,
      );
      const tabId = args.tabId ?? diagram.tabs[0]?.id;
      if (!tabId) return errorResult('That diagram has no tabs.');
      const { tab } = await apiJson<{ tab: TabRecord }>(
        env,
        token,
        `/diagrams/${args.diagramId}/tabs/${tabId}`,
      );

      let nextElements: unknown[];
      // Graph-first replace (spec/62 §4.7): a node/edge graph the server builds
      // + lays out, in place of hand-placed elements. Forces auto layout below.
      const graphReplace = args.mode === 'replace' && !!args.graph;
      if (args.mode === 'replace') {
        if (args.graph) {
          nextElements = graphToElements(args.graph);
        } else if (args.elements) {
          nextElements = args.elements;
        } else {
          return errorResult('replace mode requires "graph" or "elements".');
        }
      } else {
        if (!args.ops) return errorResult('ops mode requires "ops".');
        const byId = new Map<string, unknown>(tab.elements.map((e) => [e.id, e as unknown]));
        for (const op of args.ops) {
          const el = op.element as { id?: string } | undefined;
          if (op.op === 'remove' && op.elementId) byId.delete(op.elementId);
          else if (op.op === 'add' && el?.id) byId.set(el.id, el);
          else if (op.op === 'update' && op.elementId) {
            const prev = (byId.get(op.elementId) as Record<string, unknown>) ?? {};
            byId.set(op.elementId, { ...prev, ...(el ?? {}) });
          }
        }
        nextElements = [...byId.values()];
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
      // ops edits always keep the existing positions (spec/62 §4.4).
      const elements: Element[] =
        args.mode === 'replace' ? applyLayout(graphReplace ? 'auto' : args.layout, fixed) : fixed;
      const nextTab: Tab = { ...(tab as Tab), id: tabId, elements };
      await apiJson(env, token, `/diagrams/${args.diagramId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(nextTab),
      });
      return imageResult({ id: args.diagramId, tabId, url: deepLink(args.diagramId) }, nextTab);
    },
  );

  server.registerTool(
    'share_diagram',
    {
      title: 'Share a diagram',
      description:
        'Create a shareable link to a diagram so anyone with the URL can open it — no ' +
        'sign-in required. Choose "view" (read-only, the default) or "edit". Returns the ' +
        'link URL. Use after creating or finding a diagram to hand it to teammates.',
      inputSchema: shareDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'ShareDiagram');
      // Default to view (least privilege for an automated share): showing your
      // work shouldn't silently grant edit. The api's own default is edit, so
      // we send the role explicitly.
      const role = args.role === 'edit' ? 'edit' : 'view';
      const { link } = await apiJson<{ link: ShareLink }>(
        env,
        token,
        `/diagrams/${args.diagramId}/share`,
        { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
      );
      return textResult({
        url: shareUrl(link.code),
        role: link.role,
        expiresAt: link.expiresAt,
        diagramUrl: deepLink(args.diagramId),
      });
    },
  );

  server.registerTool(
    'rename_diagram',
    {
      title: 'Rename a diagram or tab',
      description:
        'Rename a diagram, or (with tabId) one of its tabs. Non-destructive; returns the ' +
        'updated name.',
      inputSchema: renameDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'RenameDiagram');
      if (args.tabId) {
        // No tab-name-only endpoint: read the tab, then write it back with the
        // new name (the api ignores UI-only fields on write).
        const { tab } = await apiJson<{ tab: TabRecord }>(
          env,
          token,
          `/diagrams/${args.diagramId}/tabs/${args.tabId}`,
        );
        await apiJson(env, token, `/diagrams/${args.diagramId}/tabs/${args.tabId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...tab, name: args.name }),
        });
        return textResult({ renamed: 'tab', tabId: args.tabId, name: args.name });
      }
      const { diagram } = await apiJson<{ diagram: Diagram }>(
        env,
        token,
        `/diagrams/${args.diagramId}`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({
        renamed: 'diagram',
        id: diagram.id,
        name: diagram.name,
        url: deepLink(diagram.id),
      });
    },
  );

  server.registerTool(
    'delete_diagram',
    {
      title: 'Delete a diagram or tab',
      description:
        'PERMANENTLY delete a diagram — or, with tabId, just one of its tabs. This cannot ' +
        'be undone, so confirm with the user first. A diagram must keep at least one tab.',
      inputSchema: deleteDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      postTelemetry(env, 'Mcp', 'Used', 'DeleteDiagram');
      const path = args.tabId
        ? `/diagrams/${args.diagramId}/tabs/${args.tabId}`
        : `/diagrams/${args.diagramId}`;
      // DELETE returns 204 with no body, so use apiFetch (apiJson would choke
      // parsing an empty response) and surface a clear message on failure.
      const res = await apiFetch(env, token, path, { method: 'DELETE' });
      if (!res.ok) {
        return errorResult(
          `Could not delete (${res.status}). ` +
            (args.tabId
              ? 'A diagram must keep at least one tab — you cannot delete the last one.'
              : 'Check the diagram id and that you own it.'),
        );
      }
      return textResult(
        args.tabId
          ? { deleted: 'tab', diagramId: args.diagramId, tabId: args.tabId }
          : { deleted: 'diagram', diagramId: args.diagramId },
      );
    },
  );
}
