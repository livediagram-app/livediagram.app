# Tidy Up: blueprint

> **livehuddle has no Tidy Up button** (Work Tracker #583). Auto Layout left its popover first (Work Tracker #423,
> part 4), then the button, the popover, the hover preview and the `UI·Opened·TidyUp` event went, since nothing
> opened them: `TidyUpPopover`, `tidy-up-actions.ts`, `tidy-up-drawings.tsx`, `useCleanupPreview`, the
> `'tidy-up'` dock panel, the `tidyUp` chrome prop and the tile line (`verdictLine`) are deleted, and `autoAlignTab`
> takes no `judged` flag.
> Auto-align stays, as the command palette's **Auto-align to Grid**. livediagram keeps the whole design
> ([its blueprint there](../../../../../livediagram/docs/specs/008-canvas/blueprints/tidy-up.md)). The
> `packages/document` tidy profile this page names stays, Work Tracker #459's.

Derived from [Layout cleanup](../layout-cleanup.md#no-tidy-up-button). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                   | Role                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `apps/editor/lib/tab-cleanup.ts`                       | `cleanupElements`: the one transform the command runs; settles a layout                   |
| `apps/editor/lib/tidy-engine.ts`                       | `loadTidyEngine`, `tidyEngine`, `withTidyEngine`: the tidiers loaded on demand            |
| `apps/editor/lib/tidy-verdict.ts`                      | `assessCleanup`, `cleanupVerdict`: whether Auto-align would help, and its notice          |
| `apps/editor/lib/auto-align.ts`, `auto-align-lines.ts` | Auto-align: per-element sizes, positions by shared lines, even spacing, the overlap guard |
| `apps/editor/hooks/canvas/useTabCanvas.ts`             | `autoAlignTab`: judge, refuse with a notice or commit one undoable step                   |
| `apps/editor/lib/editor-commands.ts`                   | The `auto-align` command, **Auto-align to Grid**                                          |
| `livediagram/packages/document/src/auto-layout-tidy.ts`            | The tidy profile (livediagram's Tidy Up; kept for Work Tracker #459 to decide)            |
| `livediagram/packages/document/src/auto-layout-route.ts`           | Square arrow routes around the boxes                                                      |
| `../packages/model-core/src/auto-layout-route-grid.ts` | Bucket grid of the boxes a route must clear                                               |

## Domain and naming

| Term    | Identifier                                                         | Meaning                                   |
| ------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Tidier  | `CleanupKind = 'align'`                                            | Auto-align, the one tidier livehuddle has |
| Verdict | `CleanupVerdict` (`ok`, `unchanged`, `covers`, `leaves-container`) | Whether Auto-align helps, and why not     |

"Cleanup" is the name of the transform (`cleanupElements`); "Tidy Up" was the surface, and is livediagram's.

## Behaviour and state

- **Offered** to a session the palette offers editing commands to (not `isReadOnly`). `autoAlignTab` is a no-op
  while `editsBlocked` (a Participant is read-only for structure) or on an empty tab.
- **Refusal** (`useTabCanvas.refused`): every press runs `assessCleanup` on the live tab; a verdict other than `ok`
  calls `notify(verdictNotice('Auto-align', verdict))` (an info toast) and commits nothing.
- **Press**: `commit(cleanupElements)`, one undoable step, then `Tab·Aligned`.

## Interfaces and contracts

```ts
assessCleanup(elements): CleanupVerdict;
cleanupVerdict(before, after): CleanupVerdict;
verdictNotice(name, v): string | null; // the palette's notice; null for 'ok'
useTabCanvas({ notify?: (message: string) => void, ... }); // autoAlignTab()
```

## Data and persistence

Nothing new is stored. A press persists as any commit does.

## Errors and edge cases

- An empty tab: no-op. `editsBlocked`: no-op.
- A verdict other than `ok`: a notice, no commit.

## Security and trust

Presentation only. The room and the api decide what a session may write; a Participant's element moves are refused
by `applyParticipantOp`.

## Performance and limits

- One press runs `cleanupElements` once over the tab. Measured in `tab-cleanup.perf.test.ts` (D83): budget
  `TIDY_PREVIEW_BUDGET_MS` per run at `TIDY_PREVIEW_WORST_CASE_NODES` wired nodes, widened by `cpuBudgetMs` on CI.
  Auto-align at 300 nodes measured 3.6 ms on an M-series Mac, best of three.
- **First load:** the tidiers, the verdicts and `cleanupElements` load on demand (`lib/tidy-engine.ts`), at the
  palette command's press.

## Observability

- Press: `Tab·Aligned` from `autoAlignTab`. A refusal sends nothing.

## Testing

| Spec rule                                   | Test                                             |
| ------------------------------------------- | ------------------------------------------------ |
| Palette refusal with a notice               | `useTabCanvas.test.ts`                           |
| Every verdict and its copy                  | `tidy-verdict.test.ts`                           |
| A second press finds a template tidy        | `tidy-verdict.test.ts`                           |
| Auto-align keeps lines, spacing, no overlap | `auto-align-lines.test.ts`, `auto-align.test.ts` |
| Budget at the worst case                    | `tab-cleanup.perf.test.ts`                       |
| The tidiers stay out of the first load      | `tidy-engine.test.ts`                            |

## Constants and configuration

| Constant                        | Value | Provenance                                                                                       | Safe range      |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------ | --------------- |
| `TIDY_PREVIEW_WORST_CASE_NODES` | 300   | A dense hand-drawn board (D83)                                                                   | n/a             |
| `TIDY_PREVIEW_BUDGET_MS`        | 100   | A press must feel immediate (D83); asserted as `cpuBudgetMs` of it, 300 on CI's coverage runners | 50–200 (CI: 3x) |
| `ALIGN_TOLERANCE`               | 8 px  | Hand drift under one grid step (D99)                                                             | 4–10            |
| `LINK_TOLERANCE`                | 16 px | An arrow's ends a little out of line (D99)                                                       | 10–24           |
| `MAX_ALIGN_PASSES`              | 4     | Two is usual (D100)                                                                              | 2–6             |

## Defaults ledger

D83, D99 and D100 in [DEFAULTS.md](DEFAULTS.md). D81, D82, D84 to D86 and D101 to D105 were the popover's and
Auto Layout's, and stay in the ledger as livediagram's record.
