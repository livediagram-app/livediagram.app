# The tab window (retired)

**Retired 2026-11-10.** A **Tab Window** (`shape: 'tab-window'`, the tab it showed in `windowTabId`) was an element
showing another tab of the same design, live, fitted inside a rounded frame. It no longer earned its place (livediagram,
livehuddle and livedocuments had already retired it), and nothing in livedesign makes one any more:

- no palette tile (Media), quick add, command palette or palette search entry;
- no Tab Window menu section (Shows, Open), no **Choose a Tab**, no Open button, no element tour and no **Show Me**
  switch for it in Settings;
- no agent way to add one: `RETIRED_SHAPE_KINDS` (`packages/design/src/tab-window.ts`) keeps it out of the agents'
  element format and kind list (`packages/edit-operations/src/element-format.ts`) and the MCP schema text
  (`packages/agent-verbs/src/mcp/schema.ts`), and `add tab-window` is refused ("tab windows are retired",
  `packages/edit-operations/src/operations/add-kind.ts`). The API's element schema still names the kind, since a
  stored one is valid;
- no help article (`pages/tab-windows` is gone and redirects to Pages, [Help app](../018-help/help-app.md)), palette
  description or marketing feature card.

## A stored window

A design saved with a window keeps it, so nobody's page loses something silently. It is a model kind still:

- It validates and loads as before (`packages/design/src/validate.ts`, `element-types.ts`), keeping `windowTabId`, its
  size and its place. A collaborator on an older client sees and edits the same element.
- On the canvas it is a still frame: the window's ground and hairline (`TAB_WINDOW_EMPTY`, `TAB_WINDOW_HAIRLINE`) with
  the name of the tab it showed, or "Tab Window" when that tab is gone
  (`apps/live/components/canvas/RetiredTabWindowFace.tsx`). It draws no live tab, fetches nothing, and has no
  controls: it selects, moves, resizes, copies and deletes like any box.
- Exports draw the same frame named for its tab (`svgTabWindow` with `tabWindowNames`,
  `packages/design/src/tab-window.ts`), never the tab inside it.
- It still cannot go in a component ([Components](components.md)).
- Copying a design still re-points its `windowTabId` to the copied tab (`remapTabLinks`,
  [tab-design-many-to-many](../006-design/tab-design-many-to-many.md)), so a copy's frame keeps its name.

Deleting the frame is the way to be rid of it. Turning stored windows into another kind on load, or dropping them, was
weighed and left out: it would rewrite people's designs for an element they can see and remove themselves, and a
collaborator on an older client would see their window vanish mid-session.

## Telemetry

`Element·Added·TabWindow`, `Element·Changed·TabWindowTab`, `UI·Used·TabWindowOpen`, the `TabWindowTour*` events and
the `tab-windows` help article are retired in liveworkspace's dashboard
(`../liveworkspace/apps/site/app/telemetry/livedesign/retired-events.ts`,
[telemetry](../017-telemetry/telemetry.md#retired-features)). A pasted or duplicated stored window counts
as no element kind.

## Testing

- `packages/design/src/tab-window.test.ts`: the frame an export draws, with and without a tab name.
- `apps/live/components/canvas/RetiredTabWindowFace.test.tsx`: a stored window loads and draws as a named frame with no
  controls, and as "Tab Window" when its tab is gone.
- `apps/live/lib/palette-search.test.ts`, `packages/edit-operations/src/element-format.test.ts` and
  `packages/edit-operations/src/operations/add-kind.test.ts` hold that no palette tile, search entry or agent `add`
  offers the kind.
- `apps/live/lib/element-telemetry.test.ts`: a copied stored window sends no `Element·Added`.
