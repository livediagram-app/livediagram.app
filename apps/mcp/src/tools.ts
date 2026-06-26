// The five MCP tools (spec/62 §4). Each is a thin wrapper over the api worker
// plus the shared diagram helpers (validate / auto-layout / renderElementsToSvg)
// — no business logic the editor doesn't already own. The calling LLM produces
// the elements; these tools validate, lay out, persist, and render.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Diagram, DiagramSummary, Folder, TabRecord } from '@livediagram/api-schema';
import {
  autoLayoutElements,
  coerceShapeKind,
  getBuiltInTheme,
  isLayoutCandidate,
  isValidTab,
  nodesLookUnplaced,
  recolourElementsForTheme,
  renderElementsToSvg,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import { apiJson } from './api';
import type { Env } from './env';
import { svgToPngBase64 } from './render';
import {
  addTabShape,
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

// Layout is the model's call (spec/62 §4.3). 'preserve' keeps the coordinates
// it gave (a ring for a cycle, a tree, a grid); 'auto' forces a clean server
// layout; omitted = preserve a real arrangement, but auto-lay-out when the
// model left everything piled at one spot. Either way the connected graph is
// the only thing arranged — edgeless content keeps its place.
function applyLayout(layout: 'auto' | 'preserve' | undefined, elements: Element[]): Element[] {
  const shouldLayout =
    layout === 'auto' ? true : layout === 'preserve' ? false : nodesLookUnplaced(elements);
  return shouldLayout && isLayoutCandidate(elements) ? autoLayoutElements(elements) : elements;
}

// Build a finished, persistable Tab from validated elements: apply the layout,
// then paint the chosen preset theme onto the elements + the canvas backdrop —
// the same engine the editor uses (spec/62). `themeId` defaults to brand;
// unknown ids fall back to it. `elements` must already be a valid Element[].
function buildTab(
  tabId: string,
  name: string,
  elements: Element[],
  layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
): Tab {
  const theme = getBuiltInTheme(themeId);
  // Coerce off-vocabulary shape kinds (e.g. a model emitting "rectangle", which
  // isn't a kind — the box is "square") so every node actually renders a box.
  const coerced = elements.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  const laidOut = applyLayout(layout, coerced);
  return {
    id: tabId,
    name,
    elements: recolourElementsForTheme(laidOut, theme),
    theme: theme.id,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
  };
}

// MCP-created diagrams land in a dedicated "Generated" folder rather
// than Unsorted (spec/62). Find the owner's folder by name or create it; the
// diagram POST takes the folderId directly. Best-effort: if folder
// listing/creation fails, fall back to Unsorted rather than failing the create.
const GENERATED_FOLDER_NAME = 'Generated';

async function ensureGeneratedFolder(env: Env, token: string): Promise<string | null> {
  try {
    const { folders } = await apiJson<{ folders: Folder[] }>(env, token, '/folders');
    const existing = folders.find(
      (f) => f.name === GENERATED_FOLDER_NAME && !f.parentId && !f.teamId,
    );
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await apiJson(env, token, '/folders', {
      method: 'POST',
      body: JSON.stringify({ id, name: GENERATED_FOLDER_NAME }),
    });
    return id;
  } catch {
    return null;
  }
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
        'livediagram://schema/elements resource). Pass one tab, or several to build a ' +
        'multi-tab diagram in one call (an overview plus detail tabs). The server validates, ' +
        'lays out each tab per the layout arg, files it under your "Generated" ' +
        'folder, and returns the link + an inline PNG of the first tab.',
      inputSchema: createDiagramShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      // Accept either `tabs` (preferred) or a single `tab` alias.
      const inputTabs = args.tabs ?? (args.tab ? [args.tab] : undefined);
      if (!inputTabs || inputTabs.length === 0) {
        return errorResult('Provide "tabs": an array of { name, elements } (or a single "tab").');
      }
      const tabs: Tab[] = [];
      for (const t of inputTabs) {
        const tabId = crypto.randomUUID();
        const candidate: unknown = { id: tabId, name: t.name, elements: t.elements };
        if (!isValidTab(candidate)) {
          return errorResult(
            `Invalid elements in tab "${t.name}". Check the livediagram://schema/elements ` +
              'resource: every element needs id/type/x/y/width/height (arrows need from/to), ' +
              'and arrays must be well-formed.',
          );
        }
        tabs.push(buildTab(tabId, t.name, candidate.elements, args.layout, args.theme));
      }
      const id = crypto.randomUUID();
      const folderId = await ensureGeneratedFolder(env, token);
      await apiJson(env, token, '/diagrams', {
        method: 'POST',
        body: JSON.stringify({ id, name: args.name, tabs, ...(folderId ? { folderId } : {}) }),
      });
      return imageResult(
        {
          id,
          name: args.name,
          tabCount: tabs.length,
          tabIds: tabs.map((t) => t.id),
          folder: folderId ? GENERATED_FOLDER_NAME : 'Unsorted',
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
        'into one part of an architecture. Produce the elements like create_diagram; the ' +
        'server validates, lays out per the layout arg, appends the tab, and returns an ' +
        'inline PNG. Run read_diagram first to see the diagram and its existing tabs.',
      inputSchema: addTabShape,
    },
    async (args, extra) => {
      const token = requireToken(extra as Extra);
      const tabId = crypto.randomUUID();
      const candidate: unknown = { id: tabId, name: args.name, elements: args.elements };
      if (!isValidTab(candidate)) {
        return errorResult(
          'Invalid elements. Check the livediagram://schema/elements resource: every element ' +
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
      const tab = buildTab(tabId, args.name, candidate.elements, args.layout, themeId);
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
      // Coerce off-vocabulary shape kinds (e.g. "rectangle" -> "square") so an
      // edit can't introduce a node that renders as a bare label, same as create.
      const fixed = candidate.elements.map((el) =>
        el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
      );
      // Layout applies only on a full replace (the model decides via `layout`);
      // ops edits always keep the existing positions (spec/62 §4.4).
      const elements: Element[] = args.mode === 'replace' ? applyLayout(args.layout, fixed) : fixed;
      const nextTab: Tab = { ...(tab as Tab), id: tabId, elements };
      await apiJson(env, token, `/diagrams/${args.diagramId}/tabs/${tabId}`, {
        method: 'PUT',
        body: JSON.stringify(nextTab),
      });
      return imageResult({ id: args.diagramId, tabId, url: deepLink(args.diagramId) }, nextTab);
    },
  );
}
