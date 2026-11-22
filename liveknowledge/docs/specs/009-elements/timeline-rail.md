# Timeline rail and the composite-component pattern

The **Timeline** is a concept graphic: milestones along a line toward an arrowhead, each a name and a when, taking
turns above and below. Everything about it is in [Concept graphics](concept-graphics.md) "Timeline". This spec covers
how a stored rail reads, and the pattern its kind set for self-drawing elements.

## A stored rail

- The Timeline's kind is `shape: 'timeline-rail'`. It lives in **Concepts**, as a concept graphic: rows
  (`conceptRows`, a name and a when each), edited in place, Add Milestone on the "+" ring, the Rows section in the menu,
  Build and Pulse, the theme's ramp and its own [element tour](../007-editor/element-tours.md).
- A rail stored with `railCount` and `railLabels` (from livediagram's evenly spaced rail) reads as milestones on load,
  and those fields are never written (`element-normalise.ts` `railToTimeline`).
- There is no Points stepper and no Add Point of the rail's own: milestones are rows.

## The composite-component pattern

A self-drawing element is a dedicated `ShapeKind`, a small state field on `ShapeElement`, a bespoke face, a
borderless variant (`element-variant.ts`) and an optional context-menu section, with no new top-level element type.
The [Rating](rating.md), [Pie chart](pie-chart.md), [Checklist](checklist.md) and [Code block](code-block.md) follow
it, and the concept graphics take it further: one layout shared by the canvas and the export.
