# Element tours

Removed from liveplanner (plans/0001-liveplanner-fork.md Phase 4). An element tour taught one complex diagram element
(a Sankey diagram, a concept graphic, a mind map, a flowchart and others) from a small Show Me toolbar beside it, the
first time someone selected one. liveplanner keeps no diagram elements, so it keeps none of their tours: Plan's own
tours are the [Plan tour](../026-plan/plan-tour.md), the Forms tour and the [Show Me](show-me.md) surfaces.

The Sankey diagram's code is still in the tree until the diagram element kinds go, and with it the Sankey Flows
dialog's on-demand [Show Me](show-me.md) (`SankeyFlowsTour`); no Plan tab places a Sankey. Code comments that cite
this spec name that leftover. Its Settings switches (Tours › Show Me) and its telemetry are retired with it; the dashboard drops their events
(`../liveworkspace/apps/site/app/telemetry/liveplanner/retired-events.ts`).
