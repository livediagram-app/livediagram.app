# Element tours

liveplanner has **no element tours**: nothing teaches a diagram element from a toolbar or the footer. Plan's own tours
are the [Plan tour](../026-plan/plan-tour.md), the Forms tour and the [Show Me](show-me.md) surfaces, and no Plan tab
places the elements a tour would teach.

What the editor keeps is the shared contract that lets a tour drive an element's dialog from outside, because the
dialogs and their handles are shared with livediagram, whose element tours use them
(`@liveworkspace/workbench/lib/*-dialog-handle`). In liveplanner the handles are registered and nothing calls them.

## The Chart tour

`LineDataDialog` registers itself with `registerChartDataDialog({ close })`, so a tour running steps inside it can
close it at its end; while one runs, Escape is the tour's. `lib/chart.ts`'s `chartAnim` previews the Grow animation
on a chart on screen when asked.

## The Sankey tour

`SankeyFlowsDialog` registers `registerSankeyFlowsDialog` (switch between the table and text tabs, close), the same
steps its own on-demand Show Me (`useSankeyFlowsTour`, [Sankey](../009-elements/sankey.md#show-me)) runs from inside.
`SankeyView`'s `onCanvas` marks the diagram on the canvas, the one a tour would point at and lift parts of, as a hover
does.

## The Sequence tour

`SequenceDialog` registers `registerSequenceDialog`, and `SequenceMessageList` marks the first message's kind, the
control a tour would point at.

## Help articles

`lib/help-articles.ts` keeps the keys element tours' closing cards link to (`lanes`, `sequenceDiagram`,
`sankeyDiagram`, `dataElements`), each mapped to a Plan article.

## Telemetry and settings

None. There is no Tours section in Settings, and the tour events are listed in liveworkspace's
`../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts`
([liveworkspace/docs/specs/008-telemetry/telemetry.md](../../../../liveworkspace/docs/specs/008-telemetry/telemetry.md)).
