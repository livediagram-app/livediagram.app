# Concept graphics

## What

Three elements for the shapes ideas come in, each one element that lays out its own rows:

- **Layer stack** (`shape: 'layer-stack'`): horizontal bands stacked top to bottom, each with a label and an
  optional side note. A tech stack, the OSI model, architecture tiers.
- **Pyramid** (`shape: 'pyramid'`): tiers in a triangle, in three variants: **Pyramid** (apex up), **Inverted**
  (apex down) and **Funnel** (bands narrowing downward, each with an optional value). A hierarchy of needs, a
  strategy stack, a conversion funnel.
- **Cycle** (`shape: 'cycle'`): steps evenly spaced round a ring, joined by curved arrows, with a label in the middle.
  PDCA, a flywheel, a release loop.

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

| Kind        | Rows   | `label`   | `note`                                      |
| ----------- | ------ | --------- | ------------------------------------------- |
| Layer stack | 2 to 8 | the layer | a side note to the right of the band        |
| Pyramid     | 2 to 6 | the tier  | a value after the label (Funnel only)       |
| Cycle       | 3 to 8 | the step  | not drawn (kept, so a kind switch keeps it) |

A label is at most 60 characters and a note at most 40. Row order is meaning: the first row is the top layer, the
top tier (the apex of a Pyramid, the widest band of a Funnel or Inverted) and the cycle's first step, at twelve
o'clock, the rest following clockwise.

**The element's label** is the Cycle's centre label. A Layer stack and a Pyramid take no label (they draw all their
own text).

**Editing.** Once the element is selected, click a row's label (or note) to edit it in place: Enter commits, Escape
restores. A **Rows** section in the menu (Tools flyout) lists the rows with a label input, a note input where the
kind draws notes, ↑ / ↓ reorder, × remove (disabled at the kind's minimum) and Add (disabled at its maximum), the
same row editor as the web components. While the element is selected, the ring offers **Add Layer**, **Add Tier** or
**Add Step**.

**Pyramid variant** (`pyramidVariant: 'pyramid' | 'inverted' | 'funnel'`, Pyramid by default) is three tiles in the
same section.

## Layout

Each kind has one pure layout in `@livediagram/document` that the canvas and the headless renderer both call, so an
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

## Colours

The rows are a **ramp from the accent**: the first row is the accent (the element's stroke) and each later row mixes
it further toward the element's fill, down to 22%. The Cycle draws its steps as the fill with an accent ring, and its
first step solid in the accent to mark where the loop starts. Each row's text takes the readable colour for its own
fill (`readableColour`), so labels stay legible down the ramp. A theme switch carries all of it, since it is derived
from the stroke and fill.

## Animation

Concept graphics take their own set, **Concept**, in the element's Tools section like a chart's (not the Shape set:
the rows are what moves, not the box), with its own Speed and Repeat:

```ts
conceptAnim?: 'build' | 'pulse' | 'flow';
conceptAnimSpeed?: AnimationSpeed;
conceptAnimRepeat?: boolean;
```

- **Build** (a reveal): the rows appear one after another in the order the graphic is read: a Layer stack top to
  bottom, a Pyramid from the base up, a Funnel and an Inverted pyramid from the top down, a Cycle clockwise from the
  first step (each arc drawing on after its step). Plays once by default.
- **Pulse** (a loop): each row lights in turn, a short brighten-and-settle, then the next, with a beat of rest after
  the last. On a Cycle it reads as "we are here" travelling round.
- **Flow** (a loop, Cycle only): dashes travel along the arcs in the loop's direction.

They follow the shared rules ([Element animations](../028-animation/element-animations.md)): pure CSS keyframes with
per-row `animation-delay` (no script), deterministic, `transform` / `opacity` only except Flow's dash offset on the
arcs, reduced motion and every export show the rest frame (every row shown), and an unknown stored value renders as
no animation.

## Palette

A new category, **Concepts**, in the Structure band: **Layer Stack**, **Pyramid**, **Funnel**, **Cycle**. The Funnel
tile places a Pyramid with the Funnel variant (the variant is the decision, so it gets its own tile).

| Mode       | Concepts |
| ---------- | -------- |
| Diagram    | yes      |
| Illustrate | yes      |
| Plan       | no       |
| Facilitate | yes      |

## Templates

The **Pyramid** and **Funnel** templates are one Pyramid element each (Pyramid and Funnel variants) with their copy as
rows, and the **Flywheel** template's ring is one Cycle. Templates that sit beside them keep their own elements.

## Share roles

| Role        | May                                                                                   |
| ----------- | ------------------------------------------------------------------------------------- |
| Editor      | Everything above                                                                      |
| Participant | Write the Cycle's centre label, as on any element; not the rows, variant or animation |
| Viewer      | Look                                                                                  |

Rows are structure, so their in-place lines render inert for a Participant and a Viewer.

## Agents

The MCP server and the REST API take the three kinds with `conceptRows`, `pyramidVariant` and the animation fields.
