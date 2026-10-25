# Concept graphics

## What

Six elements for the shapes ideas come in, each one element that lays out its own rows:

- **Layer stack** (`shape: 'layer-stack'`): horizontal bands stacked top to bottom, each with a label and an
  optional side note. A tech stack, the OSI model, architecture tiers.
- **Pyramid** (`shape: 'pyramid'`): tiers in a triangle, in three variants: **Pyramid** (apex up), **Inverted**
  (apex down) and **Funnel** (bands narrowing downward, each with an optional value). A hierarchy of needs, a
  strategy stack, a conversion funnel.
- **Cycle** (`shape: 'cycle'`): steps evenly spaced round a ring, joined by curved arrows, with a label in the middle.
  PDCA, a flywheel, a release loop.
- **Hub and spoke** (`shape: 'hub'`): satellites evenly spaced round a central hub, joined to it by spokes (which can be
  switched off). An ecosystem, stakeholders, integrations, everything that touches one service.
- **Onion rings** (`shape: 'onion'`): concentric rings from a core outward, each labelled. Clean or hexagonal
  architecture, trust layers, a maturity model. Nesting, not overlap: it is not a Venn.
- **Chevron process** (`shape: 'chevrons'`): arrow-shaped stages in a row, each pointing into the next, with an
  optional note under each. A value chain, delivery phases, a CI pipeline, a customer lifecycle.
- **Timeline** (`shape: 'timeline-rail'`): milestones along one line toward an arrowhead, each a name and a when,
  taking turns above and below the line. A roadmap, a release plan, a project's phases, a history. It was the
  Timeline rail, a line of labelled points in Build; it keeps that kind, so every saved one opens as a Timeline.

## Why

These are the diagrams people otherwise build from squares, triangles and text boxes, and the templates did exactly
that: the pyramid and funnel templates are stacks of loose trapezoids and labels, the flywheel a ring of shapes and
arrows. A resize is a uniform zoom of loose pieces, adding a tier means re-cutting every trapezoid, and a stray drag
pulls one out. As single elements they lay themselves out, like the stat row and process steps
([Web components are elements](web-components-and-no-groups.md)).

## Rows

All three carry their content as **rows**:

```ts
conceptRows?: { label: string; note?: string }[];
```

| Kind        | Rows   | `label`     | `note`                                      |
| ----------- | ------ | ----------- | ------------------------------------------- |
| Layer stack | 2 to 8 | the layer   | a side note to the right of the band        |
| Pyramid     | 2 to 6 | the tier    | a value after the label (Funnel only)       |
| Cycle       | 3 to 8 | the step    | not drawn (kept, so a kind switch keeps it) |
| Hub         | 3 to 8 | a satellite | not drawn                                   |
| Onion       | 2 to 6 | a ring      | not drawn                                   |
| Chevrons    | 2 to 8 | the stage   | a note under the stage                      |
| Timeline    | 2 to 8 | a milestone | its when (a date, a quarter), by the dot    |

A label is at most 60 characters and a note at most 40. Row order is meaning: the first row is the top layer, the
top tier (the apex of a Pyramid, the widest band of a Funnel or Inverted) and the cycle's first step, at twelve
o'clock, the rest following clockwise; a Hub's first satellite sits at twelve o'clock likewise; an Onion's first ring
is its core, the rest outward; a Chevron process and a Timeline read left to right.

**The element's label** is the Cycle's centre label and the Hub's hub. A Layer stack, a Pyramid, an Onion, a
Chevron process and a Timeline take no label (they draw all their own text).

**Spokes** (`hubSpokes?: boolean`, on when absent): a Hub draws a line from the hub to each satellite. **Spokes** is an
on / off row in the Hub's section; off leaves the satellites floating round the hub.

**Editing.** Once the element is selected, click a row's label (or note) to edit it in place: Enter commits, Escape
restores. A **Rows** section in the menu (Tools flyout) lists the rows with a label input, a note input where the
kind draws notes, ↑ / ↓ reorder, × remove (disabled at the kind's minimum) and Add (disabled at its maximum), the
same row editor as the web components. A **Chevron process** has no Rows section: its stages are edited on the canvas.
While it is selected, the stage under the pointer shows a small bar inside its top edge, at a constant screen size:
**Move Stage Left**, **Move Stage Right** (each off at its end), **Add Note** (only while no stage has a note, so the
note line is not drawn to click into; it gives that stage the note "Note" to type over) and **Delete Stage** (off at
two stages). The bar stays a moment after the pointer leaves the stage, so it can be reached, and while the pointer is
on the stage's name; on a phone or any other touch screen (a tablet is wide but has no hover), every stage shows its
bar. A bar keeps clear of its stage's name and its neighbours, never wider than the stage's words, which sit inside
its body: zoomed out, it shrinks to fit the band above the name, and once that would make it too small to press (under three quarters of its size) it is
not drawn until the view is zoomed in again. While the element is selected, the ring offers **Add Layer**, **Add Tier**,
**Add Step**, **Add Satellite**, **Add Ring**, **Add Stage** or **Add Milestone**. A milestone's when shows the
placeholder "When" until it is written.

**Pyramid variant** (`pyramidVariant: 'pyramid' | 'inverted' | 'funnel'`, Pyramid by default) is three tiles in the
same section.

## Layout

Each kind has one pure layout in `@livedocuments/document` that the canvas and the headless renderer both call, so an
export matches the editor. Text re-wraps and re-sizes with the element; it never zooms.

- **Layer stack.** Bands share the height with a 6px gap. When any row has a note, the bands take the left 62% of the
  width and the notes the rest, each joined to its band by a short rule; with no notes the bands take the full width.
  Labels sit left in the band; their size follows the band height.
- **Pyramid.** Tiers share the height with a 4px gap and are cut from one triangle, so their edges line up as one
  silhouette; Inverted flips it. A Funnel's bands narrow from the full width to 35% at the bottom, each band a
  trapezoid. Labels are centred; a label that does not fit its tier's width at the smallest size (10px) is ellipsed,
  so the apex of a tall pyramid shows "Vis…" rather than spilling out.
- **Cycle.** Steps sit on a circle inscribed in the element, each a disc sized so neighbours never touch (the
  smaller of a quarter of the ring's spacing and a fifth of the element), labels inside the disc. Arcs run clockwise
  between neighbours, stopping short of each disc, with an arrowhead. The centre label sits in the middle.
- **Hub.** The hub is a disc at the centre, about a third of the element's smaller side; the satellites sit on a ring
  round it, each a disc sized so neighbours never touch (as a Cycle's steps), labels inside. Spokes run from the hub's
  edge to each satellite's edge. The hub's label sits inside the hub.
- **Onion.** Rings share the radius of the circle inscribed in the element evenly, the core innermost. The core's label
  sits at the centre; each ring's label sits at the top of its band, as wide as the band allows there.
- **Chevrons.** Stages share the width, each a chevron whose point reaches into the next one's notch (the first has a
  flat left side), with a small gap between them. The point's depth follows the stage height, never more than a
  third of a stage's width. Labels are centred in the stage's body; with any note, the chevrons take the top 62% of
  the height and each note sits under its stage.

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
  `round(clamp(labelPx * 0.8, 10, 14))`, then its **name** right against it, in the ink, semibold, at `round(clamp(h * 0.075, 11, 17))`, one line tall
  (shrinking to fit, then ellipsed, as every concept row). A when that is cleared leaves the name alone.
- **Build** brings the milestones in left to right; **Pulse** lights each in turn. A Timeline is borderless and takes
  no fill of its own.
- **From the Timeline rail.** A timeline rail saved before (its `railCount` points and `railLabels`) opens as a
  Timeline: each point a milestone, its label the name (an unnamed point `Milestone n`), within 2 to 8, and the point
  count and labels are dropped (`element-normalise.ts`). Its old Points stepper, Add Point and Build-category tile are
  gone: the Rows section, Add Milestone and the Concepts tile replace them.
- **Starting content**: 720 × 240, Kick-off · Jan, First prototype · Mar, Beta with customers · Jun, Launch · Sep.

## Colours

The rows are a **ramp from the accent**: the first row is the accent (the element's stroke) and each later row mixes
it further toward the element's fill, down to 22%. The Cycle draws its steps as the fill with an accent ring, and its
first step solid in the accent to mark where the loop starts. A Hub's hub is solid in the accent and its satellites
the fill with an accent ring, its spokes in the accent at half strength. An Onion's core is the accent and each ring
outward steps down the ramp; a Chevron process ramps left to right. Each row's text takes the readable colour for its own
fill (`readableColour`), so labels stay legible down the ramp. A Cycle's later steps and a Hub's satellites, drawn in
the fill, write their names in the element's text colour where it reads on that fill at 4.5:1, and in the fill's own
readable label where it does not (`conceptDiscInk`): the text colour is chosen for the canvas, where a Cycle's centre
words sit, so a pale fill on a dark canvas must not take it. A theme switch carries all of it, since it is derived from
the stroke and fill.

## Animation

Concept graphics take their own set, **Concept**, a section of the menu's Animation row like a chart's (not the Shape
set: the rows are what moves, not the box), with its own Speed and Repeat:

```ts
conceptAnim?: 'build' | 'pulse' | 'flow';
conceptAnimSpeed?: AnimationSpeed;
conceptAnimRepeat?: boolean;
```

- **Build** (a reveal): the rows appear one after another in the order the graphic is read: a Layer stack top to
  bottom, a Pyramid from the base up, a Funnel and an Inverted pyramid from the top down, a Cycle clockwise from the
  first step (each arc drawing on after its step), a Hub's hub then each satellite clockwise (its spoke drawing on
  with it), an Onion from the core outward, a Chevron process left to right. Plays once by default.
- **Pulse** (a loop): each row lights in turn, a short brighten-and-settle, then the next, with a beat of rest after
  the last. On a Cycle it reads as "we are here" travelling round; on a Hub it travels round the satellites, on an
  Onion it ripples outward, and on a Chevron process it runs along the stages.
- **Flow** (a loop, Cycle only): dashes travel along the arcs in the loop's direction.

They follow the shared rules ([Element animations](../028-animation/element-animations.md)): pure CSS keyframes with
per-row `animation-delay` (no script), deterministic, `transform` / `opacity` only except Flow's dash offset on the
arcs, reduced motion and every export show the rest frame (every row shown), and an unknown stored value renders as
no animation.

## Palette

A new category, **Concepts**, in the Structure band: **Layer Stack**, **Pyramid**, **Funnel**, **Cycle**, **Hub and
Spoke**, **Onion**, **Chevrons**. The Funnel
tile places a Pyramid with the Funnel variant (the variant is the decision, so it gets its own tile). The
**Sankey** ([Sankey diagram](sankey.md)) joins them last: a flow drawn as wide as what it carries explains an idea
the way a funnel or a cycle does. Every Pages palette offers Concepts.

## Templates

The **Pyramid** and **Funnel** templates are one Pyramid element each (Pyramid and Funnel variants) with their copy as
rows, and the **Flywheel** template's ring is one Cycle. Templates that sit beside them keep their own elements.

## Element tours

While an Editor has a concept graphic of a toured kind selected, the footer's Start Tour button offers its
[element tour](../007-editor/element-tours.md) (**Start Pyramid Tour**, **Start Hub and Spoke Tour**, ...): on the graphic itself, its rows, typing in place,
the "+" ring's add, the Rows section, the colour ramp and its animation previewed on it. Toured: the
[layer stack](../007-editor/element-tours.md#the-layer-stack-tour), the
[pyramid](../007-editor/element-tours.md#the-pyramid-tour), the
[funnel](../007-editor/element-tours.md#the-funnel-tour), the
[cycle](../007-editor/element-tours.md#the-cycle-tour), the
[hub and spoke](../007-editor/element-tours.md#the-hub-and-spoke-tour), the
[onion](../007-editor/element-tours.md#the-onion-tour) and the
[chevron process](../007-editor/element-tours.md#the-chevrons-tour), whose tour holds a stage's bar open as if pointed
at.

## Share roles

| Role        | May                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Editor      | Everything above, the chevron stage bars included                                                      |
| Participant | Write the Cycle's or Hub's centre label, as on any element; not the rows, variant, spokes or animation |
| Viewer      | Look                                                                                                   |

Rows are structure, so their in-place lines render inert and a chevron's stage bars never show for a Participant and
a Viewer.

## Agents

The MCP server and the REST API take the six kinds with `conceptRows`, `pyramidVariant`, `hubSpokes` and the
animation fields. Rows are kept to the kind's own range, as the menu keeps them: past the most, the rest are dropped,
and short of the fewest, rows named as Add names them ("Step 3") are added, so every later edit takes.
