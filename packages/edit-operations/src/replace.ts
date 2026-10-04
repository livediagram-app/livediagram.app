// `applyReplace` (docs/specs/024-agents/blueprints/edit-operations.md "Replace"): the other changeset
// body, a whole tab from a graph, Mermaid, a template or raw elements, built exactly as the MCP's
// `update_document` replace and `add_tab` build it, and answered with the same outcome as operations.
// An existing tab keeps every tab field and swaps its elements (no theme repaint, EO41); a new tab is
// built whole.

import type { EditRejection } from '@livediagram/api-schema';
import {
  applyLayout,
  buildGraphTab,
  buildTab,
  coerceShapeKind,
  diffToElementOps,
  elementValidationIssue,
  getBuiltInTheme,
  invertElementOps,
  isValidTab,
  landWorkshopArrivals,
  layoutGraph,
  normaliseElements,
  resolveGraphInput,
  type Element,
  type GraphInput,
  type Tab,
} from '@livediagram/document';
import { buildTemplateTab, resolveTemplate, validTemplateKinds } from '@livediagram/templates';
import { tabRejection } from './finalise';
import { graphBodyIssue } from './graph-body';
import { invalidResult, tabLocked } from './rejections';
import { addedLine, removedLine } from './results';
import type { ApplyOutcome, EditLog, ReplaceBody, ReplaceOptions } from './types';

type Source = 'graph' | 'mermaid' | 'template' | 'elements';
const SOURCES: readonly Source[] = ['graph', 'mermaid', 'template', 'elements'];

// What one source builds: the new elements, and for a tab that does not exist yet, the whole tab.
type Built = { elements: Element[]; tab: (tabId: string, name: string) => Tab } | EditRejection;

const invalidBody = (detail: string, hint?: string): EditRejection => ({
  code: 'invalid_value',
  details: [detail],
  ...(hint ? { hint } : {}),
});

function fromGraph(graph: GraphInput, themeId: string | undefined): Built {
  return {
    elements: layoutGraph(graph),
    tab: (tabId, name) => buildGraphTab(tabId, name, graph, themeId),
  };
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
    elements: applyLayout(layout, coerced),
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
  if (!tab) return built.tab(options.tabId, options.name);
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
  const next = nextTab(tab, built, options);
  if (!isValidTab(next)) return refuse(tabRejection(next));
  log('[edit-ops] replace', { source, elements: next.elements.length });
  const before = tab?.elements ?? [];
  const elementOps = diffToElementOps(before, next.elements);
  const kept = new Set(next.elements.map((el) => el.id));
  const had = new Set(before.map((el) => el.id));
  const createdIds = next.elements.filter((el) => !had.has(el.id)).map((el) => el.id);
  return {
    tab: next,
    results: [
      ...next.elements.filter((el) => !had.has(el.id)).map((el) => addedLine(el)),
      ...before.filter((el) => !kept.has(el.id)).map((el) => removedLine(el)),
    ],
    elementOps,
    inverse: invertElementOps(before, elementOps),
    warnings: [],
    targets: [],
    createdIds,
  };
}
