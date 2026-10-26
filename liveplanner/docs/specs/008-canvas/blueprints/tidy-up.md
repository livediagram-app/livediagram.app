# Tidy Up: blueprint

Derived from [Layout cleanup](../layout-cleanup.md). The editor holds the tidiers (Auto-align and the Auto Layout
styles) and their hover preview, but mounts no Tidy Up button: `CanvasChrome` passes `LayersThemeStrip` no `tidyUp`,
and no command or menu calls `autoAlignTab` / `autoLayoutTab` (`useTabCanvas.ts`). The spec decides; this file adds
engineering precision.

Scope, by file:

| File                                                 | Role                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/editor/lib/tab-cleanup.ts`                     | `cleanupElements(elements, kind, layers)`: pure, one cleanup over a tab                |
| `apps/editor/lib/tidy-verdict.ts`                    | `assessCleanup`, `verdictNotice`: whether a cleanup would change anything              |
| `apps/editor/lib/tidy-engine.ts`                     | `loadTidyEngine`, `tidyEngine`, `withTidyEngine`: the tidiers, loaded on demand        |
| `apps/editor/hooks/canvas/useCleanupPreview.ts`      | The hover preview: writes a cleanup as a preview, reverts on leave                     |
| `apps/editor/hooks/canvas/useTabCanvas.ts`           | `autoAlignTab`, `autoLayoutTab`: one undoable commit each, refused when judged a no-op |
| `apps/editor/components/canvas/LayersThemeStrip.tsx` | Draws the Tidy Up button only when given `tidyUp`                                      |

## Behaviour and state

- `CleanupKind` is `'align'` or an `AutoLayoutChoice`. Both commits are blocked when edits are, and do nothing on an
  empty tab. A commit that the verdict judges would change nothing is refused with its notice instead.
- Telemetry: `Tab·Aligned` for Auto-align, `Tab·Aligned·<style>` for a layout style.

## Performance and limits

- **Out of the first load.** `tab-cleanup` and `tidy-verdict` are dynamic imports behind `loadTidyEngine`, loaded
  once and shared: the preview loads them as it opens, a commit at the press (`tidy-engine.test.ts`).
- **One hover's budget.** A hover runs one cleanup over the whole tab, so the worst case a hand-drawn diagram reaches,
  300 nodes in a branching graph, lays out within 100 ms of CPU for every kind (`tab-cleanup.perf.test.ts`).

## Testing

`apps/editor/lib/tab-cleanup.test.ts`, `tab-cleanup.perf.test.ts` and `tidy-engine.test.ts`.
