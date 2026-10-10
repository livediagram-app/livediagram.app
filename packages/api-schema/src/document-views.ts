// Document views (docs/specs/024-agents/document-views.md): the view names, the query the api's two
// doors take, and every view's JSON form, shared by the api, the MCP, the CLI and
// `@livediagram/document-views` (docs/specs/024-agents/blueprints/document-views.md, VW49).
import type { TabKind } from '@livediagram/document';

// Every view. `lint` is answered by `@livediagram/diagram-lint` (docs/specs/024-agents/diagram-lint.md), not
// by `renderView`; it takes only `json`.
export const VIEW_NAMES = [
  'overview',
  'outline',
  'graph',
  'layout',
  'comments',
  'show',
  'find',
  'diff',
  'lint',
] as const;
export const LINT_VIEW_NAME = 'lint' satisfies ViewName;
export type ViewName = (typeof VIEW_NAMES)[number];

// What each api door serves. `diff` has no api door: the CLI computes it from its cache.
export const DOCUMENT_VIEW_NAMES = ['overview'] as const satisfies readonly ViewName[];
export const TAB_VIEW_NAMES = [
  'outline',
  'graph',
  'layout',
  'comments',
  'show',
  'find',
] as const satisfies readonly ViewName[];
export type DocumentViewName = (typeof DOCUMENT_VIEW_NAMES)[number];
export type TabViewName = (typeof TAB_VIEW_NAMES)[number];

// The front door a view is read through; it chooses the elision command's syntax (VW54, VW57).
export const VIEW_DOORS = ['cli', 'mcp'] as const;
export type ViewDoor = (typeof VIEW_DOORS)[number];

// The query parameters of both doors (VW42).
export const VIEW_QUERY = {
  view: 'view',
  json: 'json',
  budget: 'budget',
  only: 'only',
  coarse: 'coarse',
  style: 'style',
  ref: 'ref',
  q: 'q',
  all: 'all',
  door: 'door',
} as const;
export type ViewQueryParameter = keyof typeof VIEW_QUERY;

// The parameters each api-served view takes; anything else is `invalid_value` (VW43).
const COMMON_PARAMETERS = [
  'view',
  'json',
  'budget',
  'door',
] as const satisfies readonly ViewQueryParameter[];
export const VIEW_PARAMETERS: Readonly<
  Record<DocumentViewName | TabViewName, readonly ViewQueryParameter[]>
> = {
  overview: COMMON_PARAMETERS,
  outline: [...COMMON_PARAMETERS, 'only', 'style'],
  graph: COMMON_PARAMETERS,
  layout: [...COMMON_PARAMETERS, 'only', 'coarse'],
  comments: [...COMMON_PARAMETERS, 'all'],
  show: [...COMMON_PARAMETERS, 'ref'],
  find: [...COMMON_PARAMETERS, 'q'],
};
// Required on top of `view`.
export const VIEW_REQUIRED: Readonly<Partial<Record<TabViewName, ViewQueryParameter>>> = {
  show: 'ref',
  find: 'q',
};

// The bounds the api holds view queries to (VW53).
// Above a full 10,000-element outline.
export const VIEW_BUDGET_MAX = 1_000_000;
// Above any stored id in practice.
export const REF_INPUT_MAX_LENGTH = 256;
// A phrase, not a document.
export const FIND_QUERY_MAX_LENGTH = 200;

export const UNKNOWN_VIEW_ERROR = 'unknown_view';
export const INVALID_VIEW_VALUE_ERROR = 'invalid_value';

// ---------------------------------------------------------------------
// JSON forms (`json=1`): the same model as the text, strings uncut (VW46)
// ---------------------------------------------------------------------

export type ViewHeader = {
  view: ViewName;
  tab: { id: string; ref: string; name: string; kind: TabKind };
  elements: number;
  counts: { boxes: number; frames: number; lanes: number; arrows: number };
  hidden: number;
  unknown: number;
  threads: { open: number; total: number };
  rev: number | null;
};

export type ViewEnd = { ref: string } | { arrow: string } | { free: { x: number; y: number } };

export type ViewEdgeJson = {
  ref: string;
  id: string;
  from: ViewEnd;
  to: ViewEnd;
  label: string | null;
  style: string[];
};

export type ViewAttributeJson = { key: string; value: string | null };

export type FreehandRunJson = { run: 'freehand'; refs: string[]; closed: number };

export type OutlineNode = {
  ref: string;
  id: string;
  kind: string;
  unknown: boolean;
  label: string | null;
  summary: string | null;
  attributes: ViewAttributeJson[];
  edges: ViewEdgeJson[];
  children: (OutlineNode | FreehandRunJson)[];
  // Descendants a budget left out of `children`.
  collapsed: number;
};

export type Elision = {
  dropped: ('notes' | 'attributes')[];
  collapsed: { ref: string; kind: string; elements: number }[];
  omitted: { noun: string; count: number }[];
  arguments: Record<string, string | number | boolean>;
  command: string;
} | null;

export type OutlineView = {
  header: ViewHeader;
  nodes: (OutlineNode | FreehandRunJson)[];
  ownLineArrows: ViewEdgeJson[];
  elision: Elision;
};

export type GraphView = {
  header: ViewHeader;
  nodes: { ref: string; id: string; kind: string; label: string | null }[];
  arrows: ViewEdgeJson[];
  elision: Elision;
};

export type LayoutView = {
  header: ViewHeader;
  origin: { x: number; y: number };
  boxes: { ref: string; x: number; y: number; w: number; h: number; r: number }[];
  arrows: { ref: string; from: string; to: string; style: string }[];
  rows: { container: string | null; rows: string[][] }[] | null;
  elision: Elision;
};

export type CommentsView = {
  header: ViewHeader;
  threads: {
    ref: string;
    kind: string;
    label: string | null;
    resolved: boolean;
    comments: { authorName: string; createdAt: number; text: string }[];
  }[];
  elision: Elision;
};

export type ShowView = {
  header: ViewHeader;
  ref: string;
  kind: string;
  container: { ref: string; kind: string; label: string | null } | null;
  fields: Record<string, unknown>;
  incoming: ViewEdgeJson[];
  outgoing: ViewEdgeJson[];
  omitted: string[];
};

// `show` with `ref=selected`: each element as ShowView holds it, in tab order (VW67).
export type ShowSelectedView = { header: ViewHeader; selected: Omit<ShowView, 'header'>[] };

export const FIND_FIELDS = [
  'label',
  'note',
  'edge',
  'cell',
  'field',
  'item',
  'code',
  'comment',
] as const;
export type FindField = (typeof FIND_FIELDS)[number];

export type FindView = {
  header: ViewHeader;
  q: string;
  matches: { ref: string; kind: string; label: string | null; field: FindField; path: string[] }[];
  elision: Elision;
};

// No api door serves it; the CLI's `--json` prints it.
export type DiffView = {
  header: ViewHeader;
  since: number;
  changes: {
    op: '+' | '-' | '~';
    ref: string;
    kind: string;
    label: string | null;
    changes: { field: string; before: unknown; after: unknown }[];
  }[];
  elision: Elision;
};

export type OverviewTab = { outOfScope: true; ref: string } | (ViewHeader & { outOfScope: false });

export type OverviewView = {
  document: { id: string; name: string; savedAt: number; tabs: number };
  tabs: OverviewTab[];
  elision: Elision;
};

export function isTabViewName(value: string): value is TabViewName {
  return TAB_VIEW_NAMES.some((name) => name === value);
}

export function isViewDoor(value: string): value is ViewDoor {
  return VIEW_DOORS.some((door) => door === value);
}
