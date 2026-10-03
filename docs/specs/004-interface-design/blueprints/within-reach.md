# Within reach: blueprint

Derived from [Within reach](../within-reach.md). The spec decides; this file adds engineering precision. The
surfaces that use the rule own their own blueprints ([Explorer Home, data](../../013-workspace/blueprints/explorer-home.md),
[Explorer Home, view](../../013-workspace/blueprints/explorer-home-view.md),
[Whiteboard dock](../../023-draw-mode/blueprints/whiteboard-dock.md)); this one is the allocation they share.

Scope, by file:

| File                                           | Role                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| `packages/api-schema/src/within-reach.ts`      | `withinReach`, `WithinReachUse`, `WithinReach`, `utcDay` |
| `packages/api-schema/src/within-reach.test.ts` | The rule, its ties and its merge property                |
| `packages/api-schema/src/index.ts`             | Re-exports the module                                    |

`@livediagram/api-schema` is the home because it is already the one package both the api worker and the live app
import (`D48`).

## Domain and naming

| Term          | Identifier                      | Meaning                                                        |
| ------------- | ------------------------------- | -------------------------------------------------------------- |
| Within reach  | `withinReach`, `WithinReach<T>` | The allocation, and the set it returns                         |
| Most used     | `WithinReach.mostUsed`          | The first group: the N items used most                         |
| Recent        | `WithinReach.recent`            | The second group: the N newest items not among the most used   |
| Use           | `WithinReachUse`                | What the surface measures of an item: `uses` and `lastUsedAt`  |
| Per-row count | `n`                             | N, the size of each group                                      |
| UTC day       | `utcDay(at)`                    | `YYYY-MM-DD` of an instant in UTC, the day a use is counted on |

Banned: "frecency" (the rule has no decay), "popular" for most used, "last used" as a group name (the group is
Recent).

## Behaviour and state

`withinReach(items, n, useOf)`, pure and total:

1. `ordered = items` with each item's `useOf(item)` read once.
2. `mostUsed` = the items with `uses > 0`, sorted by `uses` descending, then `lastUsedAt` descending, stably (equal
   items keep their given order), the first `n`.
3. `recent` = the items not in `mostUsed` (by identity), sorted by `lastUsedAt` descending, stably, the first `n`.
4. Return `{ mostUsed, recent }`. Neither group is padded: filling an empty place is the surface's business.

Invariants: no item in both groups; `mostUsed.length <= n`, `recent.length <= n`; every most-used item has
`uses > 0`; with `n <= 0` both groups are empty.

**Merge property** (spec "cheap to merge"): for lists `A` and `B`, with `flat(S) = [...S.mostUsed, ...S.recent]`,
`withinReach([...A, ...B], n)` equals `withinReach([...flat(withinReach(A, n)), ...flat(withinReach(B, n))], n)`
whenever the given order is the same total order on both sides (callers sort by a stable key, such as the
document id, before allocating).

## Interfaces and contracts

```ts
// packages/api-schema/src/within-reach.ts
export type WithinReachUse = { uses: number; lastUsedAt: number };
export type WithinReach<T> = { mostUsed: T[]; recent: T[] };
export function withinReach<T>(
  items: readonly T[],
  n: number,
  useOf: (item: T) => WithinReachUse,
): WithinReach<T>;
export function utcDay(at: number): string; // 'YYYY-MM-DD', UTC
```

Items are compared by identity; a caller never passes the same item twice.

## Errors and edge cases

| Case                             | Handling                                            |
| -------------------------------- | --------------------------------------------------- |
| Empty list                       | `{ mostUsed: [], recent: [] }`                      |
| Fewer than `n` used items        | `mostUsed` is short; `recent` still takes up to `n` |
| Fewer than `2n` items            | `recent` is short                                   |
| An item never used (`uses <= 0`) | Never most used; may be recent                      |
| Equal `uses` and `lastUsedAt`    | Given order                                         |
| `n` zero or negative             | Both groups empty                                   |

## Performance and limits

`O(k log k)` for `k` items: two sorts of copies. Callers pass at most a few hundred items (the dock's 20 kept shape
kinds; Home's 8 server items plus this browser's opened local documents).

## Testing

| Rule                                                | Test                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Most used by uses, ties to the newest, unused never | `packages/api-schema/src/within-reach.test.ts`                                                 |
| Recent newest first, never one of the most used     | same                                                                                           |
| Short groups, empty input, `n <= 0`, stable ties    | same                                                                                           |
| The merge property over two lists                   | same                                                                                           |
| The Shapes flyout unchanged                         | `apps/live/lib/whiteboard-shape-slots.test.ts`, `apps/live/e2e/whiteboard-shape-slots.spec.ts` |
| Jump back in's split, merge and alternation         | `apps/live/app/explorer/home/home-model.test.ts`                                               |

## Constants and configuration

None of its own: N, the measure of a use and its window belong to each surface (Shape slots: 3; Jump back in: 4,
over `WITHIN_REACH_USE_WINDOW_DAYS`).

## Defaults ledger

D48 in [DEFAULTS.md](DEFAULTS.md).
