# Timeline

The **Timeline** is a concept graphic in the palette's **Concepts** category: milestones along a line toward an
arrowhead, each a name and a when, taking turns above and below. Its kind is `shape: 'timeline-rail'`. What it shares
with every concept graphic (rows edited in place, the Rows section, Build and Pulse, the theme's accent, its own
[element tour](../007-editor/element-tours.md)) is in [Concept graphics](concept-graphics.md); its layout is that
spec's "Timeline".

## What it is

- **Milestones**: 2 to 8 rows (`conceptRows`), each a name (`label`) and an optional when (`note`): a date, a quarter, a
  sprint. A new Timeline is 720 × 240 with four: Kick-off · Jan, First prototype · Mar, Beta with customers · Jun,
  Launch · Sep.
- **Add Milestone** on the quick-connect "+" ring adds one at the end, up to 8.
- **Borderless**: the Timeline paints its own spine, dots and words, so it takes no border, fill or label of its own;
  the Border controls are not offered (`SELF_PAINTING_SHAPES`).
- **Point fields read once**: an element of this kind that carries `railCount` and `railLabels` and no rows opens with
  one milestone per point (within 2 to 8), each point's label its name and an unnamed point `Milestone n`. The two
  fields are dropped on that read and never written (`element-normalise.ts` `railToTimeline`).

## The composite-component pattern

The Timeline is one of the self-drawing elements built the same way: a dedicated `ShapeKind`, a small state field on
`ShapeElement`, a bespoke face, a borderless variant and an optional context-menu section, with no new top-level
element type. The [Rating](rating.md), [Pie chart](pie-chart.md), [Checklist](checklist.md) and
[Code block](code-block.md) follow it, and the concept graphics take it further: one layout shared by the canvas and the
export.
