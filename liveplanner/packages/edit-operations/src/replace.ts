// `applyReplace` (docs/specs/024-agents/blueprints/edit-operations.md "Replace"): the other changeset
// body, a whole tab from a template, a dashboard, a form or a Plan tab's elements, built exactly as the MCP's
// `update_project` replace and `add_tab` build it, and answered with the same outcome as operations.
// An existing tab keeps every tab field and swaps its elements (no theme repaint, EO41); a new tab is
// built whole.

import type { EditRejection } from '@liveplanner/api-schema';
import {
  buildTab,
  contentOrigin,
  diffToElementOps,
  elementValidationIssue,
  getBuiltInTheme,
  invertElementOps,
  isValidTab,
  normaliseElements,
  tabKindOf,
  type Element,
  type Tab,
} from '@liveplanner/project';
import {
  buildDashboardTab,
  buildTemplateTab,
  closestTemplatesHint,
  isTemplateKind,
  resolveTemplate,
  validTemplateKinds,
} from '@liveplanner/templates';
import { readForm, type FormDefinition } from '@liveplanner/forms';
import { dashboardSpecIssue } from './dashboard-body';
import { tabRejection } from './finalise';
import { PLAN_KINDS_HINT, planElementIssue } from './plan-elements';
import { invalidResult, tabLocked } from './rejections';
import { addedLine, lineNaming, removedLine } from './results';
import type { ApplyOutcome, EditLog, ReplaceBody, ReplaceOptions } from './types';
import type { DashboardSpec } from '@liveplanner/templates';

type Source = 'template' | 'dashboard' | 'form' | 'elements';
const SOURCES: readonly Source[] = ['template', 'dashboard', 'form', 'elements'];

// What one source builds: the new elements, and for a tab that does not exist yet, the whole tab.
// `newOnly`: the source makes a tab of its own kind (a Dashboard): a new tab, or that kind's own tab rebuilt.
// `formOnly`: a new Form tab (blueprint forms.md §15); an existing one's form changes through its form route.
type Built =
  | {
      elements: Element[];
      tab: (tabId: string, name: string) => Tab;
      newOnly?: true;
      formOnly?: true;
    }
  | EditRejection;

// A new Form tab holding `form`, named by its heading (the tab and its form share one name), always in Plan.
function formTab(tabId: string, form: FormDefinition, themeId: string | undefined): Tab {
  return {
    id: tabId,
    name: form.heading,
    elements: [],
    defaultTextSize: 'sm',
    kind: 'form',
    form,
    ...(themeId ? { theme: themeId } : {}),
  };
}

const invalidBody = (detail: string, hint?: string): EditRejection => ({
  code: 'invalid_value',
  details: [detail],
  ...(hint ? { hint } : {}),
});

// Only elements a Plan tab holds, kept where they are given (docs/specs/024-agents/edit-operations.md "Replace a
// whole tab").
function fromElements(raw: unknown, themeId: string | undefined, kept: ReadonlySet<string>): Built {
  if (!Array.isArray(raw)) return invalidBody('elements: expected an array of elements');
  for (const el of raw as unknown[]) {
    const issue = planElementIssue(
      typeof el === 'object' && el !== null ? (el as Record<string, unknown>) : {},
    );
    if (issue) return invalidBody(`elements: ${issue}`, PLAN_KINDS_HINT);
  }
  // Elements the tab already holds keep their own look; only new ones take a raw element's defaults.
  const normalised = normaliseElements(raw, { kept }) as unknown[];
  for (const el of normalised) {
    const issue = elementValidationIssue(el);
    if (issue) {
      // Every element passed planElementIssue above, so each is a Plan shape with its kind.
      const subject = el as { id?: unknown; shape: string };
      const ref = typeof subject.id === 'string' && subject.id !== '' ? subject.id : 'an element';
      return invalidResult(ref, subject.shape, issue);
    }
  }
  const valid = normalised as Element[];
  return {
    elements: buildTab('elements', 'elements', valid, 'preserve', themeId).elements,
    tab: (tabId, name) => buildTab(tabId, name, valid, 'preserve', themeId),
  };
}

function build(
  body: ReplaceBody,
  source: Source,
  themeId: string | undefined,
  // The ids the tab already holds.
  kept: ReadonlySet<string> = new Set(),
): Built {
  switch (source) {
    case 'template': {
      const { template } = body as { template: unknown };
      const kind = typeof template === 'string' ? resolveTemplate(template) : null;
      if (!kind)
        return invalidBody(
          `template=${JSON.stringify(template)}: ${typeof template === 'string' && isTemplateKind(template) ? 'made in the editor only' : 'not a template'}`,
          `${typeof template === 'string' ? closestTemplatesHint(template) : ''}templates: ${validTemplateKinds()}`,
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
    case 'form': {
      const form = readForm((body as { form: unknown }).form);
      if (!form) return invalidBody('form: not a form (a heading and sections of questions)');
      return { elements: [], tab: (tabId) => formTab(tabId, form, themeId), formOnly: true };
    }
    case 'elements': {
      const { elements } = body as { elements: unknown };
      return fromElements(elements, themeId, kept);
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
    const kinded: Tab = options.kind ? { ...made, kind: options.kind } : made;
    return options.finish ? { ...kinded, finish: options.finish } : kinded;
  }
  if (built.newOnly) {
    // A Dashboard tab rebuilt: its views and layout anew, everything else about the tab kept.
    const made = built.tab(tab.id, tab.name);
    return { ...tab, elements: made.elements, dashboard: made.dashboard };
  }
  return { ...tab, elements: built.elements };
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
  const built = build(body, source, themeId, new Set(tab?.elements.map((el) => el.id) ?? []));
  if ('code' in built) return refuse(built);
  // A Dashboard is rebuilt in place on a Dashboard tab (its id, name and theme kept); onto any other tab it is refused.
  if (tab && built.newOnly && tabKindOf(tab) !== 'dashboard')
    return refuse(
      invalidBody(
        'dashboard: only a Dashboard tab is rebuilt as one',
        'add a new Dashboard with add_tab, or in create_project',
      ),
    );
  // A changeset writes and relays elements, so a form lands as a new tab; a Form tab's form changes through its route.
  if (tab && built.formOnly)
    return refuse(
      invalidBody(
        'form: a changeset makes a new Form tab; an existing form changes through its form route',
        'change it with change_form',
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
