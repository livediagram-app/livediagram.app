# The card

## What

A **Card**: one diagram node with slots you switch on. In reading order:

- a **header band** across the top (on or off);
- **media** at the top left: an icon badge, an icon tile, or an initial (or none);
- a **title** and a muted **meta line** beside the media;
- a **body**, the element's label;
- a row of **tags**, small chips along the bottom.

It is a `shape: 'card'`, so it keeps every ordinary element behaviour: move, resize, rotate, lock, layers, colours,
font, shadow, accent edge ([Accent edge](../008-canvas/accent-edge.md)), comments, links, connectors, copy / paste
and undo.

## Why

A diagram node is usually more than one line: a service has a name, what it runs on and a couple of facts; a persona
has a role, a context line and a need. Today that is a square with a label, so every line has the same weight and
the node looks like a box with words in it. People who want it to look designed reach for a stack of loose shapes,
which comes apart on the first stray drag, which is exactly what made the grouped web components fail
([Web components are elements](web-components-and-no-groups.md)).

The Callout already shows the answer for one fixed recipe (badge, heading, body). The Card generalises it: the same
single element and pure layout, with the slots chosen per card.

## The slots

| Slot        | Field                                                                 | Off when            |
| ----------- | --------------------------------------------------------------------- | ------------------- |
| Header band | `cardHeader: true`; painted in `headerFill`, else the accent (stroke) | `cardHeader` absent |
| Media       | `cardMedia: 'badge' \| 'tile' \| 'initial'`; the glyph is `iconId`    | `cardMedia` absent  |
| Title       | `pageTitle` (single line, the Page's field and bound)                 | empty               |
| Meta line   | `pageSubtitle` (single line)                                          | empty               |
| Body        | `label` / `richText`, the ordinary label                              | empty               |
| Tags        | `tags: string[]`, 0 to 6, each at most 32 characters                  | empty or absent     |

**The label is the body**, so double-click edits it with the normal label editor (rich text, alignment, size, bold,
the block-type picker). The title, the meta line and each tag **edit in place** once the card is selected, the same
rule as the web components: the first click selects, the next one edits, Enter commits, Escape restores.

**Media** draws `iconId` when it is set:

- **Badge**: a filled accent disc with the glyph in white (an "i" with no icon). This is the Callout's badge.
- **Tile**: a rounded square in a soft tint of the accent with the glyph in the accent. A Technology icon draws as its
  own brand tile instead ([Technology icons](../010-palette/technology-icons.md)).
- **Initial**: a soft accent disc carrying the first letter of the title (a "?" with no title). It ignores `iconId`.

Dropping an icon on a card sets `iconId` and, when the card has no media, turns on Tile.

**The header band** carries the title and the meta line (title left, meta right) in the band's text colour, so a
card with a band reads as a titled panel; without one the title and meta sit beside the media.

**Tags** are plain chips in a single row, filled from the left. Tags that do not fit the width are not drawn (they
stay stored and come back when the card widens). The row is the card's bottom strip, so a card with tags keeps its
body above them.

## Layout

One pure function in `@livediagram/document`, `cardLayout`, computes every rect from the element's size and which
slots are on, and both the canvas and the headless SVG renderer call it, so an export matches the editor. Text
re-wraps as the card resizes; nothing scales with the box except the room the text has. A slot that is off takes no
room. A card too small to hold a slot drops it in this order: tags, then the meta line, then media.

## Colours

A card is an ordinary themed surface: the theme's element fill, ink text, the accent as its border. The accent also
paints the badge, the tile's glyph and tint, the initial and, by default, the header band (white text on it). A
theme switch rethemes it like any shape; the header band follows `headerFill` when one is set and the accent
otherwise.

## The Callout is a Card preset

There is no separate Callout element any more. The palette's **Callout** places a card with `cardMedia: 'badge'`, a
title "Heads up" and a body, which is what a Callout was.

Stored callouts **migrate on read**: `shape: 'callout'` becomes `shape: 'card'` with `cardMedia: 'badge'`, keeping
`pageTitle`, the label, `iconId` and every colour and geometry field, so a migrated callout looks as it did. The
migration runs where the other stored-element migrations run (the api's read path, the thumbnail render, the offline
load and the JSON import), so the editor, MCP, share links and thumbnails only ever see cards. The validator still
accepts `callout` on write, so a browser on a cached build can still save; the next read migrates it.

## Animation

A card takes the **Shape** set for its body (its silhouette is its rounded box, the header band and accent edge
included) and the **Text** set for its label ([Element animations](../028-animation/element-animations.md)). The
title, meta line and tags are part of the body: a pulse or float moves the whole card, and they are not animated on
their own.

## Palette

| Mode       | Where                                                       |
| ---------- | ----------------------------------------------------------- |
| Diagram    | **Build**: Card; **Write**: Callout (the preset)            |
| Illustrate | **Components**: Card and Callout; **Popular** keeps Callout |
| Plan       | none                                                        |
| Facilitate | none (Search still finds and places it)                     |

The Card tile drops a card with a tile, a title, a meta line, a body and two tags, so the first one shows what the
slots are; switching a slot off is quicker than discovering one exists.

## Editing the slots

A **Card** section in the element's menu (Tools flyout), closed until opened:

- **Header Band** on / off.
- **Media**: None, Badge, Tile, Initial (one row of tiles).
- **Tags**: per-row inputs committing on blur, ↑ / ↓ reorder, × remove, Add (disabled at six), the web components'
  row editor.

The selection ring offers **Add Tag** while the card has fewer than six.

## Share roles

| Role        | May                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Editor      | Everything above                                                                                         |
| Participant | Write the body (the label), as on any element; nothing else on someone else's card, and cannot place one |
| Viewer      | Look                                                                                                     |

The title, meta line and tags are structure a Participant does not reshape, so they edit only for an Editor; their
in-place lines render inert for a Participant and a Viewer.

## Agents

The MCP server and the REST API take `card` with these fields. An agent building an architecture diagram uses cards
for its service nodes: title the service, meta line the product or runtime, tags for the facts.
