# Tidy Up: blueprint

Derived from [Layout cleanup](../layout-cleanup.md#the-tidy-up-button). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                                              | Role                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/live/lib/auto-layout-choices.ts`                                            | Each choice's tile name and line, beside its command name, options and telemetry type      |
| `apps/live/lib/tab-cleanup.ts`                                                    | `cleanupElements`: the one transform the preview and the press both run; settles a layout  |
| `apps/live/lib/tidy-engine.ts`                                                    | `loadTidyEngine`, `tidyEngine`, `withTidyEngine`: the tidiers loaded on demand             |
| `apps/live/lib/locked-element-ids.ts`                                             | `lockedElementIds`: the lock rule, light enough for callers that do not tidy               |
| `apps/live/lib/tidy-verdict.ts`                                                   | `assessCleanup`, `cleanupVerdict`: whether a tidier is offered, its tile line and notice   |
| `apps/live/lib/auto-align.ts`, `auto-align-lines.ts`                              | Auto-align: per-element sizes, positions by shared lines, even spacing, the overlap guard  |
| `packages/document/src/auto-layout-tidy.ts`                                       | The tidy profile: direction, anchoring, clear placement, routing hand-off, mindmap fit     |
| `packages/document/src/auto-layout-tidy-graph.ts`                                 | Units, riders, dashed arrows: the graph of nodes the profile lays out                      |
| `packages/document/src/auto-layout-tidy-rank.ts`                                  | Drawn-order loop breaking, side steps, zero-length side edges in the layering              |
| `packages/document/src/auto-layout-tidy-flow.ts`                                  | One component's flow positions: blocks, label-sized gaps, lane centres                     |
| `packages/document/src/auto-layout-route.ts`                                      | Square arrow routes around the boxes                                                       |
| `packages/document/src/auto-layout-route-grid.ts`                                 | Bucket grid of the boxes a route must clear                                                |
| `apps/live/hooks/canvas/useCleanupPreview.ts`                                     | `previewCleanup(kind)` / `endCleanupPreview()`: snapshot, present-only ticks, revert       |
| `apps/live/components/canvas/tidy-up-actions.ts`                                  | `TidyUpActions` and the pure gate `tidyUpOffered`                                          |
| `apps/live/components/canvas/TidyUpPopover.tsx`                                   | The popover: the Auto Layout tiles, the Auto-align row, the empty and locked notes, Escape |
| `apps/live/components/canvas/tidy-up-drawings.tsx`                                | The five tile drawings                                                                     |
| `packages/ui/src/icons/editor-chrome.tsx`                                         | `TidyUpIcon`: Lucide `brush-cleaning` at the cluster's 20 px                               |
| `apps/live/components/canvas/LayersThemeStrip.tsx`                                | The Tidy Up segment, first in the strip                                                    |
| `apps/live/hooks/canvas/useDockPopovers.ts`                                       | `'tidy-up'` in `DockPanel`, its width, its `UI·Opened·TidyUp`                              |
| `apps/live/components/canvas/useCanvasChromePanels.tsx`                           | `tidyUpPopoverEl`, and closing it when the button goes                                     |
| `apps/live/components/canvas/CanvasChrome.tsx`                                    | Passes the segment to the strip, renders the popover beside the corner layer               |
| `apps/live/components/canvas/Canvas.types.ts`                                     | `tidyUp?: TidyUpActions`: present only when the session offers the button                  |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                                | Builds `tidyUp` from the editor state                                                      |
| `apps/live/app/document/[id]/useEditorState.ts`                                   | Mounts `useCleanupPreview` and returns its two functions                                   |
| `apps/live/lib/help-articles.ts`                                                  | `layoutCleanup` → `tools/layout-cleanup`, the popover's help link                          |
| `apps/telemetry/app/catalogue/features.ts`, `content.ts`, `event-explanations.ts` | `TIDY_UP_OPENED` in Tab Actions, and its sentence                                          |

## Domain and naming

| Term            | Identifier                                                                                         | Meaning                                               |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tidy Up button  | segment label `Tidy Up`, `data-tour-id="tidy-up"`                                                  | The cluster segment left of Layers                    |
| Tidy Up popover | `TidyUpPopover`, dock panel `'tidy-up'`                                                            | What the button opens                                 |
| Tidier          | `CleanupKind = 'align' \| AutoLayoutChoice`                                                        | Auto-align or one Auto Layout style                   |
| Tile            | one `AutoLayoutChoice`, in `AUTO_LAYOUT_TILE_ORDER`                                                | A style's button in the grid                          |
| Tidy Up actions | `TidyUpActions = { run, preview, endPreview, assess, blocked }`                                    | What the chrome is handed; absent means no button     |
| Verdict         | `CleanupVerdict` (`ok`, `unchanged`, `covers`, `leaves-container`, `rearranges-lanes`, `unsuited`) | Whether a tidier is offered, and why not              |
| Tidy profile    | `tidyLayoutElements`                                                                               | The editor's Auto Layout, as opposed to graph input's |
| Unit / rider    | `tidyGraph(...).units`, `moverOf`                                                                  | What moves as one block / with its node               |

"Cleanup" stays the name of the transform (`cleanupElements`, `useCleanupPreview`); "Tidy Up" is only the
surface.

## Behaviour and state

- **Offered** when, all together: `editorMode === 'diagram'`, not `isReadOnly` (a Participant and a Viewer are
  read-only for structure), not `zenMode`, not an embed (a phone included). `EditorCanvasHost` passes `tidyUp` only
  for an Editor's non-embed session; `tidyUpOffered` adds the mode and Zen gates.
- **Open state** is the dock slot: `activeDockPanel === 'tidy-up'`. Leaving Diagram mode or the button
  disappearing closes it (an effect in `useCanvasChromePanels`, as Slides and the Plan popovers do).
- **Blocked**: `tidyUp.blocked = activeTabLocked`. The popover renders every tile `disabled` under the locked
  note.
- **Empty**: no element on the active tab. Every tile `disabled` under the empty note. (A tab with elements but no
  arrows still offers Auto Layout: the transform passes unwired elements through unchanged, D81.)
- **Preview** (desktop mouse only, `onMouseHover`): `pointerenter` on a tile → `preview(kind)`; `pointerleave` →
  `endPreview()`. The popover calls `useRevertOnUnmount(endPreview)` so closing mid-hover reverts.
- **Press**: `endPreview()` then `run(kind, judged)` then `onClose()`, in that order in one handler, so the revert
  and the commit are two updaters in one React batch and undo lands on the pre-hover layout. `judged` is true when the
  tile's verdict is in; otherwise the command judges it first.
- **Verdicts** (`useVerdicts` in `TidyUpPopover`): not on an inert tab; otherwise one `assess(kind)` per
  `setTimeout(0)` task after mount, in tile order then Auto-align, each stored once. `assess` is
  `useCleanupPreview.assessCleanupKind`, which judges the pre-hover snapshot while a preview is on screen. A tile
  whose verdict is not `ok` is `disabled` and shows `verdictLine`; no hover preview runs for it. Every layout tile
  `rearranges-lanes` → the caption is `TIDY_LANES_NOTE`.
- **Refusal** (`useTabCanvas.refused`): a press that is not `judged` runs `assessCleanup` on the live tab; a verdict
  other than `ok` calls `notify(verdictNotice(name, verdict))` (an info toast) and commits nothing.
- `useCleanupPreview` state: `originalsRef: { tabId, elements } | null`. First preview snapshots the active tab;
  later previews reuse it while the tab id matches; `endCleanupPreview` restores only the tab it snapshotted and
  clears the ref. `previewingRef` is true from the first preview to the revert.

## Interfaces and contracts

```ts
type TidyUpActions = {
  run: (kind: CleanupKind, judged: boolean) => void; // autoAlignTab({ judged }) / autoLayoutTab(kind, { judged })
  preview: (kind: CleanupKind) => void;
  endPreview: () => void;
  assess: (kind: CleanupKind) => CleanupVerdict;
  blocked: boolean;
};

assessCleanup(elements, kind, layers?): CleanupVerdict; // 'unsuited' first for a mindmap that does not fit
cleanupVerdict(before, after, { lanes?: boolean }): CleanupVerdict; // lanes: false for Auto-align
verdictLine(v): string | null; // the tile line; null for 'ok'
verdictNotice(name, v): string | null; // the palette's notice; null for 'ok'
useTabCanvas({ notify?: (message: string) => void, ... }); // autoAlignTab / autoLayoutTab take { judged?: boolean }
```

`tidyUpOffered({ actions, editorMode, zenMode }): boolean` is the one gate, read by both
`CanvasChrome` (the segment) and `useCanvasChromePanels` (the popover and its auto-close).

`TidyUpPopover` props: `{ actions: TidyUpActions; empty: boolean; anchor?: DockAnchor; onClose: () => void }`.
Escape: a `window` `keydown` listener while mounted calls `onClose` (the cluster popovers have no Escape of
their own; D86).
`ChoiceSpec` gains `tileName: string` and `tileLine: string` (the spec's table, verbatim). The Auto-align row's
copy lives in `TidyUpPopover` as `ALIGN_NAME` / `ALIGN_LINE`.

## Data and persistence

Nothing new is stored. A preview mutates `tabs` in the present only (`tickTabs`); autosave skips while
`previewingRef` is set; a press persists exactly as the command palette's command does.

## Errors and edge cases

- Tab switch with a preview on screen: the revert writes the snapshot back to its own tab id only.
- Preview called with `editsBlocked`: no-op. Preview on an empty tab: no-op (no snapshot taken).
- `endPreview` with nothing in flight: no-op.
- The popover closing by outside press, Escape, a second press of the button, or a mode switch: unmount reverts.
- A remote edit arriving mid-preview: the revert restores the snapshot, which drops that edit from the present
  until the room's next state; same trade the style preview accepts (D82).

## Security and trust

Presentation only. The room and the api decide what a session may write; a Participant who forced the popover
open would still have its element moves refused by `applyParticipantOp`.

## Performance and limits

- Opening the popover costs one render of six buttons and five static SVGs; nothing is computed until a hover.
- A hover runs `cleanupElements` once over the tab. Measured in `tab-cleanup.perf.test.ts` (D83): budget
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
  (`lib/tidy-engine.ts`): the popover loads them as it opens and judges once they are here; a palette command loads
  them at the press; a hover before they arrive shows nothing. The document page's initial JS, measured as the
  gzip sum of the scripts `out/document/placeholder.html` loads: 1,334.8 KiB before this work, 1,343.9 KiB with
  the tidiers static, 1,337.1 KiB loaded on demand. The remaining 2.3 KiB is Auto-align's line logic, which the AI
  apply path runs at first load.
- Judging the six tidiers costs six cleanups plus the overlap sweep: 2.9 ms on the checkout, 21 ms at 50 nodes,
  58 ms at 100, about 450 ms at 300 in all. It runs one tidier per task after the popover paints (D101), so the
  longest single task at 300 nodes is one layout (about 130 ms when it settles), never the six together.
- The popover is loaded with `next/dynamic`, like `SessionPopover`, so a visit that never opens it pays
  nothing for it (D84). What the main chunk gains is `tidy-up-actions.ts` and one 20 px glyph.

## Presentation and UX

- Popover: `MovablePanel` as a popover, title `Tidy Up`, help article `layoutCleanup`, width `w-80` (320 px,
  `POPOVER_WIDTHS['tidy-up'] = 320`).
- Group 1: caption "Rearrange shapes from the arrows between them." then a `grid-cols-2 gap-2` of tiles. Tile:
  rounded-lg border, a 72×44 drawing on a tinted ground, the name (Title Case, `text-sm font-medium`), the
  line (`text-xs` muted). Hover: brand border and ground; focus: the brand `focus-visible` ring. Smart spans both
  columns with its drawing beside its words (D85).
- Group 2: hairline, then the Auto-align row: glyph, name, line, full width.
- Notes: the empty note and the locked note replace the caption, in muted text.
- Button glyph: Lucide `brush-cleaning` at 20 px, the cluster step.

## Accessibility

- Every tile is a `<button type="button">` with its name as accessible name and its line as
  `aria-describedby`; drawings are `aria-hidden`.
- Disabled tiles use the `disabled` attribute (skipped by Tab, announced as dimmed).
- Focus ring: the shared `focus-visible` brand ring. Contrast: names on slate-900 / slate-50, lines on
  slate-500 / slate-400, both ≥ 4.5:1 on their ground.
- No motion beyond the colour transition, which `prefers-reduced-motion` drops.

## Web Experience

No layout shift: the popover is portalled above the cluster. INP: a hover's work is one `cleanupElements` plus a
present-only tick, inside the budget above. No LCP impact (lazy).

## Observability

- Open: `track('UI', 'Opened', 'TidyUp')` in `trackDockPanelOpened`.
- Press: the tidier's existing `Tab·Aligned[·type]` from `autoLayoutTab` / `autoAlignTab`.

## Testing

| Spec rule                                                                                                   | Test                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Button left of Layers, only when offered                                                                    | `LayersThemeStrip.test.tsx`                                                             |
| Diagram-only, Editor-only, not in Zen                                                                       | `tidy-up-actions.test.ts` (`tidyUpOffered`)                                             |
| Five tiles in order + Auto-align row                                                                        | `TidyUpPopover.test.tsx`                                                                |
| Press ends preview, runs, closes, in order                                                                  | `TidyUpPopover.test.tsx`                                                                |
| Mouse hover previews, touch does not                                                                        | `TidyUpPopover.test.tsx`                                                                |
| Unmount reverts                                                                                             | `TidyUpPopover.test.tsx`                                                                |
| Empty and locked notes, tiles disabled                                                                      | `TidyUpPopover.test.tsx`                                                                |
| Snapshot, no stacking, tab-scoped revert                                                                    | `useCleanupPreview.test.ts`                                                             |
| Telemetry on open                                                                                           | `useDockPopovers.test.tsx`                                                              |
| Hover budget at the worst case                                                                              | `tab-cleanup.perf.test.ts`                                                              |
| Greyed-out tiles, reasons, lanes note                                                                       | `TidyUpPopover.test.tsx`                                                                |
| Judged one per task; judged flag on press                                                                   | `TidyUpPopover.test.tsx`                                                                |
| Palette refusal with a notice                                                                               | `useTabCanvas.test.ts`                                                                  |
| Every verdict and its copy                                                                                  | `tidy-verdict.test.ts`                                                                  |
| Checkout survives Auto-align, Smart, Down                                                                   | `tidy-verdict.test.ts`                                                                  |
| A second press finds a template tidy                                                                        | `tidy-verdict.test.ts`                                                                  |
| Auto-align keeps lines, spacing, no overlap                                                                 | `auto-align-lines.test.ts`, `auto-align.test.ts`                                        |
| Tidy profile: spine, side steps, square routes clear of boxes, title, settled, units, riders, dashed arrows | `packages/document/src/auto-layout-tidy.test.ts`                                        |
| The route grid misses no box a leg could hit; crossings match a pair-by-pair count                          | `packages/document/src/auto-layout-route-grid.test.ts`, `auto-layout-crossings.test.ts` |

## Constants and configuration

| Constant                             | Value   | Provenance                                                     | Safe range   |
| ------------------------------------ | ------- | -------------------------------------------------------------- | ------------ |
| `POPOVER_WIDTHS['tidy-up']`          | 320     | Two 152 px tiles, gap and padding                              | 288–384      |
| `TIDY_PREVIEW_WORST_CASE_NODES`      | 300     | A dense hand-drawn diagram (D83)                               | —            |
| `TIDY_PREVIEW_BUDGET_MS`             | 100     | One hover must feel immediate (D83)                            | 50–200       |
| `ALIGN_TOLERANCE`                    | 8 px    | Hand drift under one grid step (D99)                           | 4–10         |
| `LINK_TOLERANCE`                     | 16 px   | An arrow's ends a little out of line (D99)                     | 10–24        |
| `MAX_ALIGN_PASSES`                   | 4       | Two is usual (D100)                                            | 2–6          |
| `MAX_LAYOUT_PASSES`                  | 3       | A hand-drawn tree takes two (D100)                             | 1–4          |
| `SETTLE_ELEMENT_LIMIT`               | 300     | Three passes stay in the hover budget below it (D100)          | 150–500      |
| `IN_LINE_PX`                         | 12      | Drawn in line, not a layout's lean (D102)                      | 8–20         |
| `TIDY_RANK_GAP` / `TIDY_SIBLING_GAP` | 56 / 48 | The checkout's own rows are 44 apart (D103)                    | 40–90        |
| `TIDY_CLEARANCE`                     | 24      | Room between the block and a title (D103)                      | 16–40        |
| `CLEARANCE` / `LOOP_OFFSET` (route)  | 10 / 32 | A leg's gap to a box; a loop's lane outside (D104)             | 6–16 / 24–48 |
| `ROUTE_GRID_CELL`                    | 160 px  | About one box and its gap: a leg spans a few cells             | 80–400       |
| `LANE_GAP` / `LANE_GAP_DRIFT`        | 48 / 16 | A swimlane's lanes are 36 apart; a layout's own spacing (D105) | 24–64 / 8–24 |

## Defaults ledger

D81 to D86 and D99 to D105 in [DEFAULTS.md](DEFAULTS.md).
