// The delta save (livediagram's docs/specs/006-document/delta-saves.md): an Editor's tab save sent as the element ops
// since a base copy the api stores, instead of the whole tab. The api rebuilds the whole tab from its stored copy and
// the ops, and stores it only when a digest proves the rebuild is exactly the tab the editor holds; anything else is
// refused `409 delta_refused`, and the editor saves the tab whole. The envelope is every product's; the ops are each
// product's own `diffToElementOps` and `applyElementOps`, which share these four shapes.

import { sha256Hex, sha256HexSync } from './sha256';

/** The path segment after the tab id: `POST /api/<items>/<id>/tabs/<tabId>/delta`. */
export const TAB_DELTA_SEGMENT = 'delta';

/** The most ops one delta carries. A diff past it saves little and costs the api an apply. Safe range: 100 to 2,000. */
export const TAB_DELTA_MAX_OPS = 500;

/** The largest share of the elements' JSON a delta body may be before the editor sends the tab whole instead. Safe
 *  range: 0.25 to 0.9. */
export const TAB_DELTA_MAX_SHARE = 0.5;

/** The error a refused delta answers, beside its `reason`. */
export const TAB_DELTA_REFUSED = 'delta_refused';

export type TabDeltaRefusal = 'too_many_ops' | 'no_base' | 'stale_base' | 'digest_mismatch';

export type TabDeltaOp<E> =
  | { kind: 'add'; element: E; at: number }
  | { kind: 'update'; element: E }
  | { kind: 'remove'; id: string }
  | { kind: 'reorder'; ids: string[] };

export type TabDeltaBody<E> = {
  // The revision the base copy is.
  baseRev: number;
  // elementsDigest of the editor's current elements, as it would send them whole.
  digest: string;
  ops: TabDeltaOp<E>[];
  // Every other field of the tab, as a whole save sends it.
  tab: Record<string, unknown>;
};

type AnyElement = Record<string, unknown> & { id: string };

const DIGEST = /^[0-9a-f]{64}$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isWhole = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

const isElement = (v: unknown): v is AnyElement => isObject(v) && typeof v.id === 'string';

function isOp(v: unknown): v is TabDeltaOp<AnyElement> {
  if (!isObject(v)) return false;
  switch (v.kind) {
    case 'add':
      return isElement(v.element) && isWhole(v.at);
    case 'update':
      return isElement(v.element);
    case 'remove':
      return typeof v.id === 'string';
    case 'reorder':
      return Array.isArray(v.ids) && v.ids.every((id) => typeof id === 'string');
    default:
      return false;
  }
}

/** The delta body, or the message of the `400` it answers. A `tab.elements` is dropped: the elements come from the
 *  ops. The ops' elements are checked only for an id here; the rebuilt tab meets the product's schema gate. */
export function parseTabDelta(body: unknown): TabDeltaBody<AnyElement> | string {
  if (!isObject(body)) return 'expected a JSON object';
  if (!isWhole(body.baseRev)) return 'invalid baseRev';
  if (typeof body.digest !== 'string' || !DIGEST.test(body.digest)) return 'invalid digest';
  if (!Array.isArray(body.ops) || !body.ops.every(isOp)) return 'invalid ops';
  if (!isObject(body.tab)) return 'invalid tab';
  const { elements: _elements, ...tab } = body.tab;
  void _elements;
  return { baseRev: body.baseRev, digest: body.digest, ops: body.ops, tab };
}

/** SHA-256, lowercase hex, of the elements' JSON: what both ends compare to prove a rebuild. */
export function elementsDigest(elements: readonly unknown[]): Promise<string> {
  return digestOfJson(JSON.stringify(elements));
}

function digestOfJson(json: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(json));
}

type DeltaPlanArgs<E extends { id: string }> = {
  base: { rev: number; elements: E[] } | null;
  tab: { elements: E[] };
  diff: (before: E[], after: E[]) => TabDeltaOp<E>[];
};

export type TabDeltaPlan = { body: string; digest: string; ops: number };

// Everything but the digest: null to save whole, or the elements' JSON and the body for a digest.
function draftTabDelta<E extends { id: string }>(
  args: DeltaPlanArgs<E>,
): { elementsJson: string; ops: number; body: (digest: string) => string } | null {
  const { base, tab } = args;
  if (!base) return null;
  const ops = args.diff(base.elements, tab.elements);
  if (ops.length > TAB_DELTA_MAX_OPS) return null;
  const elementsJson = JSON.stringify(tab.elements);
  const { elements: _elements, ...fields } = tab;
  void _elements;
  // Sized with a stand-in digest of the same length, so the hash is taken only once a delta is worth sending.
  const body = (digest: string) => JSON.stringify({ baseRev: base.rev, digest, ops, tab: fields });
  if (body('0'.repeat(64)).length > elementsJson.length * TAB_DELTA_MAX_SHARE) return null;
  return { elementsJson, ops: ops.length, body };
}

/** The delta to send for `tab`, or null to save it whole: no base copy, more than TAB_DELTA_MAX_OPS ops, or a body
 *  longer than TAB_DELTA_MAX_SHARE of the elements' JSON. `tab` is the tab as the whole save would send it. */
export async function planTabDelta<E extends { id: string }>(
  args: DeltaPlanArgs<E>,
): Promise<TabDeltaPlan | null> {
  const draft = draftTabDelta(args);
  if (!draft) return null;
  const digest = await digestOfJson(draft.elementsJson);
  return { body: draft.body(digest), digest, ops: draft.ops };
}

/** planTabDelta at once, for the unload flush, which cannot wait for Web Crypto: the same plan, its digest taken in
 *  plain code (the same SHA-256, byte for byte). */
export function planTabDeltaSync<E extends { id: string }>(
  args: DeltaPlanArgs<E>,
): TabDeltaPlan | null {
  const draft = draftTabDelta(args);
  if (!draft) return null;
  const digest = sha256HexSync(new TextEncoder().encode(draft.elementsJson));
  return { body: draft.body(digest), digest, ops: draft.ops };
}
