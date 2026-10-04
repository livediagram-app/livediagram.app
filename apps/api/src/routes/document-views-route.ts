// Document views over REST (docs/specs/024-agents/document-views.md "Where views are made";
// blueprint "REST"): `?view=` on the tab GET and on the document GET, answered after the same gate and
// redaction as the plain read, as text or (`json=1`) as JSON.
import {
  DOCUMENT_VIEW_NAMES,
  INVALID_VIEW_VALUE_ERROR,
  isTabViewName,
  isViewDoor,
  tabEtag,
  TAB_VIEW_NAMES,
  UNKNOWN_VIEW_ERROR,
  VIEW_PARAMETERS,
  VIEW_QUERY,
  VIEW_REQUIRED,
  type DocumentViewName,
  type TabViewName,
  type ViewDoor,
  type ViewQueryParameter,
} from '@livediagram/api-schema';
import { isKnownElement } from '@livediagram/document';
import {
  FIND_QUERY_MAX_LENGTH,
  headerFactsOf,
  OVERVIEW_TAB_BATCH,
  overviewView,
  REF_INPUT_MAX_LENGTH,
  renderView,
  VIEW_BUDGET_MAX,
  VIEW_SLOW_MS,
  type OverviewTabInput,
  type ViewRequest,
} from '@livediagram/document-views';
import { getTab, tabBodiesInOrder } from '../db/tabs';
import { json, textPlain } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import type { DocumentDTO, Env, TabDTO } from '../types';
import type { RouteContext } from './context';

export type ParsedView = { request: ViewRequest; json: boolean };

type Scope = 'tab' | 'document';

const FLAG_PARAMETERS: ReadonlySet<string> = new Set(['json', 'coarse', 'style', 'all']);
const QUERY_PARAMETERS: ReadonlySet<string> = new Set(Object.keys(VIEW_QUERY));

function viewsLog(
  level: 'info' | 'warn',
  fingerprint: string,
  fields: Record<string, unknown>,
): void {
  if (level === 'warn') console.warn(fingerprint, fields);
  else console.info(fingerprint, fields);
}

function refuse(parameter: string, error: string, message: string): Response {
  viewsLog('info', '[views] invalid request', { parameter, error });
  return json({ error, message }, { status: 400 });
}

function unknownView(view: string, scope: Scope): Response {
  const names = scope === 'tab' ? TAB_VIEW_NAMES : DOCUMENT_VIEW_NAMES;
  const message =
    view === 'diff'
      ? 'diff is computed by the CLI: livediagram tab diff'
      : view === 'lint'
        ? 'the lint view arrives with the diagram lint'
        : `view takes ${names.join(', ')} here`;
  return refuse('view', UNKNOWN_VIEW_ERROR, message);
}

// The view a request asks for, a 400 naming what is wrong, or null for the plain read.
export function parseViewQuery(url: URL, scope: Scope): ParsedView | Response | null {
  const query = url.searchParams;
  const view = query.get(VIEW_QUERY.view);
  if (view === null) return null;
  const tabView = isTabViewName(view);
  if (scope === 'tab' ? !tabView : view !== 'overview') return unknownView(view, scope);
  const name = tabView ? view : 'overview';
  const allowed = VIEW_PARAMETERS[name];
  for (const parameter of new Set(query.keys())) {
    if (!QUERY_PARAMETERS.has(parameter) || !allowed.some((p) => p === parameter)) {
      return refuse(
        parameter,
        INVALID_VIEW_VALUE_ERROR,
        `${parameter} does not apply to view ${name}`,
      );
    }
    if (FLAG_PARAMETERS.has(parameter) && query.get(parameter) !== '1') {
      return refuse(parameter, INVALID_VIEW_VALUE_ERROR, `${parameter} takes 1`);
    }
  }
  const budgetText = query.get(VIEW_QUERY.budget);
  const budget = budgetText === null ? undefined : Number(budgetText);
  if (
    budget !== undefined &&
    !(Number.isInteger(budget) && budget >= 1 && budget <= VIEW_BUDGET_MAX)
  ) {
    return refuse(
      'budget',
      INVALID_VIEW_VALUE_ERROR,
      `budget takes a whole number from 1 to ${VIEW_BUDGET_MAX}`,
    );
  }
  const doorText = query.get(VIEW_QUERY.door) ?? 'cli';
  if (!isViewDoor(doorText))
    return refuse('door', INVALID_VIEW_VALUE_ERROR, 'door takes cli or mcp');
  const door: ViewDoor = doorText;
  for (const parameter of [VIEW_QUERY.only, VIEW_QUERY.ref] as const) {
    const value = query.get(parameter);
    if (value !== null && (value === '' || value.length > REF_INPUT_MAX_LENGTH)) {
      return refuse(
        parameter,
        INVALID_VIEW_VALUE_ERROR,
        `${parameter} takes a ref of 1 to ${REF_INPUT_MAX_LENGTH} characters`,
      );
    }
  }
  const q = query.get(VIEW_QUERY.q);
  if (q !== null && (q === '' || Array.from(q).length > FIND_QUERY_MAX_LENGTH)) {
    return refuse(
      'q',
      INVALID_VIEW_VALUE_ERROR,
      `q takes 1 to ${FIND_QUERY_MAX_LENGTH} characters`,
    );
  }
  const required = tabView ? VIEW_REQUIRED[view] : undefined;
  if (required !== undefined && query.get(required) === null) {
    return refuse(required, INVALID_VIEW_VALUE_ERROR, `view ${name} needs ${required}`);
  }
  const flag = (p: ViewQueryParameter) => (query.get(p) === '1' ? true : undefined);
  const request: ViewRequest = {
    // An overview request rides the same shape; answerOverview reads only its budget and door.
    view: tabView ? view : 'outline',
    budget,
    door,
    only: query.get(VIEW_QUERY.only) ?? undefined,
    ref: query.get(VIEW_QUERY.ref) ?? undefined,
    q: q ?? undefined,
    coarse: flag('coarse'),
    style: flag('style'),
    all: flag('all'),
  };
  return { request, json: flag('json') === true };
}

const TITLE_CASE: Record<DocumentViewName | TabViewName, string> = {
  overview: 'Overview',
  outline: 'Outline',
  graph: 'Graph',
  layout: 'Layout',
  comments: 'Comments',
  show: 'Show',
  find: 'Find',
};

function countViewed(ctx: RouteContext, view: DocumentViewName | TabViewName): void {
  const { env } = ctx;
  ctx.waitUntil?.(reportServerEvent(env, 'Agent', 'Viewed', TITLE_CASE[view]));
}

function logUnknownKinds(tab: TabDTO): void {
  const unknown = new Map<string, number>();
  for (const el of tab.elements) {
    if (isKnownElement(el)) continue;
    const name =
      el.type === 'shape' ? `shape:${String(Reflect.get(el, 'shape'))}` : String(el.type);
    unknown.set(name, (unknown.get(name) ?? 0) + 1);
  }
  if (unknown.size > 0)
    viewsLog('info', '[views] unknown kinds', { tab: tab.id, ...Object.fromEntries(unknown) });
}

// A tab view, after the tab GET's gate and redaction.
export function answerTabView(
  ctx: RouteContext,
  parsed: ParsedView,
  document: DocumentDTO,
  tab: TabDTO,
): Response {
  const started = Date.now();
  const rendered = renderView(parsed.request, tab, {
    rev: tab.rev,
    tabIds: document.tabs.map((t) => t.id),
  });
  if (!rendered.ok) {
    const { refusal } = rendered;
    if (refusal.error === INVALID_VIEW_VALUE_ERROR) {
      return refuse('only', INVALID_VIEW_VALUE_ERROR, refusal.message);
    }
    viewsLog('info', '[views] ref refused', {
      error: refusal.error,
      stale: refusal.stale,
      candidates: refusal.candidates.length,
    });
    return json(refusal, { status: refusal.error === 'target_not_found' ? 404 : 400 });
  }
  const ms = Date.now() - started;
  const fields = {
    doc: document.id,
    tab: tab.id,
    elements: rendered.elements,
    chars: rendered.text.length,
    ms,
  };
  viewsLog('info', `[views] rendered ${rendered.view}`, fields);
  if (parsed.request.budget !== undefined && rendered.fit.state !== 'full') {
    viewsLog('info', `[views] budget ${rendered.view}`, {
      budget: parsed.request.budget,
      estimate: rendered.fit.estimate,
      state: rendered.fit.state,
    });
  }
  if (ms > VIEW_SLOW_MS)
    viewsLog('warn', `[views] slow ${rendered.view}`, { ms, elements: rendered.elements });
  logUnknownKinds(tab);
  countViewed(ctx, rendered.view);
  const headers = { ETag: tabEtag(tab.rev) };
  return parsed.json ? json(rendered.json, { headers }) : textPlain(rendered.text, { headers });
}

async function inScopeFacts(env: Env, document: DocumentDTO, tabScope: string | null) {
  const tabIds = document.tabs.map((t) => t.id);
  const facts = new Map<string, ReturnType<typeof headerFactsOf>>();
  let batches = 0;
  const take = (tabs: readonly TabDTO[]) => {
    for (const tab of tabs) facts.set(tab.id, headerFactsOf(tab, { rev: tab.rev, tabIds }));
  };
  if (tabScope !== null) {
    const tab = await getTab(env, document.id, tabScope);
    batches = 1;
    if (tab) take([tab]);
    return { facts, batches };
  }
  for (let offset = 0; ; offset += OVERVIEW_TAB_BATCH) {
    const page = await tabBodiesInOrder(env, document.id, offset, OVERVIEW_TAB_BATCH);
    batches++;
    take(page);
    if (page.length < OVERVIEW_TAB_BATCH) return { facts, batches };
  }
}

// The document overview, after the document GET's gate and scope redaction: in-scope tab bodies are
// read a batch at a time and reduced to their header facts; out-of-scope tabs are never read.
export async function answerOverview(
  ctx: RouteContext,
  parsed: ParsedView,
  document: DocumentDTO,
  tabScope: string | null,
): Promise<Response> {
  const started = Date.now();
  const { facts, batches } = await inScopeFacts(ctx.env, document, tabScope);
  const tabs: OverviewTabInput[] = document.tabs.flatMap((summary): OverviewTabInput[] => {
    if (summary.outOfScope) return [{ id: summary.id, outOfScope: true }];
    const tabFacts = facts.get(summary.id);
    return tabFacts === undefined ? [] : [{ id: summary.id, outOfScope: false, facts: tabFacts }];
  });
  const result = overviewView(document, tabs, {
    now: Date.now(),
    budget: parsed.request.budget,
    door: parsed.request.door,
  });
  viewsLog('info', '[views] overview', {
    doc: document.id,
    tabs: tabs.length,
    batches,
    ms: Date.now() - started,
  });
  countViewed(ctx, 'overview');
  return parsed.json ? json(result.json) : textPlain(result.text);
}
