// The apps behind the one MCP (liveworkspace/docs/specs/021-mcp/mcp.md): each app's kind, its MCP Worker's binding,
// the tools the core verbs map to and how its tools are renamed. livehuddle has no MCP, so it is not here.

export type AppId =
  'livediagram' | 'livedocuments' | 'liveplanner' | 'livedesign' | 'liveknowledge';

/** What `<kind>:<id>` refs name, one per app. */
export type Kind = 'diagram' | 'doc' | 'plan' | 'design' | 'knowledgebase';

export type Binding =
  'LIVEDIAGRAM' | 'LIVEDOCUMENTS' | 'LIVEPLANNER' | 'LIVEDESIGN' | 'LIVEKNOWLEDGE';

export type AppSpec = {
  app: AppId;
  kind: Kind;
  binding: Binding;
  // How a description opens: "For a diagram (livediagram)."
  nounPhrase: string;
  // The app's own word for its item in tool names (`create_document`, `create_project`).
  itemWord: 'document' | 'project' | 'design';
  // What that word becomes (`create_diagram`, `create_plan`, `find_knowledgebases`).
  itemNoun: string;
  // Put after the verb of a name with no subject of its own (`add_tab` is `add_diagram_tab`).
  insertNoun: string;
  // The id argument every one of its item tools takes.
  idParam: 'documentId' | 'projectId' | 'designId';
  // The app's own tools the core verbs call.
  core: {
    find: string;
    read: string;
    create: string;
    share: string;
    rename: string;
    trash: string;
    restore: string;
    listTrash: string;
    // Its theme and look at any time (style_item).
    style: string;
  };
  // Names that read better by hand than by the rules.
  overrides: Readonly<Record<string, string>>;
};

const docTools = {
  find: 'find_documents',
  read: 'read_document',
  create: 'create_document',
  share: 'share_document',
  rename: 'rename_document',
  trash: 'delete_document',
  restore: 'restore_document',
  listTrash: 'list_trash',
  style: 'style_document',
};

export const APPS: readonly AppSpec[] = [
  {
    app: 'livediagram',
    kind: 'diagram',
    binding: 'LIVEDIAGRAM',
    nounPhrase: 'a diagram',
    itemWord: 'document',
    itemNoun: 'diagram',
    insertNoun: 'diagram',
    idParam: 'documentId',
    core: docTools,
    overrides: {},
  },
  {
    app: 'livedocuments',
    kind: 'doc',
    binding: 'LIVEDOCUMENTS',
    nounPhrase: 'a doc: a slide deck, an article or an infographic',
    itemWord: 'document',
    itemNoun: 'doc',
    insertNoun: 'doc',
    idParam: 'documentId',
    core: docTools,
    overrides: {},
  },
  {
    app: 'liveplanner',
    kind: 'plan',
    binding: 'LIVEPLANNER',
    nounPhrase: 'a plan: boards of cards, sheets, forms and dashboards',
    itemWord: 'project',
    itemNoun: 'plan',
    insertNoun: 'plan',
    idParam: 'projectId',
    core: {
      find: 'find_projects',
      read: 'read_project',
      create: 'create_project',
      share: 'share_project',
      rename: 'rename_project',
      trash: 'delete_project',
      restore: 'restore_project',
      listTrash: 'list_trash',
      style: 'style_project',
    },
    overrides: { change_items: 'change_cards', list_items: 'list_cards' },
  },
  {
    app: 'livedesign',
    kind: 'design',
    binding: 'LIVEDESIGN',
    nounPhrase: 'a design: logos, social posts, mockups and other visual designs',
    itemWord: 'design',
    itemNoun: 'design',
    insertNoun: 'design',
    idParam: 'designId',
    core: {
      find: 'find_designs',
      read: 'read_design',
      create: 'create_design',
      share: 'share_design',
      rename: 'rename_design',
      trash: 'delete_design',
      restore: 'restore_design',
      listTrash: 'list_trash',
      style: 'style_design',
    },
    overrides: {},
  },
  {
    app: 'liveknowledge',
    kind: 'knowledgebase',
    binding: 'LIVEKNOWLEDGE',
    nounPhrase: 'a knowledgebase: a team wiki of pages',
    itemWord: 'document',
    itemNoun: 'knowledgebase',
    insertNoun: 'knowledge',
    idParam: 'documentId',
    // A knowledgebase is read by its page tree; its pages have their own tools.
    core: { ...docTools, read: 'list_pages' },
    overrides: {
      get_context: 'get_knowledge_context',
      report_gap: 'report_knowledge_gap',
      suggest_edit: 'suggest_knowledge_edit',
      request_approval: 'request_knowledge_approval',
    },
  },
];

export const KINDS: readonly Kind[] = APPS.map((a) => a.kind);

export function appOfKind(kind: string): AppSpec | null {
  return APPS.find((a) => a.kind === kind) ?? null;
}

export function appById(app: string): AppSpec | null {
  return APPS.find((a) => a.app === app) ?? null;
}

/** What `create_item` makes: each kind, plus livedocuments' three, each started from its blank template. */
export const CREATE_KINDS: Readonly<Record<string, { kind: Kind; template?: string }>> = {
  diagram: { kind: 'diagram' },
  deck: { kind: 'doc', template: 'blank-slide-deck' },
  article: { kind: 'doc', template: 'blank-article' },
  infographic: { kind: 'doc', template: 'blank-infographic' },
  plan: { kind: 'plan', template: 'kanban' },
  design: { kind: 'design' },
  knowledgebase: { kind: 'knowledgebase' },
};

/** `<kind>:<id>` into its app and id, or null when it is not one. */
export function parseRef(ref: unknown): { spec: AppSpec; id: string } | null {
  if (typeof ref !== 'string') return null;
  const at = ref.indexOf(':');
  if (at <= 0) return null;
  const spec = appOfKind(ref.slice(0, at));
  const id = ref.slice(at + 1).trim();
  return spec && id ? { spec, id } : null;
}

export function refOf(spec: AppSpec, id: string): string {
  return `${spec.kind}:${id}`;
}
