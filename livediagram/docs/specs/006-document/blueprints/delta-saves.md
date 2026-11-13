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

| File                                                  | Responsibility                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `../packages/api-schema/src/tab-delta.ts`             | The envelope every product shares: constants, `TabDeltaOp`, `TabDeltaBody`, `parseTabDelta`, `elementsDigest`, `planTabDelta`, the refusal names |
| `apps/api/src/routes/tab-delta-route.ts`              | `handleTabDelta`: parse, refuse, rebuild with `applyElementOps`, prove by digest, hand to `writeTabSave`                                         |
| `apps/api/src/routes/tab-put-route.ts`                | `writeTabSave`: the whole-tab save's pipeline, shared by the PUT and the delta door; `handleTabPut`                                              |
| `apps/api/src/routes/document-subresource-routes.ts`  | Dispatch: `POST /api/documents/:id/tabs/:tabId/delta` behind the PUT's doors                                                                     |
| `apps/api/src/openapi/manifest.ts`                    | The route's OpenAPI entry                                                                                                                        |
| `../packages/workbench/src/lib/api/tab-delta-save.ts` | The editor's side: `createTabDeltaSaves`, the base copies (`hold`, `drop`) and `send`, one delta save or null to save whole                      |
| `../packages/workbench/src/lib/api/tab-calls.ts`      | `createTabCalls` with `delta`: holds the load's and the whole save's base copies, tries `send` before the whole `PUT`                            |
| `apps/editor/lib/api/tabs.ts`                         | livediagram's binding: `delta: { diff: diffToElementOps }`                                                                                       |

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

```ts
// @liveworkspace/workbench/lib/api/tab-delta-save
export const TAB_DELTA_BASES_MAX = 16;
export type TabDeltaConfig<E extends { id: string }> = {
  diff: (before: E[], after: E[]) => TabDeltaOp<E>[];
};
export function createTabDeltaSaves<E extends { id: string }>(deps: {
  diff: TabDeltaConfig<E>['diff'];
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  expectOkVoid: (res: Response, action: string) => Promise<void>;
  saveTimeoutSignal: (body: string) => AbortSignal;
  max?: number;
}): {
  hold(itemId: string, tabId: string, rev: number, elements: E[]): void;
  holdEcho(itemId: string, tabId: string, rev: number, echoed: E[], sent: readonly E[]): void;
  drop(itemId: string, tabId: string): void;
  base(itemId: string, tabId: string): { rev: number; elements: E[] } | null;
  send(args: {
    itemId: string;
    tabId: string;
    url: string; // the whole save's tab url; the delta posts to `${url}/delta`
    tab: { elements: E[] }; // the tab as the whole save would send it
    headers: Headers;
  }): Promise<{ rev: number | null } | null>;
};
// TabCallsConfig gains `delta?: TabDeltaConfig<Tab['elements'][number]>`; absent, every save is whole.
```

- `send` answers null (save whole) when there is no base copy, `planTabDelta` answers null, or the api answers
  `409 delta_refused` (the base copy is dropped). Any other failed answer throws through `expectOkVoid`, as the whole
  save's does. On `200` it holds `tab.elements` at the answer's `rev` when the answer's digest is the plan's, and
  drops the base copy otherwise; it answers `{ rev }` (null when the answer names none).

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

The editor (`createTabCalls` with `delta`):

1. `loadTabRevisioned` holds the answered elements, before `normalizeElement`, at the answered `rev`.
2. `saveTab` (not offline) builds the headers once, then `send` with the wire tab (`tabForWire`). An answer is the
   save's revision; null goes on to the whole `PUT` with the same headers.
3. The whole `PUT`'s answer: its `tab.rev` is the save's revision, and with `tab.elements` a list, they are held as
   the base copy at that revision (`holdEcho`: each echoed element whose JSON is the sent element's is held as the
   editor's own object, so the copy shares memory with the editor and the next diff skips it by reference).
4. `hold` keeps the held copy when it is for a newer revision than the one offered, refreshes the tab as the most
   recently used, and evicts the least recently used past `TAB_DELTA_BASES_MAX`.

The api (`handleTabDelta`), and below it `writeTabSave`:

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
- A delta that times out or loses its answer may still have landed: the next delta is `stale_base` and saves whole.
- A tab deleted and made again under its id starts its revisions again: the held newer copy is `stale_base` once,
  dropped, and the whole save's echo is held.
- The editor's element objects with a key order other than the stored ones' are `update` ops (the diff compares
  JSON), and the rebuild then carries the editor's order: the digest still matches.

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
- The editor's added work: one `diffToElementOps` and one digest per save. The digest is taken only once the delta
  is worth sending. Memory: at most `TAB_DELTA_BASES_MAX` base copies; a load's and a confirmed delta's share the
  editor's element objects, a whole save's echo is one parsed copy of the tab (already parsed for its `rev`).
- Measured on the local stack (the e2e stack, a 2,033-element Flowchart tab, one shape nudged): the whole save
  sent 714,131 bytes, the delta 733 bytes. A forced `delta_refused` cost the 734-byte delta plus the same whole
  save, and the next save was a delta again.
- Planning a 2,033-element save measured 1.7 ms over a base sharing the editor's objects and 3.9 ms over a freshly
  parsed one, against 1.0 ms to serialise the whole tab (median of 21, Node, a loaded machine).
- With two editors saving the same tab, each one's base copy goes stale at the other's save: its next save is a
  refused delta (about 1 KB) and then the whole tab, as every save was before. Peers advancing their base copies
  from the room is left to a follow-up.

## Observability

- `[tab-delta] refused { documentId, tabId, reason }` (info) on every refusal.
- `[tab-delta] saved { documentId, tabId, ops, matched }` (info) on every delta save, `matched` whether the stored
  digest is the one sent.
- The whole save's own lines (`[changeset] merged-on-save`, `lost-race`) as before.
- The editor: `[tab-delta] refused { tabId, reason }` (a `debugLog` trace line) when it falls back to the whole save.

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
| The editor's base copies: newer kept, bound, dropped     | `packages/workbench/src/lib/api/tab-delta-save.test.ts` "base copies"                   |
| The editor sends a delta, or null to save whole          | `tab-delta-save.test.ts` "send"                                                         |
| A refusal falls back to the whole PUT in the same save   | `apps/editor/lib/api/tab-delta-save.test.ts` "a refused delta saves whole"              |
| The load and the whole save hold the base copy           | `apps/editor/lib/api/tab-delta-save.test.ts` "base copy sources"                        |
| A small edit on 2,000 elements sends a small delta       | `apps/editor/lib/api/tab-delta-save.test.ts` "a small edit on a 2,000-element tab"      |
| Offline documents never send one; other editors whole    | `apps/editor/lib/api/tab-delta-save.test.ts`, the other editors' existing save tests    |

## Constants and configuration

| Constant              | Value   | Why, and the safe range                                                     |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| `TAB_DELTA_MAX_OPS`   | 500     | A diff past it saves little and costs the api an apply; 100 to 2,000        |
| `TAB_DELTA_MAX_SHARE` | 0.5     | A delta over half the whole body is not worth the refusal risk; 0.25 to 0.9 |
| `TAB_DELTA_SEGMENT`   | `delta` | The path segment after the tab id                                           |
| `TAB_DELTA_BASES_MAX` | 16      | Base copies the editor holds, most recently used; 4 to 64                   |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D7 to D10.
