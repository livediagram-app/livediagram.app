// The MCP's door to agent changesets (docs/specs/015-api/mcp-server.md §4.3a and §4.4; blueprint
// docs/specs/024-agents/blueprints/agent-changesets.md "MCP"): no tool does a whole-tab save. Every
// tab write is one changeset through the api, which applies it, relays it live to anyone with the
// tab open and keeps it through their next save.

import {
  CLIENT_HEADER,
  type ChangesetReplaceBody,
  type ChangesetRequest,
  type ChangesetResponse,
} from '@livediagram/api-schema';
import {
  computeRefs,
  elementFingerprint,
  resolveRef,
  type Element,
  type Tab,
} from '@livediagram/document';
import { ApiError, apiJson } from './api';
import type { Env } from './env';

export async function submitChangeset(
  env: Env,
  token: string,
  documentId: string,
  tabId: string,
  body: ChangesetRequest,
): Promise<ChangesetResponse> {
  return apiJson<ChangesetResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/changesets`,
    {
      method: 'POST',
      headers: { [CLIENT_HEADER]: 'mcp' },
      body: JSON.stringify(body),
    },
  );
}

// One op of `update_document`'s ops mode, as the model sends it.
export type McpOp = {
  op: 'add' | 'update' | 'remove';
  element?: Record<string, unknown>;
  elementId?: string;
};

// The element an op's `elementId` names: its id, or a ref as read_document prints it (a unique prefix,
// `id:"…"`), resolved as the api resolves it.
function namedIn(current: Tab): (elementId: string) => Element | undefined {
  const byId = new Map<string, Element>(current.elements.map((e) => [e.id, e]));
  const refs = computeRefs(current.elements.map((e) => e.id));
  return (elementId) => {
    const found = resolveRef(elementId, refs);
    return found.kind === 'found' ? byId.get(found.id) : undefined;
  };
}

// The selector an op targets: the element it names, by the always-safe `id:"…"` ref, so no id reads
// as a keyword or a term; a word naming nothing goes as given, for the api to refuse with candidates.
function targetOf(elementId: string, named: Element | undefined): string {
  return named ? `id:${JSON.stringify(named.id)}` : elementId;
}

// The JSON form of the edit operations an ops list means: `add` takes the whole element, `update` is
// `set` on the element it names with the fields it gives, `remove` is `rm` (pinned arrows go too and
// are listed). An `id` or `type` the model repeats unchanged in an update is dropped, since neither
// can change.
export function mcpOpsToEditOperations(ops: readonly McpOp[], current: Tab): unknown[] | string {
  const named = namedIn(current);
  const out: unknown[] = [];
  for (const [i, op] of ops.entries()) {
    const n = i + 1;
    if (op.op === 'add') {
      if (!op.element) return `ops[${n}]: add needs "element"`;
      out.push({ op: 'add', element: op.element });
    } else if (op.op === 'update') {
      if (!op.elementId || !op.element) return `ops[${n}]: update needs "elementId" and "element"`;
      const stored = named(op.elementId);
      const fields = { ...op.element };
      if (stored && fields.id === stored.id) delete fields.id;
      if (stored && fields.type === stored.type) delete fields.type;
      out.push({ op: 'set', target: targetOf(op.elementId, stored), fields });
    } else {
      if (!op.elementId) return `ops[${n}]: remove needs "elementId"`;
      out.push({ op: 'rm', target: targetOf(op.elementId, named(op.elementId)) });
    }
  }
  return out;
}

// The base of an ops changeset: the revision the model read (`read_document`'s `rev`, else the
// tab as loaded now) and the fingerprint of every existing element its ops name, by id or ref, taken
// from the tab as loaded now, so a person's change since is overwritten only on the fields the ops set.
export function baseFor(ops: readonly McpOp[], current: Tab & { rev: number }, rev?: number) {
  const named = namedIn(current);
  const elements: Record<string, string> = {};
  for (const op of ops) {
    const el = op.elementId ? named(op.elementId) : undefined;
    if (el) elements[el.id] = elementFingerprint(el);
  }
  return { rev: rev ?? current.rev, elements };
}

// A whole-tab body from the tool's graph, Mermaid, template or elements input.
export function replaceBodyFrom(args: {
  graph?: unknown;
  mermaid?: string;
  template?: string;
  elements?: unknown[];
  layout?: 'auto' | 'preserve';
  theme?: string;
  name?: string;
}): ChangesetReplaceBody {
  const source = args.graph
    ? { graph: args.graph }
    : args.mermaid
      ? { mermaid: args.mermaid }
      : args.template
        ? { template: args.template }
        : { elements: args.elements ?? [] };
  return {
    ...source,
    ...(args.layout ? { layout: args.layout } : {}),
    ...(args.theme ? { theme: args.theme } : {}),
    ...(args.name ? { name: args.name } : {}),
  };
}

// What the model reads when the api refuses a changeset: the route's own text (the engine's
// rejection, a conflict, a held element), never reported as an Error (it is model-correctable).
export function changesetErrorText(err: ApiError): string {
  try {
    const body = JSON.parse(err.body) as {
      error?: string;
      text?: string;
      message?: string;
      held?: { id: string; by: { name: string } }[];
      conflicts?: { id: string; reason: string }[];
    };
    if (body.text) return body.text;
    if (body.held?.length) {
      const who = body.held.map((h) => `${h.id} (held by ${h.by.name})`).join(', ');
      return `elements_held: a person has selected ${who}. Leave those elements out, or try again once they let go.`;
    }
    if (body.conflicts?.length) {
      const what = body.conflicts.map((c) => `${c.id} ${c.reason}`).join(', ');
      return `changeset_conflict: changed since you read it: ${what}. Read the tab again (read_document) and redo the edit.`;
    }
    return [body.error, body.message].filter(Boolean).join(': ') || `api ${err.status}`;
  } catch {
    return err.message;
  }
}

// A 4xx from the changeset route is the model's to correct; anything else is a fault.
export function isChangesetRefusal(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}
