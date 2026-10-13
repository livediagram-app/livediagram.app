// `applyReplace` (docs/specs/024-agents/blueprints/edit-operations.md "Replace"): the other changeset
// body, a whole tab from a graph, Mermaid, a template or raw elements, built exactly as the MCP's
// `update_document` replace and `add_tab` build it, and answered with the same outcome as operations.
// An existing tab keeps every tab field and swaps its elements (no theme repaint, EO41); a new tab is
// built whole.

import type { EditRejection } from '@livediagram/api-schema';
import {
  buildGraphTab,
  buildTab,
  coerceShapeKind,
  contentOrigin,
  diffToElementOps,
  elementValidationIssue,
  getBuiltInTheme,
  invertElementOps,
  isValidTab,
  landWorkshopArrivals,
  normaliseElements,
  resolveGraphInput,
  tabKindOf,
  type Element,
  type GraphInput,
  type Tab,
} from '@livediagram/document';
import {
  buildDashboardTab,
  buildTemplateTab,
  resolveTemplate,
  validTemplateKinds,
} from '@livediagram/templates';
import { dashboardSpecIssue } from './dashboard-body';
import { tabRejection } from './finalise';
import { graphBodyIssue } from './graph-body';
import { invalidResult, tabLocked } from './rejections';
import { addedLine, lineNaming, removedLine } from './results';
import type { ApplyOutcome, EditLog, ReplaceBody, ReplaceOptions } from './types';
import type { DashboardSpec } from '@livediagram/templates';

type Source = 'graph' | 'mermaid' | 'template' | 'dashboard' | 'elements';
const SOURCES: readonly Source[] = ['graph', 'mermaid', 'template', 'dashboard', 'elements'];

// What one source builds: the new elements, and for a tab that does not exist yet, the whole tab.
// `newOnly`: the source makes a tab of its own kind (a Dashboard): a new tab, or that kind's own tab rebuilt.
type Built =
  | { elements: Element[]; tab: (tabId: string, name: string) => Tab; newOnly?: true }
  | EditRejection;

const invalidBody = (detail: string, hint?: string): EditRejection => ({
  code: 'invalid_value',
  details: [detail],
  ...(hint ? { hint } : {}),
});

// The elements a replace writes onto an existing tab are built exactly as a new tab's are, themed included: a
// graph's tones and a template's presets are colour presets the theme resolves, and an existing tab took them
// unresolved, so a replace drew every toned node plain.
function fromGraph(graph: GraphInput, themeId: string | undefined): Built {
  const tab = (tabId: string, name: string) => buildGraphTab(tabId, name, graph, themeId);
  return { elements: tab('graph', 'graph').elements, tab };
}

function fromElements(
  raw: unknown,
  layout: 'auto' | 'preserve' | undefined,
  themeId?: string,
): Built {
  if (!Array.isArray(raw)) return invalidBody('elements: expected an array of elements');
  const normalised = normaliseElements(raw) as unknown[];
  for (const el of normalised) {
    const issue = elementValidationIssue(el);
    if (issue) {
      const subject = el as { id?: unknown; type?: unknown; shape?: unknown };
      const ref = typeof subject.id === 'string' && subject.id !== '' ? subject.id : 'an element';
      return invalidResult(ref, typeof subject.type === 'string' ? subject.type : undefined, issue);
    }
  }
  const valid = normalised as Element[];
  const coerced = valid.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  return {
    elements: buildTab('elements', 'elements', coerced, layout, themeId).elements,
    tab: (tabId, name) => buildTab(tabId, name, valid, layout, themeId),
  };
}

function build(body: ReplaceBody, source: Source, themeId: string | undefined): Built {
  switch (source) {
    case 'graph': {
      const { graph } = body as { graph: unknown };
      const issue = graphBodyIssue(graph);
      return issue ? invalidBody(issue) : fromGraph(graph as GraphInput, themeId);
    }
    case 'mermaid': {
      const { mermaid } = body as { mermaid: unknown };
      if (typeof mermaid !== 'string') return invalidBody('mermaid: expected a string');
      const resolved = resolveGraphInput({ mermaid });
      return resolved.graph
        ? fromGraph(resolved.graph, themeId)
        : { code: 'parse_error', details: [resolved.error!] };
    }
    case 'template': {
      const { template } = body as { template: unknown };
      const kind = typeof template === 'string' ? resolveTemplate(template) : null;
      if (!kind)
        return invalidBody(
          `template=${JSON.stringify(template)}: not a template`,
          `templates: ${validTemplateKinds()}`,
        );
      const tabOf = (tabId: string, name: string) => buildTemplateTab(tabId, name, kind, themeId);
      return { elements: tabOf('template', 'template').elements, tab: tabOf };
    }
    case 'dashboard': {
      const { dashboard } = body as { dashboard: unknown };
      const issue = dashboardSpecIssue(dashboard);
      if (issue) return invalidBody(issue);
      const tabOf = (tabId: string, name: string) =>
        buildDashboardTab(tabId, name, dashboard as DashboardSpec, themeId).tab;
      return { elements: [], tab: tabOf, newOnly: true };
    }
    case 'elements': {
      const { elements, layout } = body as { elements: unknown; layout?: 'auto' | 'preserve' };
      return fromElements(elements, layout, themeId);
    }
  }
}

function sourceOf(body: ReplaceBody): Source | EditRejection {
  const given = SOURCES.filter((source) => source in body);
  return given.length === 1
    ? given[0]!
    : invalidBody(`replace takes exactly one of ${SOURCES.join(', ')}`);
}

const isBuiltInTheme = (id: string) => getBuiltInTheme(id).id === id;

function nextTab(
  tab: Tab | null,
  built: Exclude<Built, EditRejection>,
  options: ReplaceOptions,
): Tab {
  if (!tab) {
    const made = built.tab(options.tabId, options.name);
    return options.finish ? { ...made, finish: options.finish } : made;
  }
  if (built.newOnly) {
    // A Dashboard tab rebuilt: its views and layout anew, everything else about the tab kept.
    const made = built.tab(tab.id, tab.name);
    const { dashboard: _old, ...rest } = tab;
    return {
      ...rest,
      elements: made.elements,
      ...(made.dashboard ? { dashboard: made.dashboard } : {}),
    };
  }
  return { ...tab, elements: landWorkshopArrivals(tab, built.elements, 'replace') };
}

export function applyReplace(
  tab: Tab | null,
  body: ReplaceBody,
  options: ReplaceOptions,
): ApplyOutcome {
  const log: EditLog = options.log ?? (() => {});
  const refuse = (rejection: EditRejection): ApplyOutcome => {
    log('[edit-ops] rejected', { code: rejection.code, operation: 0, op: 'replace' });
    return { errors: [rejection] };
  };
  if (tab?.locked) {
    log('[edit-ops] locked', { operation: 0, op: 'replace', scope: 'tab' });
    return refuse(tabLocked());
  }
  const source = sourceOf(body);
  if (typeof source !== 'string') return refuse(source);
  const themeId = options.themeId ?? options.theme?.id ?? tab?.theme;
  if (themeId !== undefined && !isBuiltInTheme(themeId)) log('[edit-ops] theme-fallback', {});
  const built = build(body, source, themeId);
  if ('code' in built) return refuse(built);
  // A Dashboard is rebuilt in place on a Dashboard tab (its id, name and theme kept); onto any other tab it is refused.
  if (tab && built.newOnly && tabKindOf(tab) !== 'dashboard')
    return refuse(
      invalidBody(
        'dashboard: only a Dashboard tab is rebuilt as one',
        'add a new Dashboard with add_tab, or in create_document',
      ),
    );
  const next = nextTab(tab, built, options);
  if (!isValidTab(next)) return refuse(tabRejection(next));
  log('[edit-ops] replace', { source, elements: next.elements.length });
  const before = tab?.elements ?? [];
  const elementOps = diffToElementOps(before, next.elements);
  const kept = new Set(next.elements.map((el) => el.id));
  const had = new Set(before.map((el) => el.id));
  const createdIds = next.elements.filter((el) => !had.has(el.id)).map((el) => el.id);
  // Refs as the next tab prints them; the origin the reader of the old tab had, or the new one's.
  const naming = lineNaming(before, next.elements, contentOrigin(tab ? before : next.elements));
  return {
    tab: next,
    results: [
      ...next.elements.filter((el) => !had.has(el.id)).map((el) => addedLine(el, naming)),
      ...before.filter((el) => !kept.has(el.id)).map((el) => removedLine(el, naming)),
    ],
    elementOps,
    inverse: invertElementOps(before, elementOps),
    warnings: [],
    targets: [],
    createdIds,
  };
}
