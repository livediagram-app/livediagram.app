# Timeline

> **Leaving livehuddle** (Work Tracker #423): not part of livehuddle's meeting product ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). livediagram keeps it. A diagram tool: part 3 takes it out of the palette; deleting its code is its own card. Until then this describes code livehuddle still carries; build nothing new on it.

## What

The **Timeline** (`shape: 'timeline-rail'`) is livehuddle's one **concept graphic**, an element that lays out its own
rows: milestones along one line toward an arrowhead, each a name and a when, taking turns above and below the line. A
roadmap, a release plan, a project's phases, a history. It was the Timeline rail, a line of labelled points; it keeps
that kind, so every saved one opens as a Timeline.

- **Milestones**: 2 to 8 rows (`conceptRows`), each a name (`label`) and an optional when (`note`): a date, a quarter,
  a sprint.
- **Add Milestone** on the quick-connect "+" ring added one at the end, up to 8; livehuddle has no "+" ring ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#quick-connect)).
- **Borderless**: the Timeline paints its own spine, dots and words, so it takes no border, fill or label of its own;
  the Border controls are not offered (`SELF_PAINTING_SHAPES`).

livediagram's other concept graphics (the Layer stack, Pyramid and Funnel, Cycle, Hub and spoke, Onion rings and
Chevron process) are not part of livehuddle: they lay out an idea for a diagram, which a session does not stop to
draw, and they were cut with Diagram mode ([Editor modes](../007-editor/editor-modes.md)).

## Why

A timeline drawn from loose dots, lines and text boxes zooms as a whole on a resize, needs every piece moved to add a
milestone, and comes apart on a stray drag. As one element it lays itself out, like the web components
([Web components are elements](web-components-and-no-groups.md)).

## Rows

The Timeline carries its content as **rows**:

```ts
conceptRows?: { label: string; note?: string }[];
```

| Kind     | Rows   | `label`     | `note`                                   |
| -------- | ------ | ----------- | ---------------------------------------- |
| Timeline | 2 to 8 | a milestone | its when (a date, a quarter), by the dot |

A label is at most 60 characters and a note at most 40. Row order is meaning: a Timeline reads left to right. It takes
no element label (it draws all its own text).

**Editing.** Once the element is selected, click a row's label (or note) to edit it in place: Enter commits, Escape
restores. A **Rows** section in the menu lists the rows with a label input, a note input, ↑ / ↓ reorder, × remove
(disabled at the minimum) and Add (disabled at the maximum), the same row editor as the web components. While the
element is selected, the ring offers **Add Milestone**. A milestone's when shows the placeholder "When" until it is
written.

## Layout

The Timeline has one pure layout in `@livehuddle/document` that the canvas and the headless renderer both call, so an
export matches the editor. Text re-wraps and re-sizes with the element; it never zooms.

### Timeline

`timelineLayout(w, h, n)` (`packages/document/src/concept-timeline.ts`), shared by the face and the export:

- **The spine** runs across the middle (`y = h / 2`) to an arrowhead at the right edge, `clamp(h * 0.06, 6, 12)` long:
  time runs that way. It is drawn in the accent at 55%, 3 px, round-capped.
- **The milestones** sit in even slots along the spine short of the arrowhead (`slot = (w - 1.5 * head) / n`, the
  `i`th at `slot * (i + 0.5)`). Each is a dot of radius `clamp(min(h * 0.055, slot * 0.14), 5, 12)` in the accent,
  ringed 3 px in the fill so it sits clear of the spine (a ramp would fade the last dots into the paper).
- **They take turns**: the first above the spine, the next below, and so on, so words on one side are two slots apart
  and each may take up to `1.9` slots' width, centred on its dot (narrowing near an end to stay centred inside the
  element, never under `0.95` of a slot). A stem (`max(6, min(room * 0.3, 28))` long, the accent at 50%, 1.5 px) runs
  from the dot out to the words: its **when** nearest the stem, in the accent, bold, at
  `round(clamp(labelPx * 0.8, 10, 14))`, then its **name** right against it, in the ink, semibold, at
  `round(clamp(h * 0.075, 11, 17))`, one line tall (shrinking to fit, then ellipsed). A when that is cleared leaves the
  name alone.
- **Build** brings the milestones in left to right; **Pulse** lights each in turn. A Timeline is borderless and takes
  no fill of its own.
- **From the Timeline rail.** A timeline rail saved before (its `railCount` points and `railLabels`) opens as a
  Timeline: each point a milestone, its label the name (an unnamed point `Milestone n`), within 2 to 8, and the point
  count and labels are dropped on that read and never written (`element-normalise.ts` `railToTimeline`).
- **Starting content**: 720 × 240, Kick-off · Jan, First prototype · Mar, Beta with customers · Jun, Launch · Sep.

## Colours

The milestones are drawn in the accent (the element's stroke) over its fill. Each row's text takes the element's text colour
(`defaultTextColor` for its surface unless set). A theme switch carries all of it, since it is derived from the stroke and fill.

## Animation

The Timeline takes its own set, **Concept**, a section of the menu's Animation row like a chart's (not the Shape set:
the rows are what moves, not the box), with its own Speed and Repeat:

```ts
conceptAnim?: 'build' | 'pulse';
conceptAnimSpeed?: AnimationSpeed;
conceptAnimRepeat?: boolean;
```

- **Build** (a reveal): the milestones appear one after another, left to right. Plays once by default.
- **Pulse** (a loop): each milestone lights in turn, a short brighten-and-settle, then the next, with a beat of rest
  after the last.

They follow the shared rules ([Element animations](../028-animation/element-animations.md)): pure CSS keyframes with
per-row `animation-delay` (no script), deterministic, `transform` / `opacity` only, reduced motion and every export show
the rest frame (every row shown), and an unknown stored value (a `'flow'` from an older Cycle included) renders as no
animation.

## Palette

The **Timeline** tile sits in Workshop's **Layout** category, after the containers
([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)). There is no Concepts category.

## Share roles

| Role        | May                        |
| ----------- | -------------------------- |
| Editor      | Everything above           |
| Participant | Look; not the rows or anim |
| Viewer      | Look                       |

Rows are structure, so their in-place lines render inert for a Participant and a Viewer.

## The composite-component pattern

The Timeline is one of the self-drawing elements built the same way: a dedicated `ShapeKind`, a small state field on
`ShapeElement`, a bespoke face, a borderless variant and an optional context-menu section, with no new top-level
element type, and one layout shared by the canvas and the export. The [Rating](rating.md),
[Pie chart](pie-chart.md), [Checklist](checklist.md) and [Code block](code-block.md) follow it.

## Agents

The MCP server and the REST API take the Timeline with `conceptRows` and the animation fields. Rows are kept to its
range, as the menu keeps them: past the most, the rest are dropped, and short of the fewest, rows named as Add names
them ("Milestone 3") are added, so every later edit takes.
