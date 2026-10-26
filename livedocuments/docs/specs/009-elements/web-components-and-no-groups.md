# Web components are elements; no groups

## What

Two decisions, the second resting on the first:

1. The palette's **Components** (Banner, Stat row, Process steps, Hero, Header, and the Callout, a Card
   preset) are **single elements**, not bundles of primitives held together by a shared `groupId`, each with
   a layout that re-flows as it is resized and every piece of text editable in place.
2. **The editor has no groups**: no `groupId` field, no Group / Ungroup actions or `⌘G`, no
   group mode, group selection or drill-in, no group toolbar actions, no group quick-connect or
   `pinned-group` arrow endpoints.

## Why

Groups cost more than they give. Every selection, drag, delete, duplicate, lock, layer,
quick-connect and clipboard path needs a group branch, and the interactions (select the group,
click again to drill in, no resize, group mode to extend one) are a steady source of "why did
that happen". What people actually wanted from them is covered by the marquee multi-selection
(move, align, style, delete many at once) and by stacks.

The one real dependency is the palette's Components. A component built as grouped primitives
comes apart the moment a user drags the wrong piece, resizes as a
uniform zoom of loose boxes (so text and padding scale together), and can only be edited by
drilling into the group. The better answer is to make it one element.

## The elements

The Callout is no kind of its own: it is a preset of the Card ([The card](card.md) "The Callout is a Card preset").
The palette's Callout places a `card` with `cardMedia: 'badge'`, a heading (`pageTitle`) and a body (`label`), so it
lays out, colours and edits as a card. The web component kinds are `banner`, `card`, `stat-row`, `process` and
`site-header` (`WebComponentShape`); the card has its own spec, and the table below covers the rest.

Each is a `ShapeElement` kind except the Hero, which is an image (see below). All of them keep
the ordinary element behaviours for free: move, resize, rotate, lock, layers, colours, font,
shadow, comments, links, copy / paste, undo.

| Kind          | Text                                                    | Rows (bounded)                        |
| ------------- | ------------------------------------------------------- | ------------------------------------- |
| `banner`      | `label` = title, `pageSubtitle` = subtitle              | none                                  |
| `stat-row`    | none                                                    | `stats: { value, caption }[]`, 1 to 6 |
| `process`     | none                                                    | `processSteps: string[]`, 2 to 8      |
| `site-header` | `label` = brand                                         | `navLinks: string[]`, 0 to 6          |
| image hero    | `heroCaption: { title, subtitle }` on an `ImageElement` | none                                  |

**The label is the main text wherever there is one**, so double-click edits it with the normal
label editor (rich text, alignment, size, bold) exactly like any shape. The masthead lines
(`pageTitle` / `pageSubtitle`) are single-line plain strings with one bound and one setter, shared by every element that carries them.

**Every other piece of text edits in place** once the element is selected: click a stat's value,
a step's caption or a nav link and type. Enter commits, Escape restores. Before the element is
selected the text is inert, so a press anywhere on it still selects and drags it (the first click
selects, the second edits, the same rule the timeline rail uses).

**Rows are added and removed from the context menu** (a Stats / Steps / Links section in the
Tools flyout, beside the checklist editor), and from a **+** on the canvas at the end
of the row while a stat row or process is selected.

## Resizing

The point of making them single elements is that they can lay themselves out. Each layout is a
pure function in `@livedocuments/document` (`web-components.ts`) that both the canvas view and the
headless SVG renderer call, so an export matches the editor.

- **Banner**: the text region is the box minus its padding. Title and subtitle re-wrap to the
  width; nothing scales with the box except the room the text has. (A Callout lays out as the card
  it is, `cardLayout`.)
- **Stat row**: the cards share the width equally with a fixed gap. The value's font size follows
  the card height (clamped), so a taller row gets bigger numbers rather than more empty card.
- **Process**: the steps spread evenly across the width, connectors run between neighbouring
  circles, and the circle diameter follows the smaller of the height and the step spacing, so
  adding a step on a narrow element shrinks the circles instead of overlapping them.
- **Header**: the logo and brand sit left, the links right-aligned; widening the bar opens the
  gap between them, and links that no longer fit are dropped from the right rather than
  overlapping the brand.

## Colours

- **Banner and Header** paint their bar in `fillColor`, falling back to the stroke (the theme
  accent) when unset, with white text by default. Theme switches retheme only their stroke
  (`THEME_COLOUR_FIELDS` exception), because the theme's pale element fill in an accent bar under
  white text is unreadable.
- **Stat row, Process** (and the Card, the Callout included) are ordinary cards: the theme's surface fill and ink text, with
  the accent (stroke) for the badge, the values and the step circles.
- **Hero**: the caption card is the image's `fillColor` (the theme accent at creation), white text.

## The hero is an image

A hero IS an image with a caption card on it, so it is an `ImageElement` with an optional
`heroCaption`. Keeping it an image means upload, the picker, offline conversion, export
embedding and the image menu all keep working with no second image pipeline. The caption card
can be turned off and on from the image's context menu, which also means any image can become a
hero.

## Stored documents

- No stored element carries a group, and nothing on the read path looks for one.
- An arrow end is free, pinned to an element, or on another arrow; the validator refuses any other
  kind, a group end included.

## No groups

The editor has none of these:

- Group / Ungroup in the selection popover, multi-selection toolbar and context menu; `⌘G`.
- Group mode (the "Click another element to add to the group" pill).
- Group selection, drill-in (`soloSelectedId`), and group-aware drag / delete / lock / layer /
  duplicate / clipboard / format-painter paths.
- Group quick-connect and `pinned-group` endpoints.
- A help article on groups.
