# Delta saves blueprint

Derived from [Delta saves](../delta-saves.md). Engineering precision only; design lives in the spec.

## Domain and naming

| Term       | Identifier                   | Meaning                                                                                   |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| Delta save | `POST .../tabs/:tabId/delta` | One tab save sent as element ops over a base copy                                         |
| Delta body | `TabDeltaBody`               | `{ baseRev, digest, ops, tab }`, parsed by `parseTabDelta`                                |
| Delta op   | `TabDeltaOp`                 | One element op, the same four kinds as `ElementOp` (`add`, `update`, `remove`, `reorder`) |
| Base copy  | (the editor's, per tab)      | The tab's elements exactly as stored at `baseRev`                                         |
| Digest     | `elementsDigest(elements)`   | SHA-256 lowercase hex of `JSON.stringify(elements)`                                       |
| Refusal    | `TabDeltaRefusal`            | `too_many_ops`, `no_base`, `stale_base`, `digest_mismatch`                                |
| Whole save | `PUT .../tabs/:tabId`        | The whole-tab save; the delta save's fallback                                             |

"Delta save" is the only name: never "patch save", "partial save" or "diff save".

## Modules

| File                                                 | Responsibility                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `../packages/api-schema/src/tab-delta.ts`            | The envelope every product shares: constants, `TabDeltaOp`, `TabDeltaBody`, `parseTabDelta`, `elementsDigest`, `planTabDelta`, the refusal names |
| `apps/api/src/routes/tab-delta-route.ts`             | `handleTabDelta`: parse, refuse, rebuild with `applyElementOps`, prove by digest, hand to `writeTabSave`                                         |
| `apps/api/src/routes/tab-put-route.ts`               | `writeTabSave`: the whole-tab save's pipeline, shared by the PUT and the delta door; `handleTabPut`                                              |
| `apps/api/src/routes/document-subresource-routes.ts` | Dispatch: `POST /api/documents/:id/tabs/:tabId/delta` behind the PUT's doors                                                                     |
| `apps/api/src/openapi/manifest.ts`                   | The route's OpenAPI entry                                                                                                                        |

## Interfaces and contracts

```ts
// @liveworkspace/api-schema/tab-delta
export const TAB_DELTA_SEGMENT = 'delta';
export const TAB_DELTA_MAX_OPS = 500;
export const TAB_DELTA_MAX_SHARE = 0.5;
export const TAB_DELTA_REFUSED = 'delta_refused';
export type TabDeltaRefusal = 'too_many_ops' | 'no_base' | 'stale_base' | 'digest_mismatch';
export type TabDeltaOp<E> =
  | { kind: 'add'; element: E; at: number }
  | { kind: 'update'; element: E }
  | { kind: 'remove'; id: string }
  | { kind: 'reorder'; ids: string[] };
export type TabDeltaBody<E> = {
  baseRev: number;
  digest: string;
  ops: TabDeltaOp<E>[];
  tab: Record<string, unknown>;
};
export function parseTabDelta(body: unknown): TabDeltaBody<Record<string, unknown>> | string;
export function elementsDigest(elements: readonly unknown[]): Promise<string>;
export function planTabDelta<E extends { id: string }>(args: {
  base: { rev: number; elements: E[] } | null;
  tab: { elements: E[] };
  diff: (before: E[], after: E[]) => TabDeltaOp<E>[];
}): Promise<{ body: string; digest: string; ops: number } | null>;
```

- `parseTabDelta` answers the parsed body or the `400` message: `expected a JSON object`, `invalid baseRev` (not a
  whole number from 0), `invalid digest` (not 64 lowercase hex), `invalid ops` (not a list, or an op not of the four
  shapes: an element an object with a string `id`, `at` a whole number from 0, `id` a string, `ids` a list of
  strings), `invalid tab` (not an object). A `tab.elements` is dropped: the elements come from the ops.
- `planTabDelta` answers null (save whole) when there is no base copy, the diff has more than `TAB_DELTA_MAX_OPS` ops,
  or the delta body is longer than `TAB_DELTA_MAX_SHARE` of the elements' JSON; otherwise the body to send, the
  digest of the current elements and the op count.

### REST

| Method | Path                                   | Gate                                                      | Success               | Failures                                                                                                                                                                                                       |
| ------ | -------------------------------------- | --------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/documents/:id/tabs/:tabId/delta` | not a token (`refuseTokenTabPut`); `gateEdit(..., tabId)` | 200 `{ rev, digest }` | 400 (the parse messages, `invalid tab`); 403; 404 (no document; a scoped link's deleted tab); 405 `use_changesets`; 409 `delta_refused` `{ reason }`, `empty_tab_overwrite_blocked`, `tab_busy`; 410; 413; 429 |

The refusal body: `{ error: 'delta_refused', reason: TabDeltaRefusal }`.

## Behaviour and state

`handleTabDelta(ctx, saving, tabId, owner)`:

1. `readBody`; `parseTabDelta`; a string answers `400 { error: 'bad_request', message }`.
2. `ops.length > TAB_DELTA_MAX_OPS` refuses `too_many_ops` before any read.
3. `getTab`. None refuses `no_base`; `stored.rev !== baseRev` refuses `stale_base`.
4. `elements = applyElementOps(stored.elements, ops)`; `elementsDigest(elements) !== digest` refuses
   `digest_mismatch`.
5. `writeTabSave(ctx, saving, tabId, owner, { ...tab, id: tabId, elements }, { stored })`: the PUT's pipeline, its
   first attempt reusing the read of step 3 (a lost race re-reads, as the PUT does).
6. Answer `{ rev, digest: elementsDigest(saved.elements) }`.

`writeTabSave` is `handleTabPut`'s body from `migrateIncomingTab` on, unchanged but for two things: it takes the
received body as an argument, and with `stored` its first attempt uses that read instead of `getTab`. It answers a
`Response` (any refusal) or the saved tab: the echo the PUT answers, and the stored elements.

## Errors and edge cases

- A body that rebuilds a malformed element (the ops carry one) passes the digest only if the editor sent that element;
  the schema gate then answers `400 invalid tab`, as a whole save of it would.
- A rebuilt empty tab over stored content without `X-Allow-Empty: 1` is `409 empty_tab_overwrite_blocked`, as whole.
- An op for an id the base lacks is a no-op in `applyElementOps`, so the digest mismatches: refused.
- A racing writer between step 3 and the write is the PUT's lost race: re-read, merged, written, or `409 tab_busy`.
- A save whose pipeline merged something (changesets, the ledger, comment authors) answers a digest other than the
  one sent; the editor drops its base copy.

## Security and trust

- The same doors as the whole save, in the same order: tokens refused before anything is read, then the owner, the
  document, `gateEdit` with the tab (a Participant or Viewer is `403`; a tab-scoped link its own tab only, keeping
  the stored name).
- The rebuild is never trusted: only a digest match reaches the write, and the write runs every whole-save rule.
- Size: the outer body cap bounds the request; `TAB_DELTA_MAX_OPS` bounds the apply; the storage layer measures the
  rebuilt tab (`storeTab`, `413`).

## Performance and limits

- Wire: a one-label edit on a 2,000-element tab is a delta body of 278 bytes against a whole body of 264,895 bytes
  (measured on the fixture of `apps/api/src/routes/tab-delta-route.test.ts`, "sends a small delta for a small edit on
  a 2,000-element tab", which holds it under 600 bytes). Moving 300 of those elements is a 47 KB delta; moving 600
  passes `TAB_DELTA_MAX_OPS` and saves whole.
- The api's added work per delta save: one `applyElementOps` (linear in elements plus ops) and two digests of the
  elements' JSON (0.8 ms each at 2,000 elements, measured), bounded by `TAB_DELTA_MAX_OPS`.
- The editor's added work (part 2): one `diffToElementOps` (already run for the room) and one digest per save.

## Observability

- `[tab-delta] refused { documentId, tabId, reason }` (info) on every refusal.
- `[tab-delta] saved { documentId, tabId, ops, matched }` (info) on every delta save, `matched` whether the stored
  digest is the one sent.
- The whole save's own lines (`[changeset] merged-on-save`, `lost-race`) as before.

## Testing

| Rule                                                     | Test                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The body's shapes and every `400` message                | `packages/api-schema/src/tab-delta.test.ts` "parseTabDelta"                             |
| The digest is SHA-256 of the elements' JSON              | `tab-delta.test.ts` "elementsDigest"                                                    |
| Delta or whole: no base, too many ops, too large a share | `tab-delta.test.ts` "planTabDelta"                                                      |
| A small edit on 2,000 elements sends a small delta       | `tab-delta-route.test.ts` "sends a small delta for a small edit on a 2,000-element tab" |
| The delta path stores exactly the whole save's tab       | `apps/api/src/routes/tab-delta-route.test.ts` "the delta path"                          |
| Each refusal, nothing written                            | `tab-delta-route.test.ts` "refusals fall back"                                          |
| The fallback whole save after a refusal lands            | `tab-delta-route.test.ts` "refusals fall back"                                          |
| Unseen changesets merge, the answer's digest says so     | `tab-delta-route.test.ts` "the delta path"                                              |
| Tokens refused; Editor yes, Participant and Viewer `403` | `tab-delta-route.test.ts` "share roles"                                                 |

## Constants and configuration

| Constant              | Value   | Why, and the safe range                                                     |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| `TAB_DELTA_MAX_OPS`   | 500     | A diff past it saves little and costs the api an apply; 100 to 2,000        |
| `TAB_DELTA_MAX_SHARE` | 0.5     | A delta over half the whole body is not worth the refusal risk; 0.25 to 0.9 |
| `TAB_DELTA_SEGMENT`   | `delta` | The path segment after the tab id                                           |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D7 to D9.
