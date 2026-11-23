// The core verbs, always listed (liveworkspace/docs/specs/021-mcp/mcp.md "Three layers"): nine tools that work on
// any item by its ref, each mapped onto the app's own tools, plus the two that reach an app's editing tools.
import { APPS, CREATE_KINDS, KINDS, appOfKind, parseRef, refOf, type AppSpec } from './apps';
import type { AppCatalogue, ListedTool } from './catalogue';
import { TokenRefused, type ToolResult } from './app-client';

// What a core verb needs from the request: the apps this connection may reach, each one's catalogue, and a call
// to an app's own tool by its own name.
export type CoreContext = {
  allowed: readonly AppSpec[];
  catalogue: (spec: AppSpec) => Promise<AppCatalogue>;
  call: (spec: AppSpec, appTool: string, args: Record<string, unknown>) => Promise<ToolResult>;
};

const REF = {
  type: 'string',
  description:
    'The item’s ref, "<kind>:<id>" (such as "diagram:Ab3dE"), as find_items or create_item answer it.',
};

const KIND_LIST =
  'diagram (livediagram), doc (livedocuments: slide decks, articles, infographics), plan (liveplanner: boards of ' +
  'cards, sheets, forms, dashboards), design (livedesign: logos, social posts, mockups), knowledgebase ' +
  '(liveknowledge: a team wiki)';

export const CORE_TOOLS: readonly ListedTool[] = [
  {
    name: 'find_items',
    title: 'Find items',
    description:
      'Find the person’s items by name across their liveworkspace apps: ' +
      KIND_LIST +
      '. Answers each match with its ref ("diagram:<id>"), which every other tool takes. Pass kind to look in one ' +
      'app only, and where "archived" or "trash" to look there. Not for what a knowledgebase says: for that, ' +
      'search_knowledge_pages (list_app_tools with kind "knowledgebase").',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Words in the item’s name. Left out: the most recent.',
        },
        kind: { type: 'string', enum: [...KINDS], description: 'Only this kind of item.' },
        where: {
          type: 'string',
          enum: ['library', 'archived', 'trash'],
          description: 'Where to look: the library (default), archived items, or the Trash.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'At most this many per app (default 20).',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_item',
    title: 'Read an item',
    description:
      'Read one item by its ref: a diagram’s, doc’s, plan’s or design’s tabs and what is on them; ' +
      'a knowledgebase’s page tree. For more detail use the kind’s own tools from list_app_tools: a plan’s ' +
      'cards (list_cards), a sheet’s cells (read_sheet), a knowledgebase page (read_knowledge_page).',
    inputSchema: {
      type: 'object',
      properties: {
        ref: REF,
        tabId: { type: 'string', description: 'Only this tab (not for a knowledgebase).' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_item',
    title: 'Create an item',
    description:
      'Make a new item: a diagram, a slide deck, an article, an infographic, a plan, a design or a knowledgebase. ' +
      'It starts blank (a plan from the kanban template), or from a template (each kind’s list_*_templates tool lists them; list_app_tools). ' +
      'Answers its ref. To fill it (boxes and arrows, slides, article text, cards, pages) use the kind’s editing ' +
      'tools: list_app_tools.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: Object.keys(CREATE_KINDS),
          description:
            'What to make. A deck, an article and an infographic are docs (livedocuments).',
        },
        name: { type: 'string', description: 'Its name. Keep it short: at most 60 characters.' },
        template: {
          type: 'string',
          description: 'Start from this template kind instead (not for a knowledgebase page tree).',
        },
        theme: { type: 'string', description: 'A preset theme id (not for a knowledgebase).' },
      },
      required: ['kind', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'share_item',
    title: 'Share an item',
    description:
      'Make or change an item’s share link: what it grants ("participate" by default, or "view", "edit") and ' +
      'when it stops working. Answers the link.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: REF,
        role: {
          type: 'string',
          enum: ['participate', 'view', 'edit'],
          description: 'What the link grants: "participate" (default), "view" or "edit".',
        },
        expiry: {
          type: 'string',
          enum: ['never', 'week', 'month', 'sixMonths'],
          description: 'When the link stops working: "never" (default).',
        },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    annotations: { openWorldHint: false },
  },
  {
    name: 'rename_item',
    title: 'Rename an item',
    description: 'Rename an item by its ref.',
    inputSchema: {
      type: 'object',
      properties: { ref: REF, name: { type: 'string', description: 'The new name.' } },
      required: ['ref', 'name'],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
  },
  {
    name: 'trash_item',
    title: 'Move an item to the Trash',
    description: 'Move an item to the Trash. restore_item brings it back.',
    inputSchema: {
      type: 'object',
      properties: { ref: REF },
      required: ['ref'],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
  },
  {
    name: 'restore_item',
    title: 'Restore an item',
    description: 'Bring an item back from the Trash (find_items with where "trash" lists them).',
    inputSchema: {
      type: 'object',
      properties: { ref: REF },
      required: ['ref'],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
  },
  {
    name: 'list_app_tools',
    title: 'List a kind’s editing tools',
    description:
      'The editing tools for one kind of item, beyond these core ones: a diagram’s boxes and arrows, a doc’s ' +
      'slides and article text, a plan’s cards, sheets and forms, a design’s pages, a knowledgebase’s ' +
      'pages, plus each kind’s comments, templates, pictures and automations. Without tools: each tool’s ' +
      'name and what it does. With tools: those tools’ full descriptions and input schemas, which use_app_tool ' +
      'then calls.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: [...KINDS], description: KIND_LIST },
        tools: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10,
          description: 'Tool names (from the list without this) to describe in full.',
        },
      },
      required: ['kind'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'use_app_tool',
    title: 'Use an editing tool',
    description:
      'Call one of the editing tools list_app_tools names (update_diagram, change_cards, write_article, ' +
      'change_sheet, write_knowledge_page...) with its arguments, as its input schema says.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'The tool’s name, as list_app_tools gives it.' },
        arguments: { type: 'object', description: 'Its arguments, as its input schema says.' },
      },
      required: ['tool'],
      additionalProperties: false,
    },
  },
];

export const CORE_NAMES: ReadonlySet<string> = new Set(CORE_TOOLS.map((t) => t.name));

export function textResult(value: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
    ...(isError ? { isError: true } : {}),
  };
}

const refused = (message: string) => textResult(message, true);

function allowedSpec(ctx: CoreContext, spec: AppSpec | null): AppSpec | null {
  return spec && ctx.allowed.some((a) => a.app === spec.app) ? spec : null;
}

function notAllowed(kind: string): ToolResult {
  return refused(
    `This connection may not reach ${kind} items: they were left unticked when it was approved. Connect again to tick them.`,
  );
}

function byRef(ctx: CoreContext, args: Record<string, unknown>) {
  const parsed = parseRef(args.ref);
  if (!parsed)
    return {
      error: refused(
        `ref must be "<kind>:<id>", the kind one of ${KINDS.join(', ')} (find_items answers refs).`,
      ),
    };
  if (!allowedSpec(ctx, parsed.spec)) return { error: notAllowed(parsed.spec.kind) };
  return { spec: parsed.spec, id: parsed.id };
}

// The matches an app's find, list_trash or create tool answered, each marked with its ref: the first array of
// objects with an id in its structured answer, or the answer itself when it is one item.
function withRefs(spec: AppSpec, result: ToolResult): Record<string, unknown>[] {
  const structured = result.structuredContent ?? parseText(result);
  if (!structured) return [];
  for (const value of Object.values(structured)) {
    if (Array.isArray(value) && value.every((v) => v && typeof v === 'object'))
      return (value as Record<string, unknown>[]).map((entry) => mark(spec, entry));
  }
  return [];
}

function mark(spec: AppSpec, entry: Record<string, unknown>): Record<string, unknown> {
  const id =
    typeof entry.id === 'string'
      ? entry.id
      : typeof entry[spec.idParam] === 'string'
        ? entry[spec.idParam]
        : null;
  return id
    ? { ref: refOf(spec, id as string), kind: spec.kind, ...entry }
    : { kind: spec.kind, ...entry };
}

function parseText(result: ToolResult): Record<string, unknown> | null {
  const text = result.content.find((c) => c.type === 'text')?.text;
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function errorText(result: ToolResult): string {
  return result.content.find((c) => c.type === 'text')?.text ?? 'failed';
}

async function findItems(ctx: CoreContext, args: Record<string, unknown>): Promise<ToolResult> {
  const kind = typeof args.kind === 'string' ? args.kind : null;
  const only = kind ? allowedSpec(ctx, appOfKind(kind)) : null;
  if (kind && !only)
    return appOfKind(kind) ? notAllowed(kind) : refused(`kind must be one of ${KINDS.join(', ')}.`);
  const specs = only ? [only] : ctx.allowed;
  const where = args.where === 'trash' || args.where === 'archived' ? args.where : 'library';
  const limit =
    typeof args.limit === 'number' ? Math.min(50, Math.max(1, Math.floor(args.limit))) : undefined;
  const answers = await Promise.all(
    specs.map(async (spec) => {
      try {
        const result =
          where === 'trash'
            ? await ctx.call(spec, spec.core.listTrash, {})
            : await ctx.call(spec, spec.core.find, {
                ...(typeof args.query === 'string' && args.query ? { query: args.query } : {}),
                ...(where === 'archived' ? { archived: true } : {}),
                ...(limit ? { limit } : {}),
              });
        if (result.isError) return { spec, error: errorText(result) };
        return { spec, items: withRefs(spec, result) };
      } catch (err) {
        if (err instanceof TokenRefused) throw err;
        return { spec, error: err instanceof Error ? err.message : 'failed' };
      }
    }),
  );
  const items = answers.flatMap((a) => a.items ?? []);
  const failed = answers.filter((a) => a.error).map((a) => ({ kind: a.spec.kind, error: a.error }));
  const value = { count: items.length, items, ...(failed.length ? { failed } : {}) };
  return { ...textResult(value), structuredContent: value };
}

async function createItem(ctx: CoreContext, args: Record<string, unknown>): Promise<ToolResult> {
  const made = typeof args.kind === 'string' ? CREATE_KINDS[args.kind] : undefined;
  if (!made) return refused(`kind must be one of ${Object.keys(CREATE_KINDS).join(', ')}.`);
  const spec = allowedSpec(ctx, appOfKind(made.kind));
  if (!spec) return notAllowed(made.kind);
  const template =
    typeof args.template === 'string' && args.template ? args.template : made.template;
  const theme = typeof args.theme === 'string' && args.theme ? args.theme : undefined;
  const appArgs: Record<string, unknown> =
    spec.kind === 'knowledgebase'
      ? { name: args.name, ...(template ? { template } : {}) }
      : {
          name: args.name,
          // An app makes nothing without a tab: a blank one when no template is named.
          tabs: [template ? { template } : { elements: [] }],
          ...(theme ? { theme } : {}),
        };
  const result = await ctx.call(spec, spec.core.create, appArgs);
  if (result.isError) return result;
  return withRef(spec, result);
}

// An answer about one item, with its ref added where the answer names the item's id.
function withRef(spec: AppSpec, result: ToolResult): ToolResult {
  const structured = result.structuredContent ?? parseText(result);
  const id = structured?.[spec.idParam] ?? structured?.id;
  if (!structured || typeof id !== 'string') return result;
  const value = { ref: refOf(spec, id), ...structured };
  return { ...textResult(value), structuredContent: value };
}

async function listAppTools(ctx: CoreContext, args: Record<string, unknown>): Promise<ToolResult> {
  const kind = typeof args.kind === 'string' ? args.kind : '';
  const spec = allowedSpec(ctx, appOfKind(kind));
  if (!spec)
    return appOfKind(kind) ? notAllowed(kind) : refused(`kind must be one of ${KINDS.join(', ')}.`);
  const catalogue = await ctx.catalogue(spec);
  const asked = Array.isArray(args.tools) ? args.tools.filter((t) => typeof t === 'string') : [];
  if (asked.length === 0) {
    const tools = catalogue.tools.map((t) => ({
      name: t.name,
      does: firstSentence(t.description ?? ''),
    }));
    const value = {
      kind: spec.kind,
      app: spec.app,
      tools,
      next: 'list_app_tools with tools: [names] for their input schemas, then use_app_tool.',
    };
    return { ...textResult(value), structuredContent: value };
  }
  const found = catalogue.tools.filter((t) => asked.includes(t.name));
  const unknown = asked.filter((name) => !found.some((t) => t.name === name));
  const value = {
    kind: spec.kind,
    tools: found.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    ...(unknown.length ? { unknown } : {}),
  };
  return { ...textResult(value), structuredContent: value };
}

// What a tool does, in a line: its description's first sentence after the "For a ..." opening.
export function firstSentence(description: string): string {
  const body = description.replace(/^For [^.]*\(\w+\)\.\s*/, '');
  const end = body.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? body : body.slice(0, end + 1);
  return sentence.length > 200 ? `${sentence.slice(0, 199)}…` : sentence;
}

/** Which app an editing tool's name belongs to, among the allowed apps. */
export async function appOfTool(
  ctx: CoreContext,
  name: string,
): Promise<{ spec: AppSpec; appTool: string } | null> {
  for (const spec of ctx.allowed) {
    // An app that can't be reached has no tools to find; the others are still looked through.
    const catalogue = await ctx.catalogue(spec).catch((err: unknown) => {
      if (err instanceof TokenRefused) throw err;
      return null;
    });
    const appTool = catalogue?.toApp.get(name);
    if (appTool) return { spec, appTool };
  }
  return null;
}

async function callEditingTool(
  ctx: CoreContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const name = typeof args.tool === 'string' ? args.tool : '';
  if (CORE_NAMES.has(name)) return refused(`${name} is a core tool: call it directly.`);
  const found = await appOfTool(ctx, name);
  if (!found)
    return refused(`No tool named "${name}" here. list_app_tools lists each kind’s tools.`);
  const toolArgs =
    args.arguments && typeof args.arguments === 'object'
      ? (args.arguments as Record<string, unknown>)
      : {};
  return ctx.call(found.spec, found.appTool, toolArgs);
}

/** Runs a core verb; null when the name is not one. */
export async function runCore(
  ctx: CoreContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult | null> {
  switch (name) {
    case 'find_items':
      return findItems(ctx, args);
    case 'create_item':
      return createItem(ctx, args);
    case 'list_app_tools':
      return listAppTools(ctx, args);
    case 'use_app_tool':
      return callEditingTool(ctx, args);
    case 'read_item':
    case 'share_item':
    case 'rename_item':
    case 'trash_item':
    case 'restore_item': {
      const target = byRef(ctx, args);
      if ('error' in target) return target.error!;
      const { spec, id } = target as { spec: AppSpec; id: string };
      const idArg = { [spec.idParam]: id };
      if (name === 'read_item')
        return ctx.call(spec, spec.core.read, {
          ...idArg,
          ...(typeof args.tabId === 'string' && spec.kind !== 'knowledgebase'
            ? { tabId: args.tabId }
            : {}),
        });
      if (name === 'share_item')
        return ctx.call(spec, spec.core.share, {
          ...idArg,
          ...(typeof args.role === 'string' ? { role: args.role } : {}),
          ...(typeof args.expiry === 'string' ? { expiry: args.expiry } : {}),
        });
      if (name === 'rename_item')
        return ctx.call(spec, spec.core.rename, { ...idArg, name: args.name });
      if (name === 'trash_item') return ctx.call(spec, spec.core.trash, idArg);
      return ctx.call(spec, spec.core.restore, idArg);
    }
    default:
      return null;
  }
}

export { APPS };
