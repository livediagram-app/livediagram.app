# Accent edge

## What

A coloured bar along one edge of a box: **Left**, **Top** or **Bottom**. It is a style option on existing elements,
not an element of its own, set from the **Border** category of the Style flyout beside Strength and Pattern.

```ts
accentEdge?: 'left' | 'top' | 'bottom';
accentEdgeColor?: string; // unset = the element's border colour as drawn
```

## Why

Most of what makes a node look designed rather than drawn is a single deliberate detail: a coloured edge that says
"this one is a service", "this one is degraded", "this one is ours". Today the only way to get it is a thin
rectangle laid over the shape by hand, which does not follow the shape when it moves or resizes and does not follow
its corner. As a style option it costs one click and stays true to the shape.

## Where it applies

The box shapes whose outline has a straight edge to lay a bar along: **Square**, **Stadium**, **Card**
([The card](../009-elements/card.md)) and **Mind node**. Other kinds (diamond, cylinder, circle, the self-painting
kinds) do not offer it; a stored value on one is ignored.

## How it draws

- The bar is clipped to the shape's own outline, so it follows the corner radius: a Large-corner square gets a bar
  with rounded outer corners, a stadium's bar curves with its end.
- Thickness is `max(3, min(6, shorter side × 0.06))` px in element space, so it reads on a small node and stays a
  detail on a big one.
- It paints inside the border, over the fill and under the label, and takes no room from the label (the label's
  padding already clears 6px).
- Colour: `accentEdgeColor` when set, else the element's border colour as drawn (the theme accent on a fresh
  element), so a theme switch carries it.
- Every export (PNG, SVG, PDF, thumbnails) draws it from the same geometry function as the canvas.

## The menu

In **Border**: an **Accent Edge** row of four tiles (None, Left, Top, Bottom). Picking an edge shows one colour well
under it, the shared colour picker ([Colour picker](../004-interface-design/colour-picker.md)); its "Automatic" swatch
clears `accentEdgeColor`. In a multi-selection it applies to every selected shape that supports it, one history step.

The Quick Style Panel does not offer it; it is a deliberate detail, not a most-used choice.

## Style presets and the format painter

Style presets ([Style presets](../010-palette/style-presets.md)) never set or clear it: like the corner radius, it is
a choice the user makes on purpose. The format painter copies it with **Border**.

## Animation

It is part of the element's body: a body animation moves or lights the bar with the rest of the shape. It has no
animation of its own.

## Share roles

An Editor sets it. A Participant and a Viewer cannot (it is styling, and a Participant does not restyle the board).

## Agents

The MCP server and the REST API accept `accentEdge` and `accentEdgeColor` on the shapes above, so an agent can mark
status or ownership the way a person would.
