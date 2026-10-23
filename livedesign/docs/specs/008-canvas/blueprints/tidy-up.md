# Tidy Up: blueprint

Derived from [Layout cleanup](../layout-cleanup.md), for the tidiers the command palette runs: Auto-align and
each Auto Layout style, how a tidier is judged, and what one run costs. The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                 | Role                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/live/lib/auto-layout-choices.ts`               | Each choice's name and line, beside its command name, options and telemetry type             |
| `apps/live/lib/tab-cleanup.ts`                       | `cleanupElements`: the one transform the preview and the press both run; settles a layout    |
| `apps/live/lib/tidy-engine.ts`                       | `loadTidyEngine`, `tidyEngine`, `withTidyEngine`: the tidiers loaded on demand               |
| `apps/live/lib/locked-element-ids.ts`                | `lockedElementIds`: the lock rule, light enough for callers that do not tidy                 |
| `apps/live/lib/tidy-verdict.ts`                      | `assessCleanup`, `cleanupVerdict`: whether a tidier is offered, its line and notice          |
| `apps/live/lib/auto-align.ts`, `auto-align-lines.ts` | Auto-align: per-element sizes, positions by shared lines, even spacing, the overlap guard    |
| `packages/design/src/auto-layout-tidy.ts`          | The tidy profile: direction, anchoring, clear placement, routing hand-off, mindmap fit       |
| `packages/design/src/auto-layout-tidy-graph.ts`    | Units, riders, dashed arrows: the graph of nodes the profile lays out                        |
| `packages/design/src/auto-layout-tidy-rank.ts`     | Drawn-order loop breaking, side steps, zero-length side edges in the layering                |
| `packages/design/src/auto-layout-tidy-flow.ts`     | One component's flow positions: blocks, label-sized gaps, lane centres                       |
| `packages/design/src/auto-layout-route.ts`         | Square arrow routes around the boxes                                                         |
| `packages/design/src/auto-layout-route-grid.ts`    | Bucket grid of the boxes a route must clear                                                  |
| `apps/live/hooks/canvas/useCleanupPreview.ts`        | `previewCleanup(kind)` / `endCleanupPreview()`, `assessCleanupKind`: snapshot, revert, judge |
| `apps/live/app/design/[id]/useEditorState.ts`      | Mounts `useCleanupPreview` and returns its functions                                         |

## Domain and naming

| Term         | Identifier                                                                                         | Meaning                                               |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tidier       | `CleanupKind = 'align' \| AutoLayoutChoice`                                                        | Auto-align or one Auto Layout style                   |
| Verdict      | `CleanupVerdict` (`ok`, `unchanged`, `covers`, `leaves-container`, `rearranges-lanes`, `unsuited`) | Whether a tidier is offered, and why not              |
| Tidy profile | `tidyLayoutElements`                                                                               | The editor's Auto Layout, as opposed to graph input's |
| Unit / rider | `tidyGraph(...).units`, `moverOf`                                                                  | What moves as one block / with its node               |

"Cleanup" is the name of the transform (`cleanupElements`, `useCleanupPreview`).

## Behaviour and state

- **A command** (`autoAlignTab` / `autoLayoutTab(kind)` in `useTabCanvas`) is refused on a locked tab, a read-only
  session or an empty tab, as every structural edit is.
- **Refusal** (`useTabCanvas.refused`): a run that is not `judged` runs `assessCleanup` on the live tab; a verdict
  other than `ok` calls `notify(verdictNotice(name, verdict))` (an info toast) and commits nothing.
- `useCleanupPreview` state: `originalsRef: { tabId, elements } | null`. First preview snapshots the active tab;
  later previews reuse it while the tab id matches; `endCleanupPreview` restores only the tab it snapshotted and
  clears the ref. `previewingRef` is true from the first preview to the revert.

## Interfaces and contracts

```ts
assessCleanup(elements, kind, layers?): CleanupVerdict; // 'unsuited' first for a mindmap that does not fit
cleanupVerdict(before, after, { lanes?: boolean }): CleanupVerdict; // lanes: false for Auto-align
verdictLine(v): string | null; // the choice's line; null for 'ok'
verdictNotice(name, v): string | null; // the palette's notice; null for 'ok'
useTabCanvas({ notify?: (message: string) => void, ... }); // autoAlignTab / autoLayoutTab take { judged?: boolean }
```

## Data and persistence

Nothing new is stored. A preview mutates `tabs` in the present only (`tickTabs`); autosave skips while
`previewingRef` is set; a press persists exactly as the command palette's command does.

## Errors and edge cases

- Tab switch with a preview on screen: the revert writes the snapshot back to its own tab id only.
- Preview called with `editsBlocked`: no-op. Preview on an empty tab: no-op (no snapshot taken).
- `endPreview` with nothing in flight: no-op.
- A remote edit arriving mid-preview: the revert restores the snapshot, which drops that edit from the present
  until the room's next state; same trade the style preview accepts (D82).

## Security and trust

The room and the api decide what a session may write; a Participant who forced a tidier would still have its
element moves refused by `applyParticipantOp`.

## Performance and limits

- A run (or a preview) runs `cleanupElements` once over the tab. Measured in `tab-cleanup.perf.test.ts` (D83): budget
  `TIDY_PREVIEW_BUDGET_MS` per run at `TIDY_PREVIEW_WORST_CASE_NODES` wired nodes, widened by `cpuBudgetMs` on CI
  (whose coverage-instrumented runners measure Smart at about 100 ms, against 24 ms on an M-series Mac). Measured on an M-series Mac,
  best of three, with the tidy profile: the checkout template 0.2 to 1.4 ms per tidier; 50 nodes Smart 7 ms;
  100 nodes Smart 18 ms; 300 nodes (one pass, past `SETTLE_ELEMENT_LIMIT`) Smart about 40 ms, Tree 52 ms,
  Mindmap 5 ms, Auto-align 3.6 ms. Crossing reduction builds each node's neighbours once and buckets edges by rank
  pair (it rescanned every edge per node per sweep: 166 ms of a 210 ms pass at 300 nodes, now 8 ms), and counts
  each pair's crossings as inversions with a Fenwick tree rather than testing every pair of edges. Placement works
  out each rank's spacing once, not on every sweep, and the router tests a leg only against the boxes in the grid
  cells it passes (`auto-layout-route-grid.ts`, `ROUTE_GRID_CELL`). Together these took the 300-node pass, best of
  fifteen CPU-time runs, from Smart 36.6 / Flow down 34.3 / Flow right 32.1 ms to 22.0 / 17.5 / 18.8 ms: CI runs
  this test under coverage on slower runners, where the earlier figures read 156 to 170 ms and broke the budget.
- **First load:** the tidy profile, its router, the verdicts and `cleanupElements` load on demand
  (`lib/tidy-engine.ts`): a palette command loads them at the press. The design page's initial JS, measured as the
  gzip sum of the scripts `out/design/placeholder.html` loads: 1,334.8 KiB before this work, 1,343.9 KiB with
  the tidiers static, 1,337.1 KiB loaded on demand. The remaining 2.3 KiB is Auto-align's line logic, which the AI
  apply path runs at first load.
- Judging one tidier costs one cleanup plus the overlap sweep: at 300 nodes one layout takes about 130 ms when it
  settles (D101).

## Observability

- Run: the tidier's existing `Tab·Aligned[·type]` from `autoLayoutTab` / `autoAlignTab`.

## Testing

| Spec rule                                                                                                   | Test                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Snapshot, no stacking, tab-scoped revert                                                                    | `useCleanupPreview.test.ts`                                                             |
| Hover budget at the worst case                                                                              | `tab-cleanup.perf.test.ts`                                                              |
| Palette refusal with a notice                                                                               | `useTabCanvas.test.ts`                                                                  |
| Every verdict and its copy                                                                                  | `tidy-verdict.test.ts`                                                                  |
| Checkout survives Auto-align, Smart, Down                                                                   | `tidy-verdict.test.ts`                                                                  |
| A second press finds a template tidy                                                                        | `tidy-verdict.test.ts`                                                                  |
| Auto-align keeps lines, spacing, no overlap                                                                 | `auto-align-lines.test.ts`, `auto-align.test.ts`                                        |
| Tidy profile: spine, side steps, square routes clear of boxes, title, settled, units, riders, dashed arrows | `packages/design/src/auto-layout-tidy.test.ts`                                        |
| The route grid misses no box a leg could hit; crossings match a pair-by-pair count                          | `packages/design/src/auto-layout-route-grid.test.ts`, `auto-layout-crossings.test.ts` |

## Constants and configuration

| Constant                             | Value   | Provenance                                                                                                           | Safe range      |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------- | --------------- |
| `TIDY_PREVIEW_WORST_CASE_NODES`      | 300     | A dense hand-drawn diagram (D83)                                                                                     | —               |
| `TIDY_PREVIEW_BUDGET_MS`             | 100     | One run must feel immediate (D83); asserted as `cpuBudgetMs` of it, 300 on CI's coverage runners (`CI_CPU_HEADROOM`) | 50–200 (CI: 3x) |
| `ALIGN_TOLERANCE`                    | 8 px    | Hand drift under one grid step (D99)                                                                                 | 4–10            |
| `LINK_TOLERANCE`                     | 16 px   | An arrow's ends a little out of line (D99)                                                                           | 10–24           |
| `MAX_ALIGN_PASSES`                   | 4       | Two is usual (D100)                                                                                                  | 2–6             |
| `MAX_LAYOUT_PASSES`                  | 3       | A hand-drawn tree takes two (D100)                                                                                   | 1–4             |
| `SETTLE_ELEMENT_LIMIT`               | 300     | Three passes stay in the run budget below it (D100)                                                                  | 150–500         |
| `IN_LINE_PX`                         | 12      | Drawn in line, not a layout's lean (D102)                                                                            | 8–20            |
| `TIDY_RANK_GAP` / `TIDY_SIBLING_GAP` | 56 / 48 | The checkout's own rows are 44 apart (D103)                                                                          | 40–90           |
| `TIDY_CLEARANCE`                     | 24      | Room between the block and a title (D103)                                                                            | 16–40           |
| `CLEARANCE` / `LOOP_OFFSET` (route)  | 10 / 32 | A leg's gap to a box; a loop's lane outside (D104)                                                                   | 6–16 / 24–48    |
| `ROUTE_GRID_CELL`                    | 160 px  | About one box and its gap: a leg spans a few cells                                                                   | 80–400          |
| `LANE_GAP` / `LANE_GAP_DRIFT`        | 48 / 16 | A swimlane's lanes are 36 apart; a layout's own spacing (D105)                                                       | 24–64 / 8–24    |

## Defaults ledger

D81 to D86 and D99 to D105 in [DEFAULTS.md](DEFAULTS.md).
