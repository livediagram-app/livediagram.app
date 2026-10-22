# Timeline rail (now the Timeline)

The **Timeline rail**, a line of evenly spaced labelled points in the Build category, is now the **Timeline**, a
concept graphic: milestones along a line toward an arrowhead, each a name and a when, taking turns above and below.
Everything about it is in [Concept graphics](concept-graphics.md) "Timeline".

## What changed

- It moved from **Build** to **Concepts**, and became a concept graphic: rows (`conceptRows`, a name and a when each),
  edited in place, Add Milestone on the "+" ring, the Rows section in the menu, Build and Pulse, the theme's ramp and
  its own [element tour](../007-editor/element-tours.md).
- It keeps its kind, `shape: 'timeline-rail'`, so every saved one opens. A saved rail's `railCount` and `railLabels`
  become its milestones on load and are never written again (`element-normalise.ts` `railToTimeline`).
- Gone: the Points stepper, the rail's own Add Point, `RailView`, and the `RAIL_*` constants.

## The composite-component pattern

The rail set the pattern other self-drawing elements follow: a dedicated `ShapeKind`, a small state field on
`ShapeElement`, a bespoke face, a borderless variant and an optional context-menu section, with no new top-level
element type. The [Rating](rating.md), [Pie chart](pie-chart.md), [Checklist](checklist.md) and
[Code block](code-block.md) follow it, and the concept graphics take it further: one layout shared by the canvas and the
export.
