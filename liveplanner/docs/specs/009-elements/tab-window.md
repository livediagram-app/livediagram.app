# The tab window (retired)

**Retired 2026-11-10.** A **Tab Window** (`shape: 'tab-window'`, the tab it showed in `windowTabId`) was an element
showing another tab of the same project, fitted inside a rounded frame. No liveplanner surface ever added one (a
Dashboard's slots are how a Plan tab shows other tabs, [Plan tabs](../026-plan/plan-tabs.md)), and it did not earn its
place in any liveworkspace product, so it is retired here as it is in the others:

- no palette tile, quick add, command palette or palette search entry, no menu section and no element tour;
- no agent way to add one: the agents' element format and `add` take only the Plan kinds
  (`packages/edit-operations/src/plan-elements.ts`), so `add` with a `tab-window` is refused, and
  `RETIRED_SHAPE_KINDS` (`packages/project/src/tab-window.ts`) names the kind as retired. The API's element schema
  still names the kind, since a stored one is valid;
- no live drawing: the export's drawing of the shown tab, its typefaces and its moving arrows
  (`resolveTabWindow` drawings, `tabWindowFontIds`, `motionFor`, an arrow's `lineMotion`) are gone.

## A stored window

A project saved with a window keeps it, so nobody's tab loses something silently. It is a model kind still:

- It validates and loads as before (`packages/project/src/validate.ts`, `element-types.ts`), keeping `windowTabId`,
  its size and its place; a kind swap keeps its size (`lib/canvas.ts`).
- On the canvas it is a still frame: the window's ground and hairline (`TAB_WINDOW_EMPTY`, `TAB_WINDOW_HAIRLINE`,
  `TAB_WINDOW_RADIUS` corners) with the name of the tab it showed, or "Tab Window" when that tab is gone
  (`apps/editor/components/canvas/RetiredTabWindowFace.tsx`). It draws no live tab, fetches nothing, and has no
  controls: it selects, moves, resizes, copies and deletes like any box, and reads as a picture (`role="img"`).
- Exports (the Export dialog, the split view's other pane) draw the same frame named for its tab (`svgTabWindow`
  with `tabWindowNames`, `packages/project/src/tab-window.ts`), never the tab inside it. Under the Sketch finish its
  hairline is drawn by hand ([Finish](../008-canvas/finish.md)).
- Copying a project still re-points its `windowTabId` to the copied tab (`remapTabLinks`,
  [tab-project-many-to-many](../006-project/tab-project-many-to-many.md)), so a copy's frame keeps its name.

Deleting the frame is the way to be rid of it. Turning stored windows into another kind on load was weighed and left
out: it would rewrite people's projects for an element they can see and remove themselves, and a collaborator on an
older client would see the element change under them.

## Telemetry

`Element·Added·TabWindow`, `Element·Changed·TabWindowTab`, `UI·Used·TabWindowOpen` and the `TabWindowTour*` events
are retired in liveworkspace's dashboard (`../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts`,
[liveworkspace/docs/specs/008-telemetry/telemetry.md](../../../../liveworkspace/docs/specs/008-telemetry/telemetry.md)),
and `TabWindow` is no longer a palette telemetry type (`packages/api-schema/src/telemetry-schema.ts`). A pasted or
duplicated stored window counts as no element kind (`lib/element-telemetry.ts`).

## Testing

- `packages/project/src/tab-window.test.ts`: the kind is retired, keeps its size and validates, and its export frame
  is named for its tab, or "Tab Window".
- `apps/editor/components/canvas/RetiredTabWindowFace.test.tsx`: a stored window loads and draws as a named frame with
  no controls, and as "Tab Window" when its tab is gone.
- `packages/edit-operations/src/operations/add.test.ts` and `element-format.test.ts`: no agent `add` or element
  format offers the kind.
- `apps/editor/lib/element-telemetry.test.ts` and `palette-telemetry-coverage.test.ts`: a copied stored window sends
  no `Element·Added`, and the kind needs no palette bucket.
