# Viewport store

Derived from [Canvas performance](../canvas-performance.md), the rule **A pan or zoom renders the
canvas, not the editor**. The same shape as the [Selection store](selection-store.md).

## Files

| File                                               | Role                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/live/lib/viewport-store.ts`                  | `createViewportStore`, `View`, `ViewportStore`                             |
| `apps/live/hooks/ui/useStoreSlice.ts`              | `useStoreSlice(store, select, equal)`: the shared slice subscription       |
| `apps/live/hooks/canvas/useSelectionStore.tsx`     | `useSelectionOf` delegates to `useStoreSlice`                              |
| `apps/live/hooks/canvas/useEditorViewport.ts`      | Holds the store; `zoomRef` / `viewportOffsetRef` read it; no view state    |
| `apps/live/app/document/[id]/useEditorState.ts`    | Never subscribes; passes `viewport` on; effects subscribe                  |
| `apps/live/components/canvas/EditorCanvasHost.tsx` | Passes no view to the canvas                                               |
| `apps/live/components/canvas/Canvas.tsx`           | `CanvasView` subscribes to the view; children subscribe where they show it |
| `apps/live/hooks/canvas/useViewportStore.tsx`      | `ViewportStoreProvider`, `useViewportStore`, `useViewportOf`               |

## Domain and naming

| Term           | Identifier      | Meaning                                                |
| -------------- | --------------- | ------------------------------------------------------ |
| View           | `View`          | `{ zoom: number; offset: { x: number; y: number } }`   |
| Viewport store | `ViewportStore` | One per editor; holds the `View`, notifies on a change |

## Behaviour and state

- `createViewportStore(zoom)` starts at `{ zoom, offset: { x: 0, y: 0 } }`.
- `get()` returns the current `View`; its identity changes only on a real change.
- `setZoom(next)` and `setOffset(next)` take a value or an updater (`SetStateAction`), so every call
  site keeps its shape; `setView(next)` sets both and notifies once. A set that changes nothing (the
  same zoom, an offset with the same `x` and `y`) notifies nobody.
- `useStoreSlice(store, select, equal = Object.is)` is `useSyncExternalStore` keeping the last slice
  per snapshot and selector, as `useSelectionOf` did; `useSelectionOf` becomes a call to it.
- `useEditorViewport` creates the store and returns it as `viewport`, with `setViewportZoom` /
  `setViewportOffset` its setters. `zoomRef` and `viewportOffsetRef` are stable read-only objects
  whose `current` reads the store, so every existing reader keeps its form.

### Readers above the canvas

| Reader                            | Becomes                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useKeyboardAvoidance` (`zoom`)   | reads `zoomRef.current` when the keyboard moves                                                                                                                                                             |
| Saving the view before presenting | a layout effect on `presenting`, declared before the slide fit: it captures `viewport.get()` as a deck starts and `setView`s it back as it ends, before the exit paints (never a store write during render) |
| Publishing our view (follow-me)   | `viewport.subscribe` in an effect, plus a send on a tab switch                                                                                                                                              |
| `useFollowMe`                     | applies a peer's view with one `setView` after recording it; while following, `viewport.subscribe` ends the follow on any other view                                                                        |
| `useCanvasPinchZoom`              | reads `viewport.get()` per event (bursts within a frame compound correctly) and zooms at a point with one `setView`                                                                                         |
| `TourHost` (viewport centre)      | `viewport.get().offset` when the step runs                                                                                                                                                                  |
| The editor context                | carries `viewport`, not `viewportZoom` / `viewportOffset`                                                                                                                                                   |
| `EditorCanvasHost` → `Canvas`     | passes no view; `EditorView` provides the store (`ViewportStoreProvider`) and `CanvasView` subscribes with `useViewportOf`                                                                                  |

### Inside the canvas

- `ViewportStoreProvider` (`hooks/canvas/useViewportStore.tsx`) wraps the editor view beside
  the selection's provider; `useViewportOf(select, equal)` subscribes to a slice, `useViewportStore()`
  returns the store and throws `ViewportStoreMissing` outside a provider.
- `CanvasProps` carries no `viewportZoom` / `viewportOffset`. `CanvasView` subscribes to the whole
  view and is the canvas-level reader: its transform, its gesture hooks and the zoom context it
  provides read it. What it renders takes the view only where it shows it:
  - `CanvasChrome` and its panels take no view; inside it the parts that convert canvas points to
    the screen (the guide and lane overlays, draw previews, palette-drag guides, `canvasViewKey`),
    the zoom controls and the Map subscribe with `useViewportOf`;
  - the element layer's remote cursors and laser overlay, and the selection toolbars, subscribe.
- A zoom tick therefore renders `CanvasView`, the counter-scaled parts and those subscribers; the
  floating panels (Palette, Explorer, the command palette) render 0 times.

## Errors and edge cases

- The store is never written during render: a write notifies other components mid-render. Every
  write sits in a handler, an effect or an animation frame.
- A zoom clamp that lands on the current zoom notifies nobody.
- Server render: the initial zoom is the desktop default, as today.
- A tab switch restores a saved view through `setView`, one notification.

## Performance and limits

- Per tick: one store notification; renders: the canvas subtree and the zoom readers only.
- Measured by the render counter (the root renders 0 times for a zoom or a pan) and a local
  interleaved A/B of a zoom's script time.

## Observability

- `[viewport] change` (debug, scope `viewport`) is not logged per tick: a tick is a hot path. The
  follow-me broadcaster keeps its own log.

## Testing

| Rule                                               | Test                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- |
| No-op sets notify nobody; updaters; `setView` once | `viewport-store.test.ts`                                    |
| The shared slice subscription                      | `useStoreSlice.test.tsx`; `useSelectionStore.test.tsx` kept |
| The root never renders for a zoom or a pan         | `useEditorViewport.test.tsx`: its host renders 0 times      |
| Follow-me publishes and lets go on a local move    | `useFollowMe` tests, store-driven                           |
| Behaviour unchanged                                | the e2e suites that pan, zoom, pinch, follow and present    |

## Constants and configuration

- None new.

## Defaults ledger

- None.
