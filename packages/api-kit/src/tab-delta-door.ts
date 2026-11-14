// The api's side of the delta save (each product's docs/specs/006-*/delta-saves.md "How the api applies it"), once for
// every product: POST /api/<items>/<id>/tabs/<tabId>/delta. The body is checked, the stored tab read, the ops applied
// to its elements, and the rebuild proved by a digest to be exactly the tab the editor holds; only then does it go
// through the product's own whole-tab save path (its writeTabSave). Anything that does not line up is refused
// `409 delta_refused` with a `reason`, nothing written, and the editor saves the tab whole.
//
// The caller has passed the whole-tab save's doors first (a token refused, the edit gate for this tab), in the PUT's
// order, and read the body.

import {
  TAB_DELTA_MAX_OPS,
  TAB_DELTA_REFUSED,
  elementsDigest,
  parseTabDelta,
  type TabDeltaOp,
  type TabDeltaRefusal,
} from '@liveworkspace/api-schema/tab-delta';

type Stored<E> = { rev: number; elements: E[] };

/** The door's OpenAPI entry parts, every product's manifest the same: its summary, request and response. */
export const TAB_DELTA_OPENAPI: {
  summary: string;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  statuses: number[];
} = {
  summary:
    "The editor's tab save sent as the element ops since the stored copy at `baseRev`: rebuilt over the stored tab, stored only when the SHA-256 of the rebuilt elements' JSON is `digest`, then saved as the whole-tab save is. Anything that does not line up is 409 `delta_refused` with a `reason` (`too_many_ops`, `no_base`, `stale_base`, `digest_mismatch`), answered by saving the tab whole. An API token is refused with 405 `use_changesets`.",
  requestSchema: {
    type: 'object',
    properties: {
      baseRev: { type: 'integer', minimum: 0 },
      digest: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      ops: { type: 'array', maxItems: TAB_DELTA_MAX_OPS, items: { type: 'object' } },
      tab: { type: 'object' },
    },
    required: ['baseRev', 'digest', 'ops', 'tab'],
  },
  responseSchema: {
    type: 'object',
    properties: { rev: { type: 'integer' }, digest: { type: 'string' } },
    required: ['rev', 'digest'],
  },
  statuses: [200, 400, 401, 403, 404, 405, 409, 410, 413],
};

export type TabDeltaDoor<E extends { id: string }, S extends Stored<E>> = {
  // The parsed request body.
  body: unknown;
  // How the item is named in the logs (`documentId`, `projectId`, `designId`), and its id and the tab's.
  idKey: string;
  itemId: string;
  tabId: string;
  // The stored tab, or null when it is not stored.
  readStored: () => Promise<S | null>;
  // The product's applyElementOps.
  apply: (elements: E[], ops: TabDeltaOp<E>[]) => E[];
  // The product's whole-tab save from the body on, given the rebuilt tab and the read just made: a Response for any
  // of its refusals, else the revision written and the elements now stored.
  write: (
    tab: Record<string, unknown>,
    stored: S,
  ) => Promise<Response | { rev: number; elements: readonly unknown[] }>;
  badRequest: (message: string) => Response;
  json: (body: unknown, init?: ResponseInit) => Response;
};

/** One delta save: `200 { rev, digest }` (the digest of what is now stored), a `409 delta_refused`, a `400` for a
 *  malformed body, or the whole save's own refusal. */
export async function answerTabDelta<E extends { id: string }, S extends Stored<E>>(
  door: TabDeltaDoor<E, S>,
): Promise<Response> {
  const delta = parseTabDelta(door.body);
  if (typeof delta === 'string') return door.badRequest(delta);
  const where = { [door.idKey]: door.itemId, tabId: door.tabId };
  const refuse = (reason: TabDeltaRefusal) => {
    console.info('[tab-delta] refused', { ...where, reason });
    return door.json({ error: TAB_DELTA_REFUSED, reason }, { status: 409 });
  };
  if (delta.ops.length > TAB_DELTA_MAX_OPS) return refuse('too_many_ops');
  const stored = await door.readStored();
  if (!stored) return refuse('no_base');
  if (stored.rev !== delta.baseRev) return refuse('stale_base');
  // The ops' elements are the editor's as sent; the product's schema gate in `write` checks them once rebuilt.
  const elements = door.apply(stored.elements, delta.ops as unknown as TabDeltaOp<E>[]);
  if ((await elementsDigest(elements)) !== delta.digest) return refuse('digest_mismatch');
  const saved = await door.write({ ...delta.tab, id: door.tabId, elements }, stored);
  if (saved instanceof Response) return saved;
  const digest = await elementsDigest(saved.elements);
  console.info('[tab-delta] saved', {
    ...where,
    ops: delta.ops.length,
    matched: digest === delta.digest,
  });
  return door.json({ rev: saved.rev, digest });
}
