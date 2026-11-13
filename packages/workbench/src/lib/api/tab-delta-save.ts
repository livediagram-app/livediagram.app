// The editor's side of the delta save (livediagram's docs/specs/006-document/delta-saves.md "How the editor uses it"):
// the base copy of each tab, the elements exactly as the api stores them at a revision, and the one delta save that
// turns the editor's tab into ops over it. `send` answers null whenever the save should go whole instead: no base
// copy, a delta not worth sending, or the api's `409 delta_refused`.
import {
  TAB_DELTA_REFUSED,
  TAB_DELTA_SEGMENT,
  planTabDelta,
  type TabDeltaOp,
} from '@liveworkspace/api-schema/tab-delta';

/** The tabs whose base copies the editor holds, the most recently used. Safe range: 4 to 64. */
export const TAB_DELTA_BASES_MAX = 16;

type El = { id: string };

/** What a product's editor binds to send deltas: its own `diffToElementOps`. */
export type TabDeltaConfig<E extends El> = {
  diff: (before: E[], after: E[]) => TabDeltaOp<E>[];
};

type Base<E> = { rev: number; elements: E[] };

// Whether the answer is the api's refusal of the delta (as opposed to the whole save's own refusals, which surface).
async function refusalOf(res: Response): Promise<string | null> {
  if (res.status !== 409) return null;
  try {
    const body = (await res.clone().json()) as { error?: unknown; reason?: unknown };
    if (body.error !== TAB_DELTA_REFUSED) return null;
    return typeof body.reason === 'string' ? body.reason : 'unknown';
  } catch {
    return null;
  }
}

async function answerOf(res: Response): Promise<{ rev: number | null; digest: string | null }> {
  try {
    const body = (await res.json()) as { rev?: unknown; digest?: unknown };
    return {
      rev: typeof body.rev === 'number' ? body.rev : null,
      digest: typeof body.digest === 'string' ? body.digest : null,
    };
  } catch {
    return { rev: null, digest: null };
  }
}

export function createTabDeltaSaves<E extends El>(deps: {
  diff: TabDeltaConfig<E>['diff'];
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  expectOkVoid: (res: Response, action: string) => Promise<void>;
  saveTimeoutSignal: (body: string) => AbortSignal;
  max?: number;
}) {
  const max = deps.max ?? TAB_DELTA_BASES_MAX;
  // Insertion order is recency: a hold moves its tab to the end, and the first key is the least recently used.
  const bases = new Map<string, Base<E>>();
  const keyOf = (itemId: string, tabId: string) => `${itemId}␟${tabId}`;

  /** Hold `elements` as the tab's stored copy at `rev`, unless the copy held is for a newer revision. */
  function hold(itemId: string, tabId: string, rev: number, elements: E[]): void {
    const key = keyOf(itemId, tabId);
    const held = bases.get(key);
    if (held && held.rev > rev) return;
    bases.delete(key);
    bases.set(key, { rev, elements });
    if (bases.size > max) bases.delete(bases.keys().next().value as string);
  }

  /** Hold a whole save's echo, each element the editor's own object where it is the same as stored: the copy then
   *  costs no memory of its own, and the next diff skips those elements by reference. */
  function holdEcho(
    itemId: string,
    tabId: string,
    rev: number,
    echoed: E[],
    sent: readonly E[],
  ): void {
    const sentById = new Map(sent.map((el) => [el.id, el]));
    const elements = echoed.map((el) => {
      const mine = sentById.get(el.id);
      return mine && JSON.stringify(mine) === JSON.stringify(el) ? mine : el;
    });
    hold(itemId, tabId, rev, elements);
  }

  function drop(itemId: string, tabId: string): void {
    bases.delete(keyOf(itemId, tabId));
  }

  function base(itemId: string, tabId: string): Base<E> | null {
    return bases.get(keyOf(itemId, tabId)) ?? null;
  }

  /** One delta save of `tab` (as the whole save would send it) to `${url}/delta` with the whole save's headers.
   *  Answers the revision written, or null to save the tab whole. Any other failure throws, as the whole save's. */
  async function send(args: {
    itemId: string;
    tabId: string;
    url: string;
    tab: { elements: E[] };
    headers: Headers;
  }): Promise<{ rev: number | null } | null> {
    const { itemId, tabId } = args;
    const plan = await planTabDelta({ base: base(itemId, tabId), tab: args.tab, diff: deps.diff });
    if (!plan) return null;
    // The base this plan was made over: a hold that lands while the request is out must not be dropped below.
    const sentOver = base(itemId, tabId);
    const res = await deps.fetch(`${args.url}/${TAB_DELTA_SEGMENT}`, {
      method: 'POST',
      headers: args.headers,
      body: plan.body,
      // A hung save would hold every later save of this tab behind it, as the whole save's.
      signal: deps.saveTimeoutSignal(plan.body),
    });
    const reason = await refusalOf(res);
    if (reason) {
      console.info('[tab-delta] refused', { tabId, reason });
      if (base(itemId, tabId) === sentOver) drop(itemId, tabId);
      return null;
    }
    await deps.expectOkVoid(res, 'save tab');
    const answer = await answerOf(res);
    // The store holds exactly the elements sent only when its digest is theirs; otherwise the next save is whole.
    if (answer.rev !== null && answer.digest === plan.digest) {
      hold(itemId, tabId, answer.rev, args.tab.elements);
    } else if (base(itemId, tabId) === sentOver) {
      drop(itemId, tabId);
    }
    return { rev: answer.rev };
  }

  return { hold, holdEcho, drop, base, send };
}
