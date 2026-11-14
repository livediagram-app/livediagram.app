// The editor's side of the delta save (livediagram's docs/specs/006-document/delta-saves.md "How the editor uses it"):
// the base copy of each tab, the elements exactly as the api stores them at a revision, and the one delta save that
// turns the editor's tab into ops over it. `send` answers null whenever the save should go whole instead: no base
// copy, a delta not worth sending, or the api's `409 delta_refused`. `planUnload` is the unload flush's delta
// ("Unload"), planned at once since the page is going. `stampOf` and `adopt` are "A peer's save moves the base copy":
// the digest a save announces to the room, and a peer's proof that it holds what that save stored.
import {
  TAB_DELTA_REFUSED,
  TAB_DELTA_SEGMENT,
  elementsDigest,
  planTabDelta,
  planTabDeltaSync,
  type TabDeltaOp,
  type TabDeltaPlan,
} from '@liveworkspace/api-schema/tab-delta';
import { debugLog } from '../debug-log';

/** The tabs whose base copies the editor holds, the most recently used. Safe range: 4 to 64. */
export const TAB_DELTA_BASES_MAX = 16;

type El = { id: string };

/** What a product's editor binds to send deltas: its own `diffToElementOps`. */
export type TabDeltaConfig<E extends El> = {
  diff: (before: E[], after: E[]) => TabDeltaOp<E>[];
};

// `digest` is the elements' digest once known: a delta's answer names it, and `stampOf` takes it once otherwise.
type Base<E> = { tabId: string; rev: number; elements: E[]; digest?: string };

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
  function hold(itemId: string, tabId: string, rev: number, elements: E[], digest?: string): void {
    const key = keyOf(itemId, tabId);
    const held = bases.get(key);
    if (held && held.rev > rev) return;
    bases.delete(key);
    bases.set(
      key,
      digest === undefined ? { tabId, rev, elements } : { tabId, rev, elements, digest },
    );
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

  // A delta's answer: 'refused' (the base copy dropped) to save whole, or the revision written. The base copy is held
  // at that revision when the stored digest is the plan's, and dropped otherwise, unless a newer copy was held while
  // the request was out (`sentOver` no longer the held one). Any other failure throws as the whole save's, or, `quiet`
  // (the unload flush, which reads no answers), answers 'failed'.
  async function settle(
    itemId: string,
    tabId: string,
    sentOver: Base<E> | null,
    plan: TabDeltaPlan,
    elements: E[],
    res: Response,
    quiet = false,
  ): Promise<'refused' | 'failed' | { rev: number | null }> {
    const reason = await refusalOf(res);
    if (reason) {
      debugLog('[tab-delta] refused', { tabId, reason });
      if (base(itemId, tabId) === sentOver) drop(itemId, tabId);
      return 'refused';
    }
    if (quiet && !res.ok) return 'failed';
    await deps.expectOkVoid(res, 'save tab');
    const answer = await answerOf(res);
    // The store holds exactly the elements sent only when its digest is theirs; otherwise the next save is whole.
    if (answer.rev !== null && answer.digest === plan.digest) {
      hold(itemId, tabId, answer.rev, elements, plan.digest);
    } else if (base(itemId, tabId) === sentOver) {
      drop(itemId, tabId);
    }
    return { rev: answer.rev };
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
    const settled = await settle(itemId, tabId, sentOver, plan, args.tab.elements, res);
    // Not quiet, so a failure has thrown: only a refusal or a revision reaches here.
    return typeof settled === 'string' ? null : settled;
  }

  /** The unload flush's delta of `tab`, planned at once (the page cannot wait for Web Crypto): the url and body to
   *  POST, and `settle` for its answer: 'saved', 'refused' (send the tab whole) or 'failed' (any other failure, the
   *  whole save's own refusals among them); or null to send the tab whole now. The caller sends it, with its own
   *  headers and keepalive. */
  function planUnload(args: {
    itemId: string;
    tabId: string;
    url: string;
    tab: { elements: E[] };
  }): {
    url: string;
    body: string;
    // What a draft of the tab keeps to tell, on the next load, whether this delta landed.
    changed: string[];
    removed: string[];
    settle: (res: Response) => Promise<'saved' | 'refused' | 'failed'>;
  } | null {
    const { itemId, tabId } = args;
    const sentOver = base(itemId, tabId);
    const plan = planTabDeltaSync({ base: sentOver, tab: args.tab, diff: deps.diff });
    if (!plan) return null;
    return {
      url: `${args.url}/${TAB_DELTA_SEGMENT}`,
      body: plan.body,
      changed: plan.changed,
      removed: plan.removed,
      settle: async (res) => {
        const settled = await settle(itemId, tabId, sentOver, plan, args.tab.elements, res, true);
        return typeof settled === 'string' ? settled : 'saved';
      },
    };
  }

  /** What a save of `tabId` that wrote `rev` announces to the room: the digest of the elements stored at `rev`, from
   *  the base copy held at exactly that revision (in any item: the revision is the tab's own), or null when none is
   *  held. The digest is taken once and kept on the copy. */
  async function stampOf(tabId: string, rev: number): Promise<string | null> {
    for (const held of bases.values()) {
      if (held.tabId !== tabId || held.rev !== rev) continue;
      held.digest ??= await elementsDigest(held.elements);
      return held.digest;
    }
    return null;
  }

  /** A peer's save of the tab, announced as `rev` and `digest`: `elements` (the tab as this editor's baseline holds
   *  it, as a save would send it) become the base copy at `rev` when their digest is the announced one and no copy
   *  for that revision or a newer one is held. Answers whether they did. */
  async function adopt(
    itemId: string,
    tabId: string,
    rev: number,
    digest: string,
    elements: E[],
  ): Promise<boolean> {
    const heldNewer = () => (base(itemId, tabId)?.rev ?? -1) >= rev;
    if (heldNewer()) return false;
    if ((await elementsDigest(elements)) !== digest) {
      debugLog('[tab-delta] peer save not adopted', { tabId, rev });
      return false;
    }
    // A save of our own may have landed while the digest was taken.
    if (heldNewer()) return false;
    hold(itemId, tabId, rev, elements, digest);
    debugLog('[tab-delta] peer save adopted', { tabId, rev });
    return true;
  }

  return { hold, holdEcho, drop, base, send, planUnload, stampOf, adopt };
}
