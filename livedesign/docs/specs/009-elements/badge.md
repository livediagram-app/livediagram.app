# The badge

## What

A **Badge**: a small pill of text ("Beta", "v2.1", "PII", "3×") that either stands alone or **attaches** to a point
on another element and travels with it. A `shape: 'badge'`.

This spec also defines **attachment**, which the step number shares ([The step number](step-number.md)).

## Why

Pages carry small facts about a block: its stage, its version, a warning, a count. Written into the label they
compete with the name; drawn as a separate shape they drift off the block the first time it moves. A badge sits on
the block's corner where people expect a status mark, and stays there.

## The element

- **Text** is the label, one line, at most 24 characters. Double-click edits it.
- **Size follows the text.** Height comes from the text size (24px at the default size); width is the text's width
  plus the padding, never narrower than the height, so a single character makes a circle. It re-fits when the text
  or text size changes. Width is estimated from the character count (`badgeWidth`), the same estimate the export uses,
  so the two agree without a DOM. A badge is not resized by hand; it has no resize handles.
- **Look** (`chipLook`), one of five, all from the element's colours:

| Look    | Fill                         | Text          | Border |
| ------- | ---------------------------- | ------------- | ------ |
| Solid   | accent                       | white         | none   |
| Ink     | the theme's ink              | the surface   | none   |
| Outline | the surface                  | accent        | accent |
| Tinted  | accent at 15% on the surface | accent        | none   |
| Quiet   | the theme's muted surface    | the muted ink | none   |

"Accent" is the element's stroke (the theme accent on a fresh badge), so a theme switch carries it, and choosing a
colour in Colours recolours the look. A new badge is **Solid**.

## Attachment

```ts
attachedTo?: ElementId;
attachAt?: 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
```

- **The eight points** are the corners and edge midpoints of the host's box. An attached badge's centre sits on its
  point, so it straddles the edge the way a notification count does. A rotated host carries the point round with it;
  the badge itself stays upright.
- **Attaching.** Dropping a badge (from the palette or by dragging one) with its centre within 16px of a point on an
  element attaches it there, centred on the point.
- **Detaching.** Dragging an attached badge away from its point (further than 16px) detaches it; dropping it on
  another point re-attaches it there, possibly on another element.
- **Hosts.** Any boxed element except a badge, a step number and the containers (frame, stack), whose corners are too far from what they hold to read as a mark on them (and a stack reflows under them). Arrows are not
  hosts.
- **Following the host.** An attached badge moves with its host in a drag, a nudge and every layout (tidy,
  a stack's reflow) and re-settles on its point when the host is resized or rotated. It is **deleted** with its host
  and **copied and duplicated** with it (the copy attaches to the host's copy). Undo restores both together.
- **Above its host.** An attached badge draws above its host whatever the layer order, so a later shape never covers
  it.
- **On its own.** Copying, duplicating or deleting a badge on its own does just that; a pasted lone badge is
  detached. A badge whose host no longer exists (a peer deleted it, an import dropped it) is detached where it is.
- **Locking.** A locked host still carries its badges; a locked badge stays attached and is not detached by a drag.

Attachment is settled in one place, as every change to the board is committed, so every way a host moves, resizes,
turns or is deleted (a drag, a nudge, a layout, an undo, an agent's edit) carries its badges with no gesture of its
own. Every renderer reads the badge's stored `x` / `y`, which settling keeps on the point, so an export, a thumbnail or
an API reader that knows nothing of attachment still draws it in the right place.

## Connectors

A badge takes no connectors: no anchors, no quick-connect ring, not an arrow end. It is a mark on an element, not an element of its own.

## Animation

A badge takes the **Shape** set for its body, along its pill silhouette ([Element animations](../028-animation/element-animations.md)).
Pulse and Heartbeat suit "New" and alerts. Its text is too small to animate on its own, so it takes no Text set.

## Palette

**Components**: Badge (on a wireframe page, **Elements**).

## Badge presets

As with the Card ([The card](card.md) "Card presets"), the Badge tile on the Toolbar strip is an opener with a caret
whose popover offers presets; elsewhere it places the New badge as before.

| Preset  | Variant   | Text  | Look                     |
| ------- | --------- | ----- | ------------------------ |
| New     | (none)    | New   | Solid                    |
| Beta    | `beta`    | Beta  | Tinted                   |
| Version | `version` | v2.1  | Outline                  |
| Count   | `count`   | 3×    | Ink                      |
| Draft   | `draft`   | Draft | Quiet                    |
| Warning | `warning` | PII   | Solid, in rose (#e11d48) |

A preset's own colour is the badge's as it lands, on any tab: the tab's theme and the style the board remembers for
badges dress a new badge first, and the preset's colour is put back over them (`withVariantColours`), so the Warning
badge is rose whatever the theme. It is a plain colour, not a swatch, so a later theme change leaves it rose too.

**Each tile is the badge it adds**: its own text in its own look and colours, drawn by the canvas's colour rule
(`chipColours`) over the tab theme's element colours (the Default theme's sky without one), and a preset's own colour
(the Warning's rose) wins, as on the canvas. So the tiles are untinted: the palette's theme fill never paints over a
pill's look. The Badge tile itself shows the New badge it drops. One source: `badgePresetFace(variant)`
(`packages/design/src/shape-variants.ts`) reads the preset the tile places; `BadgePresetGlyph`
(`apps/live/components/palette/BadgePresetGlyph.tsx`) draws it.

Each is an ordinary badge: its text, look and colour change afterwards like any badge's.

## The menu

A **Badge** section (Tools flyout), closed until opened: the five looks as tiles. The attachment point is changed by
dragging, not from the menu; **Detach** is a row in the section while the badge is attached.

## Share roles

| Role        | May                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------ |
| Editor      | Everything above                                                                           |
| Participant | Write a badge's text, as on any element; cannot place, move, attach, detach or restyle one |
| Viewer      | Look                                                                                       |

A Participant moving a host it may move (its own sticky, say) carries the badges attached to it; that write is the
host's move, not a badge edit.

## Agents

The MCP server and the REST API take `badge` with `attachedTo` / `attachAt`; an agent sets those and the editor
places the badge on its point when the board next loads (a stored `x` / `y` that disagrees with the point is
settled on read).
