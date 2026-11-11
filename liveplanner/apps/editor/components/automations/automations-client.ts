// The Automations routes as the editor calls them (docs/specs/026-plan/automations.md, blueprint automations.md
// "Routes"): the plan's rules, their runs, Test on a Card and Run Rule, typed with @liveplanner/api-schema. A plan in
// This Browser never calls them (its footer shows no button). A refusal the api names (`automation_*`, with the
// `path` of the step at fault) throws AutomationRefusal, an answer the builder shows rather than an error to report.

import {
  AUTOMATION_ERRORS,
  type AutomationError,
  type AutomationErrorBody,
  type AutomationRuleBody,
  type AutomationRuleResponse,
  type AutomationRunResponse,
  type AutomationRunsQuery,
  type AutomationRunsResponse,
  type AutomationsListResponse,
} from '@liveplanner/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';

// Who is asking, about which plan: the items scope's parts (a share link's code rides along).
export type AutomationsScope = { ownerId: string; projectId: string; shareCode: string | null };

export class AutomationRefusal extends Error {
  readonly status: number;
  readonly code: AutomationError;
  readonly path: string | null;
  constructor(status: number, body: AutomationErrorBody) {
    super(body.message ?? body.error);
    this.name = 'AutomationRefusal';
    this.status = status;
    this.code = body.error;
    this.path = body.path ?? null;
  }
}

const isAutomationError = (v: unknown): v is AutomationError =>
  typeof v === 'string' && (AUTOMATION_ERRORS as readonly string[]).includes(v);

async function refusalOf(res: Response): Promise<AutomationRefusal | null> {
  try {
    const body = (await res.clone().json()) as Partial<AutomationErrorBody>;
    if (!isAutomationError(body.error)) return null;
    return new AutomationRefusal(res.status, {
      error: body.error,
      ...(typeof body.path === 'string' ? { path: body.path } : {}),
      ...(typeof body.message === 'string' ? { message: body.message } : {}),
    });
  } catch {
    return null;
  }
}

function url(scope: AutomationsScope, rest = '', query = ''): string {
  return `${API_BASE}/projects/${encodeURIComponent(scope.projectId)}/automations${rest}${query}`;
}

async function call<T>(
  scope: AutomationsScope,
  rest: string,
  action: string,
  init: { method?: string; body?: unknown; query?: string } = {},
): Promise<T> {
  const res = await apiFetch(url(scope, rest, init.query), {
    method: init.method ?? 'GET',
    headers: await apiHeaders(scope.ownerId, {
      share: scope.shareCode,
      body: init.body !== undefined,
    }),
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const refusal = await refusalOf(res);
    if (refusal) throw refusal;
  }
  if (res.status === 204) {
    await expectOkVoid(res, action);
    return undefined as T;
  }
  return expectOk<T>(res, action);
}

const enc = encodeURIComponent;

export const listAutomations = (scope: AutomationsScope) =>
  call<AutomationsListResponse>(scope, '', 'automations');

export const createRule = (scope: AutomationsScope, rule: AutomationRuleBody) =>
  call<AutomationRuleResponse>(scope, '', 'automation create', { method: 'POST', body: rule });

export const updateRule = (scope: AutomationsScope, id: string, rule: AutomationRuleBody) =>
  call<AutomationRuleResponse>(scope, `/${enc(id)}`, 'automation save', {
    method: 'PUT',
    body: rule,
  });

export const toggleRule = (scope: AutomationsScope, id: string, enabled: boolean) =>
  call<AutomationRuleResponse>(scope, `/${enc(id)}/toggle`, 'automation toggle', {
    method: 'POST',
    body: { enabled },
  });

export const duplicateRule = (scope: AutomationsScope, id: string) =>
  call<AutomationRuleResponse>(scope, `/${enc(id)}/duplicate`, 'automation duplicate', {
    method: 'POST',
  });

export const deleteRule = (scope: AutomationsScope, id: string) =>
  call<void>(scope, `/${enc(id)}`, 'automation delete', { method: 'DELETE' });

export const testRule = (scope: AutomationsScope, rule: AutomationRuleBody, item: string) =>
  call<AutomationRunResponse>(scope, '/test', 'automation test', {
    method: 'POST',
    body: { rule, item },
  });

export const runRule = (scope: AutomationsScope, id: string, item: string) =>
  call<AutomationRunResponse>(scope, `/${enc(id)}/run`, 'automation run', {
    method: 'POST',
    body: { item },
  });

export function listRuns(scope: AutomationsScope, query: AutomationRunsQuery = {}) {
  const params = new URLSearchParams();
  if (query.rule) params.set('rule', query.rule);
  if (query.result) params.set('result', query.result);
  if (query.since !== undefined) params.set('since', String(query.since));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const q = params.toString();
  return call<AutomationRunsResponse>(scope, '/runs', 'automation runs', {
    query: q ? `?${q}` : '',
  });
}
