// The Automations routes as an editor calls them (liveworkspace/docs/specs/018-automations/automations.md; blueprint
// ui.md "The client"): the item's rules, their runs, Test Rule and Run Rule. The app hands in its own fetch, its
// headers and where its routes sit (AutomationsApi); the calls and their refusals are the same everywhere. A refusal
// the api names (one of `errors`, with the `path` of the step at fault) throws AutomationRefusal, an answer the
// builder shows rather than an error to report.

import { readAiKeyFailure, type AiKeyFailure } from '@liveworkspace/ai/key-failure';
import type {
  AutomationHookInfo,
  AutomationRuleSummary,
  AutomationRunsQuery,
} from '@liveworkspace/automations';
import type { AutomationsScope } from './kit';
import type { ListResponse, ListedRule, ListedRun, RuleBody, RuleStart } from './types';

export class AutomationRefusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly path: string | null;
  // `ai_key_failed` (Describe a Rule on a key): whose key failed and how, for the source line. Never the key.
  readonly aiKey: AiKeyFailure | null;
  constructor(
    status: number,
    body: { error: string; path?: string; message?: string; aiKey?: AiKeyFailure | null },
  ) {
    super(body.message ?? body.error);
    this.name = 'AutomationRefusal';
    this.status = status;
    this.code = body.error;
    this.path = body.path ?? null;
    this.aiKey = body.aiKey ?? null;
  }
}

/** What an app hands in to reach its routes. */
export interface AutomationsApi {
  /** The item's Automations address, with no trailing slash: `…/projects/<id>/automations`. */
  url: (scope: AutomationsScope) => string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  headers: (scope: AutomationsScope, body: boolean) => Promise<HeadersInit>;
  /** The app's reading of an answer (its own error for anything but 2xx). */
  expectOk: <T>(res: Response, action: string) => Promise<T>;
  expectOkVoid: (res: Response, action: string) => Promise<void>;
  /** The codes that are refusals. */
  errors: readonly string[];
  /** How a test and a run name what they run on in the body (liveplanner: `{ item }`). */
  subject: (subject: string | null) => Record<string, unknown>;
}

export interface AutomationsClient<
  Body extends RuleBody = RuleBody,
  Rule extends ListedRule = ListedRule,
  Run extends ListedRun = ListedRun,
> {
  list: (scope: AutomationsScope) => Promise<ListResponse<Rule>>;
  create: (scope: AutomationsScope, rule: Body) => Promise<{ rule: Rule }>;
  update: (scope: AutomationsScope, id: string, rule: Body) => Promise<{ rule: Rule }>;
  toggle: (scope: AutomationsScope, id: string, enabled: boolean) => Promise<{ rule: Rule }>;
  duplicate: (scope: AutomationsScope, id: string) => Promise<{ rule: Rule }>;
  remove: (scope: AutomationsScope, id: string) => Promise<void>;
  test: (scope: AutomationsScope, rule: Body, subject: string | null) => Promise<{ run: Run }>;
  /** Describe a Rule: the person's words drafted into a rule to open in the builder, unsaved and off. */
  draft: (
    scope: AutomationsScope,
    prompt: string,
    timeZone: string,
  ) => Promise<{ rule: Body; picks: RuleStart['picks'] }>;
  run: (scope: AutomationsScope, id: string, subject: string | null) => Promise<{ run: Run }>;
  runs: (scope: AutomationsScope, query?: AutomationRunsQuery) => Promise<{ runs: Run[] }>;
  /** Make Secret and Regenerate for an Incoming Webhook rule: the secret, in this answer only. */
  makeSecret: (
    scope: AutomationsScope,
    id: string,
  ) => Promise<{ secret: string; hook: AutomationHookInfo }>;
  /** A rule as a reader sees it: by its id or its name, on a tab link with its tab. A rule gone throws
   *  AutomationRefusal `automation_not_found`. */
  summary: (
    scope: AutomationsScope & { tabId: string | null },
    ask: { ruleId?: string | undefined; name: string },
  ) => Promise<{ rule: AutomationRuleSummary }>;
}

const enc = encodeURIComponent;

export function createAutomationsClient<
  Body extends RuleBody = RuleBody,
  Rule extends ListedRule = ListedRule,
  Run extends ListedRun = ListedRun,
>(api: AutomationsApi): AutomationsClient<Body, Rule, Run> {
  async function refusalOf(res: Response): Promise<AutomationRefusal | null> {
    try {
      const body = (await res.clone().json()) as {
        error?: unknown;
        path?: unknown;
        message?: unknown;
      };
      if (typeof body.error !== 'string' || !api.errors.includes(body.error)) return null;
      return new AutomationRefusal(res.status, {
        error: body.error,
        ...(typeof body.path === 'string' ? { path: body.path } : {}),
        ...(typeof body.message === 'string' ? { message: body.message } : {}),
        aiKey: readAiKeyFailure(body),
      });
    } catch {
      return null;
    }
  }

  async function call<T>(
    scope: AutomationsScope,
    rest: string,
    action: string,
    init: { method?: string; body?: unknown; query?: string } = {},
  ): Promise<T> {
    const res = await api.fetch(`${api.url(scope)}${rest}${init.query ?? ''}`, {
      method: init.method ?? 'GET',
      headers: await api.headers(scope, init.body !== undefined),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    if (!res.ok) {
      const refusal = await refusalOf(res);
      if (refusal) throw refusal;
    }
    if (res.status === 204) {
      await api.expectOkVoid(res, action);
      return undefined as T;
    }
    return api.expectOk<T>(res, action);
  }

  return {
    list: (scope) => call(scope, '', 'automations'),
    create: (scope, rule) => call(scope, '', 'automation create', { method: 'POST', body: rule }),
    update: (scope, id, rule) =>
      call(scope, `/${enc(id)}`, 'automation save', { method: 'PUT', body: rule }),
    toggle: (scope, id, enabled) =>
      call(scope, `/${enc(id)}/toggle`, 'automation toggle', {
        method: 'POST',
        body: { enabled },
      }),
    duplicate: (scope, id) =>
      call(scope, `/${enc(id)}/duplicate`, 'automation duplicate', { method: 'POST' }),
    remove: (scope, id) => call(scope, `/${enc(id)}`, 'automation delete', { method: 'DELETE' }),
    test: (scope, rule, subject) =>
      call(scope, '/test', 'automation test', {
        method: 'POST',
        body: { rule, ...api.subject(subject) },
      }),
    draft: (scope, prompt, timeZone) =>
      call(scope, '/draft', 'automation draft', { method: 'POST', body: { prompt, timeZone } }),
    run: (scope, id, subject) =>
      call(scope, `/${enc(id)}/run`, 'automation run', {
        method: 'POST',
        body: api.subject(subject),
      }),
    runs: (scope, query = {}) => {
      const params = new URLSearchParams();
      if (query.rule) params.set('rule', query.rule);
      if (query.result) params.set('result', query.result);
      if (query.since !== undefined) params.set('since', String(query.since));
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const q = params.toString();
      return call(scope, '/runs', 'automation runs', { query: q ? `?${q}` : '' });
    },
    makeSecret: (scope, id) =>
      call(scope, `/${enc(id)}/secret`, 'automation secret', { method: 'POST' }),
    summary: (scope, ask) => {
      const query = new URLSearchParams(ask.ruleId ? { rule: ask.ruleId } : { name: ask.name });
      if (scope.tabId) query.set('tabId', scope.tabId);
      return call(scope, '/summary', 'Read rule summary', { query: `?${query.toString()}` });
    },
  };
}
