// The four MCP tools (spec/62 §4). Each is a thin wrapper over the api worker
// plus the shared diagram helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Diagram, DiagramSummary, TabRecord } from '@livediagram/api-schema';
import {
  autoLayoutElements,
  isLayoutCandidate,
  isValidTab,
  renderElementsToSvg,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { apiJson } from './api';
import type { Env } from './env';
import { svgToPngBase64 } from './render';
import {
  createDiagramShape,
  findDiagramsShape,
  readDiagramShape,
  updateDiagramShape,
} from './schema';

type Extra = RequestHandlerExtra<never, never>;
type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

function requireToken(extra: Extra): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error('unauthorized: no bearer token');
  return token;
}

function textResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function imageResult(value: unknown, tab: Tab): Promise<ToolResult> {
  const png = await svgToPngBase64(renderElementsToSvg(tab));
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      { type: 'image', data: png, mimeType: 'image/png' },
    ],
  };
}

export function registerTools(server: McpServer, env: Env): void {
  server.registerTool(
    'find_diagrams',
    {
      title: 'Find diagrams',
      description:
        'Search the user’s diagrams by name. Returns a compact list (id, name, ' +
        'updated time, and a link to open it). Lightweight and image-free so you can ' +
        'scan many results, then read_diagram the one you want.',
      inputSchema: findDiagramsShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const { diagrams } = await apiJson<{ diagrams: DiagramSummary[] }>(env, token, '/diagrams');
      const q = (args.query ?? '').toLowerCase();
      const limit = args.limit ?? 20;
      const matched = diagrams
        .filter((d) => !q || d.name.toLowerCase().includes(q))
        .slice(0, limit)
        .map((d) => ({ id: d.id, name: d.name, updatedAt: d.savedAt, url: deepLink(d.id) }));
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
    'create_diagram',
    {
      title: 'Create a diagram',
      description:
        'Create a new diagram from elements you produce (see the ' +
        'livediagram://schema/elements resource). Emit nodes + pinned arrows with rough ' +
        'or zero coordinates; the server validates, auto-lays-out the graph, persists it, ' +
        'and returns the link + an inline PNG.',
      inputSchema: createDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const tabId = crypto.randomUUID();
      const candidate: unknown = { id: tabId, name: args.tab.name, elements: args.tab.elements };
      if (!isValidTab(candidate)) {
        return errorResult(
          'Invalid elements. Check the livediagram://schema/elements resource: every ' +
            'element needs id/type/x/y/width/height (arrows need from/to), and arrays must ' +
            'be well-formed.',
        );
      }
      let elements: Element[] = candidate.elements;
      if (isLayoutCandidate(elements)) elements = autoLayoutElements(elements);
      const tab: Tab = { ...candidate, elements };
      const id = crypto.randomUUID();
      await apiJson(env, token, '/diagrams', {
        method: 'POST',
        body: JSON.stringify({ id, name: args.name, tabs: [tab] }),
      });
      return imageResult({ id, name: args.name, tabId, url: deepLink(id) }, tab);
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
      if (args.mode === 'replace') {
        if (!args.elements) return errorResult('replace mode requires "elements".');
        nextElements = args.elements;
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
      let elements: Element[] = candidate.elements;
      // Auto-layout only on a full replace; ops edits must keep the user's
      // existing positions (spec/62 §4.4).
      if (args.mode === 'replace' && isLayoutCandidate(elements)) {
        elements = autoLayoutElements(elements);
      }
      const nextTab: Tab = { ...(tab as Tab), id: tabId, elements };
      await apiJson(env, token, `/diagrams/${args.diagramId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(nextTab),
      });
      return imageResult({ id: args.diagramId, tabId, url: deepLink(args.diagramId) }, nextTab);
    },
  );
}
