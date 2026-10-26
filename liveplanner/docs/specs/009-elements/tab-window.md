# The tab window

A **Tab Window** (`shape: 'tab-window'`) is an element showing another tab of the same project, fitted inside a
rounded frame. It is a model kind: it validates, loads and exports, but no liveplanner surface adds one and the editor
has no Shows menu for it. A Dashboard's slots are how a Plan tab shows other tabs
([Plan tabs](../026-plan/plan-tabs.md)).

## The model

`packages/project/src/tab-window.ts`, pure:

- `windowTabId` on the element (`element-types.ts`) names the tab it shows. Absent until chosen; a tab that is gone
  shows as unavailable. `tabWindowMayShow` / `tabWindowOffers`: any tab of the project but the window's own.
- It lands 16:9 at `TAB_WINDOW_SIZE` (640 × 360, `shape-factory.ts`) with `TAB_WINDOW_RADIUS` (12) corners, and keeps
  its size when its kind is swapped (`lib/canvas.ts`).
- It takes no label (`data-shapes.ts`, `element-types.ts`), its ground is the paper of the tab it shows, and it draws
  its own frame (`colors.ts`): `TAB_WINDOW_HAIRLINE` when it has no stroke, `TAB_WINDOW_EMPTY`'s ground and words when
  there is no drawing.

## The drawing

A window is drawn by the export renderer (`svgTabWindow`, called from `svg-render.ts`): the shown tab's drawing fitted
and centred inside its frame, over that tab's paper, with every id prefixed (`prefixSvgIds`) so the inner drawing
never shares a gradient, marker or clip with the outer one. Without a drawing it is the frame named for its tab
("Tab Window" when unknown). Under the Sketch finish the frame is drawn by hand while the tab inside keeps its own
finish ([Finish](../008-canvas/finish.md)). A drawing set moving (`motionFor`) animates as the canvas does.

Inside another tab's drawing (a split view's static pane, `useTabSvg`), a window is a frame named for its tab
(`tabWindowNames`): one level deep, never a window inside a window.

## Exports

`export-tab.ts` hands the renderer `resolveTabWindow`, so an exported tab's windows carry their tabs' drawings and the
typefaces those tabs write in. Loading a shown tab goes through `usePerTabLoad`, which shares one fetch per tab between
every caller, so a window and its export never ask again on a timer.

## Telemetry

A window added by a paste or duplicate counts as `Element·Added·TabWindow` (`lib/element-telemetry.ts`). It sends
no events of its own, and `UI·Used·TabWindowOpen` is listed in liveworkspace's
`../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts`
([liveworkspace/docs/telemetry.md](../../../../liveworkspace/docs/telemetry.md)).

## Testing

`packages/project/src/tab-window.test.ts`: the offers, the id prefixing, and the frame with and without a drawing.
