# Page layout preview: blueprint

Derived from [page-layout-preview.md](../page-layout-preview.md). The spec decides; this file only adds engineering
precision. Paths are relative to the repository root.

| File                                                          | Role                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/workbench/src/lib/page-layout-preview.ts`           | `createPageLayoutPreview(config)`: the shown-layout store and `pageLayoutEdits`       |
| `packages/workbench/src/lib/layout-preview-settle.ts`         | `createPreviewSettle()`, `LAYOUT_PREVIEW_SETTLE_MS`, `LayoutPreviewAsk`               |
| `livedocuments/apps/editor/hooks/editor/page-layout-place.ts` | livedocuments' `layoutPlacedTab` and its instance                                     |
| `livedesign/apps/live/hooks/editor/page-layout-place.ts`      | livedesign's `layoutPlacedTab` and its instance                                       |
| each editor's `components/canvas/EditorCanvasHost.tsx`        | `useShownLayoutElements(activeTab.id) ?? activeTab.elements` is what the canvas draws |

## Interfaces and contracts

- `createPageLayoutPreview<T extends { elements }, Id, B>({ load, place, onPlace })`:
  - `load(): Promise<B>`: the builders, a dynamic `import('@<product>/templates/page-layout-build')`.
  - `place(tab, pageId, layout, build): T | null`: the product's `layoutPlacedTab`, pure; null for a page gone or
    locked.
  - `onPlace()`: the press's telemetry (`track('Tab', 'Changed', 'PageLayout')`).
- It returns `showLayout(shown | null)`, `useShownLayoutElements(tabId)`, `shownLayoutElements(tabId)`,
  `shownLayoutFor(tabId, pageId, layout, over)` and `pageLayoutEdits(deps)`. Each product exports them from its
  `page-layout-place.ts`; one instance per product module, so module state is per editor.
- `pageLayoutEdits({ tabId, tab, elements, commitTab, isLocked, refusedLocked, onLayoutPlaced })` returns
  `applyLayout(pageId, layout): Promise<void>` and `previewLayout(pageId, layout | null, how = 'focus')`; each
  product's `pageEdits` spreads them into its `PageEdits`.
- `LayoutPreviewAsk` is `'pointer' | 'focus'`; the shared `LayoutCard` passes it with each `onPreview`.

## Behaviour and state

- Shown: `{ tabId, pageId, layout, over, elements }` or null, in the instance; `showLayout` notifies through
  `createListeners` only when it changes. `useShownLayoutElements` is `useSyncExternalStore` over it (null on a server
  render).
- `previewLayout`: `ask = ++latest`. A null layout or a locked page asks the settle for `'focus'`, then shows null if
  `ask` is still the latest and a layout shows for the tab. Else the settle runs the ask (`'pointer'`: after
  `LAYOUT_PREVIEW_SETTLE_MS` and a frame; `'focus'`: a frame), the builders load once (`builder` promise, `loaded`
  once in), a build answered after a newer ask returns, `place(tab, pageId, layout, build)` places it, and
  `showLayout({ tabId, pageId, layout, over: elements, elements: placed.elements })`.
- `applyLayout`: `settle.cancel()`, `latest++`, then `refusedLocked` returns early. With the builders in it places at
  once (no await): `onPlace()`, `seen = shownLayoutFor(tabId, pageId, layout, elements)`, `commitTab(t =>
seen && t.elements === elements ? { ...t, elements: seen } : place(t, ...))`, `showLayout(null)`,
  `onLayoutPlaced()`, `debugLog('[page] layout placed', { tabId, pageId, layout, shown })`.

## Performance and limits

- A sweep builds one layout: the one it settles on. A placement on a long tab is held by each product's budget test
  (livedocuments 60 pages and 2,400 elements, livedesign 40 screens and 1,600 elements, under 25 ms).
- The builders stay out of the first load (dynamic import on first use).

## Observability

- `[page] layout placed` with `shown` (whether the hover's elements landed).

## Testing

- `packages/workbench/src/lib/page-layout-preview.test.ts`: every branch, held at 100%.
- `packages/workbench/src/lib/layout-preview-settle.test.ts`: a sweep runs its last ask once; focus runs next frame.
- `livedocuments/apps/editor/hooks/editor/page-layout-place.test.tsx` and
  `livedesign/apps/live/hooks/editor/page-layout-place.test.tsx`: the hover's board equals the press's for real
  layouts, through the Layout popover too, themed for the page's half, the sweep builds once, and the budget.

## Constants and configuration

| Constant                   | Value (safe range) | Where                                                    |
| -------------------------- | ------------------ | -------------------------------------------------------- |
| `LAYOUT_PREVIEW_SETTLE_MS` | 70 (50 to 100)     | `layout-preview-settle.ts`; spec "It draws the tile ..." |
