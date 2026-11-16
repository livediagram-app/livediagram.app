// The editor's calls on the suggestion routes (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "The
// routes"): each product hands in how it reaches its api (its base for the item, and its authorised fetch).
import {
  parseStoredSuggestion,
  type CanvasSuggestion,
  type SuggestionElement,
  type SuggestionOp,
} from './suggestion';
import type { AcceptConflict } from './plan';

/** A request on the item's api: `path` is under the item (`tabs/<tabId>/suggestions`). */
export type SuggestionRequest = (
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
) => Promise<Response>;

export type Decision = { all: true } | { ids: string[] };

export type AcceptAnswer =
  | { ok: true; accepted: string[]; conflicts: AcceptConflict[] }
  | { ok: false; conflicts: AcceptConflict[]; error: string };

export type SuggestionsClient<E extends SuggestionElement> = {
  list: (tabId: string) => Promise<CanvasSuggestion<E>[]>;
  submit: (tabId: string, ops: SuggestionOp<E>[]) => Promise<CanvasSuggestion<E>>;
  accept: (tabId: string, decision: Decision) => Promise<AcceptAnswer>;
  reject: (tabId: string, decision: Decision) => Promise<string[]>;
};

const path = (tabId: string, action?: 'accept' | 'reject') =>
  `tabs/${encodeURIComponent(tabId)}/suggestions${action ? `/${action}` : ''}`;

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : `http_${res.status}`;
}

const readOne = <E extends SuggestionElement>(raw: unknown): CanvasSuggestion<E> | null =>
  parseStoredSuggestion<E>(JSON.stringify(raw));

export function suggestionsClient<E extends SuggestionElement>(
  request: SuggestionRequest,
): SuggestionsClient<E> {
  return {
    async list(tabId) {
      const res = await request(path(tabId), { method: 'GET' });
      if (!res.ok) throw new Error(await errorOf(res));
      const body = (await res.json()) as { suggestions?: unknown[] };
      return (body.suggestions ?? []).flatMap((s) => {
        const one = readOne<E>(s);
        return one ? [one] : [];
      });
    },
    async submit(tabId, ops) {
      const res = await request(path(tabId), { method: 'POST', body: { ops } });
      if (!res.ok) throw new Error(await errorOf(res));
      const one = readOne<E>(((await res.json()) as { suggestion?: unknown }).suggestion);
      if (!one) throw new Error('bad_answer');
      return one;
    },
    async accept(tabId, decision) {
      const res = await request(path(tabId, 'accept'), { method: 'POST', body: decision });
      const body = (await res.json().catch(() => ({}))) as {
        accepted?: string[];
        conflicts?: AcceptConflict[];
        error?: string;
      };
      if (res.ok)
        return { ok: true, accepted: body.accepted ?? [], conflicts: body.conflicts ?? [] };
      return {
        ok: false,
        conflicts: body.conflicts ?? [],
        error: body.error ?? `http_${res.status}`,
      };
    },
    async reject(tabId, decision) {
      const res = await request(path(tabId, 'reject'), { method: 'POST', body: decision });
      if (!res.ok) throw new Error(await errorOf(res));
      return ((await res.json()) as { rejected?: string[] }).rejected ?? [];
    },
  };
}
